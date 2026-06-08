'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/establishment/permissions'
import { logActivity } from '@/lib/actions/activity-log'
import {
  createDocument,
  addField,
  sendDocument,
  getDocument,
} from '@/lib/documenso/client'
import { ensureDocumensoFolder } from '@/lib/establishment/documenso-folder'
import { sendEmail } from '@/lib/email/client'
import { buildConventionSignatureEmail } from '@/lib/email/templates/convention-signature'

// ============================================
// Envoi unitaire d'une convention pour signature électronique
// ============================================

/**
 * Envoie une convention de fourrière à la collectivité signataire via
 * Documenso + email Brevo branded SDA.
 *
 * Flow :
 *   1. Charge la convention + l'établissement
 *   2. Si déjà 'pending' Documenso → refresh signing URL + renvoi email
 *   3. Sinon :
 *      a. Télécharge le PDF depuis Supabase Storage (pdf_url)
 *      b. Crée le document Documenso (S3 upload)
 *      c. Place les 3 champs (NAME, DATE, SIGNATURE) sur la dernière page
 *      d. Active la signature (sendEmail: false côté Documenso)
 *      e. Récupère signing URL
 *      f. Envoie l'email Brevo branded
 *      g. Update DB : status='sent', signature_status='pending', refs Documenso
 */
export async function sendConventionForSignature(conventionId: string) {
  try {
    const { establishmentId } = await requirePermission('manage_establishment')
    const supabase = await createClient()
    const admin = createAdminClient()

    const { data: convention, error } = await admin
      .from('convention_contracts')
      .select('*')
      .eq('id', conventionId)
      .eq('establishment_id', establishmentId)
      .single()

    if (error || !convention) {
      return { error: 'Convention introuvable' }
    }

    if (!convention.signatory_email) {
      return { error: `Email signataire manquant pour ${convention.scope_name}. Renseignez-le dans la fiche convention avant l'envoi.` }
    }

    if (!convention.pdf_url) {
      return { error: `Aucun PDF lié à la convention ${convention.contract_number}. Uploadez-le avant l'envoi.` }
    }

    if (convention.status === 'cancelled') {
      return { error: 'Convention annulée — envoi impossible.' }
    }

    if (convention.signature_status === 'signed') {
      return { error: 'Convention déjà signée.' }
    }

    const { data: establishment } = await admin
      .from('establishments')
      .select('name, email, logo_url, website')
      .eq('id', establishmentId)
      .single()

    const orgName = establishment?.name?.trim() || "SDA d'Estourmel"

    // ─────────────────────────────────────────────────────────────────────
    // RENVOI : déjà chez Documenso, on rafraîchit l'URL et on renvoie le mail
    // ─────────────────────────────────────────────────────────────────────
    if (convention.signature_status === 'pending' && convention.documenso_document_id) {
      let signingUrl: string | null = convention.documenso_signing_url ?? null
      try {
        const refreshed = await getDocument(convention.documenso_document_id)
        const r = (refreshed.recipients ?? refreshed.Recipient ?? [])[0]
        if (r?.signingUrl) {
          signingUrl = r.signingUrl
        } else if (r?.token) {
          const base = process.env.DOCUMENSO_BASE_URL || 'https://signature.optimus-services.fr'
          signingUrl = `${base}/sign/${r.token}`
        }
      } catch (e) {
        console.warn('[convention-signature] resend: refresh signing URL failed:', (e as Error).message)
      }

      if (!signingUrl) {
        return { error: 'URL de signature introuvable côté Documenso. Réinitialisez la convention.' }
      }

      try {
        const { subject, html } = buildConventionSignatureEmail({
          signingUrl,
          contractNumber: convention.contract_number,
          scopeName: convention.scope_name,
          signatoryRole: convention.signatory_role,
          signatoryName: convention.signatory_name,
          populationReference: convention.population_reference,
          yearlyFeeEuros: Number(convention.yearly_fee_cents) / 100,
          ratePerInhabitantEuros: convention.rate_per_inhabitant_cents / 100,
          nightInterventionEuros: Number(convention.night_intervention_fee_cents) / 100,
          nightSurchargeEuros: Number(convention.night_holiday_surcharge_cents) / 100,
          durationYears: convention.duration_years,
          establishmentName: orgName,
          establishmentEmail: establishment?.email ?? null,
          establishmentWebsite: establishment?.website ?? null,
        })
        await sendEmail({
          to: convention.signatory_email,
          toName: convention.signatory_name ?? undefined,
          subject,
          html,
          fromName: orgName,
          replyTo: establishment?.email ?? undefined,
        })
      } catch (e) {
        return { error: `Échec du renvoi de l'email : ${(e as Error).message}` }
      }

      await supabase
        .from('convention_contracts')
        .update({
          documenso_signing_url: signingUrl,
          signature_sent_at: new Date().toISOString(),
        })
        .eq('id', conventionId)
        .eq('establishment_id', establishmentId)

      logActivity({
        action: 'update',
        entityType: 'convention_contract',
        entityId: conventionId,
        entityName: convention.contract_number,
        details: { resent: true, recipient_email: convention.signatory_email, scope: convention.scope_name },
      })

      revalidatePath('/admin/conventions')
      revalidatePath(`/admin/conventions/${conventionId}`)
      return { data: { documensoDocumentId: convention.documenso_document_id, signingUrl, resent: true } }
    }

    // ─────────────────────────────────────────────────────────────────────
    // PREMIER ENVOI : créer le document Documenso de A à Z
    // ─────────────────────────────────────────────────────────────────────

    // 1. Télécharger le PDF source depuis Supabase Storage
    let pdfBuffer: Buffer
    try {
      const pdfRes = await fetch(convention.pdf_url)
      if (!pdfRes.ok) throw new Error(`HTTP ${pdfRes.status}`)
      pdfBuffer = Buffer.from(await pdfRes.arrayBuffer())
    } catch (e) {
      return { error: `Téléchargement PDF source échoué : ${(e as Error).message}` }
    }

    const folderId = await ensureDocumensoFolder(establishmentId, orgName)
    const docTitle = `Convention de fourrière — ${convention.scope_name} — ${orgName} (${convention.contract_number})`

    // 2. Créer le document Documenso (v2-beta)
    let document
    try {
      document = await createDocument({
        title: docTitle,
        // Préfixe "convention_" pour que le webhook puisse router vers la bonne table
        externalId: `convention_${convention.id}`,
        pdfBuffer,
        pdfFileName: `${convention.contract_number}.pdf`,
        folderId: folderId ?? undefined,
        recipients: [
          {
            email: convention.signatory_email,
            name: convention.signatory_name || convention.scope_name,
            role: 'SIGNER',
          },
        ],
        meta: { language: 'fr', timezone: 'Europe/Paris', dateFormat: 'dd/MM/yyyy HH:mm' },
      })
    } catch (e) {
      return { error: `Création document Documenso échouée : ${(e as Error).message}` }
    }

    const recipient = (document.recipients ?? document.Recipient ?? [])[0]
    if (!recipient) {
      return { error: 'Documenso n\'a pas créé de destinataire' }
    }

    // 3. Placer les champs signature sur la dernière page, colonne droite
    //    (zone réservée signature Maire dans le PDF de convention).
    //    Hypothèse : 3 pages — validée sur le PDF Maroilles. Si le générateur
    //    change un jour, ajuster cette constante ou lire la pageCount du PDF.
    const lastPage = 3
    const fields: Array<{ type: 'NAME' | 'DATE' | 'SIGNATURE'; pageY: number; pageHeight: number }> = [
      { type: 'NAME', pageY: 78, pageHeight: 4 },
      { type: 'DATE', pageY: 83, pageHeight: 4 },
      { type: 'SIGNATURE', pageY: 88, pageHeight: 8 },
    ]
    for (const f of fields) {
      try {
        await addField(document.id, {
          recipientId: recipient.id,
          type: f.type,
          pageNumber: lastPage,
          pageX: 55,
          pageY: f.pageY,
          pageWidth: 38,
          pageHeight: f.pageHeight,
        })
      } catch (e) {
        console.warn(`[convention-signature] addField ${f.type} failed:`, (e as Error).message)
      }
    }

    // 4. Activer la signature côté Documenso SANS son email anglais
    try {
      await sendDocument(document.id, { sendEmail: false })
    } catch (e) {
      return { error: `Activation signature Documenso échouée : ${(e as Error).message}` }
    }

    // 5. Récupérer signingUrl à jour
    let signingUrl: string | null = recipient.signingUrl ?? null
    try {
      const refreshed = await getDocument(document.id)
      const refRecipient = (refreshed.recipients ?? refreshed.Recipient ?? [])[0]
      if (refRecipient?.signingUrl) {
        signingUrl = refRecipient.signingUrl
      } else if (refRecipient?.token) {
        const base = process.env.DOCUMENSO_BASE_URL || 'https://signature.optimus-services.fr'
        signingUrl = `${base}/sign/${refRecipient.token}`
      }
    } catch (e) {
      console.warn('[convention-signature] could not refresh signing URL:', (e as Error).message)
    }

    if (!signingUrl) {
      return { error: 'Impossible de récupérer l\'URL de signature Documenso' }
    }

    // 6. Envoyer email Brevo branded SDA
    try {
      const { subject, html } = buildConventionSignatureEmail({
        signingUrl,
        contractNumber: convention.contract_number,
        scopeName: convention.scope_name,
        signatoryRole: convention.signatory_role,
        signatoryName: convention.signatory_name,
        populationReference: convention.population_reference,
        yearlyFeeEuros: Number(convention.yearly_fee_cents) / 100,
        ratePerInhabitantEuros: convention.rate_per_inhabitant_cents / 100,
        nightInterventionEuros: Number(convention.night_intervention_fee_cents) / 100,
        nightSurchargeEuros: Number(convention.night_holiday_surcharge_cents) / 100,
        durationYears: convention.duration_years,
        establishmentName: orgName,
        establishmentEmail: establishment?.email ?? null,
        establishmentWebsite: establishment?.website ?? null,
      })
      await sendEmail({
        to: convention.signatory_email,
        toName: convention.signatory_name ?? undefined,
        subject,
        html,
        fromName: orgName,
        replyTo: establishment?.email ?? undefined,
      })
    } catch (e) {
      console.error('[convention-signature] email send failed:', (e as Error).message)
      // Non-bloquant : le doc est dispo côté Documenso, l'admin peut renvoyer
    }

    // 7. Mettre à jour la convention
    const { error: updateError } = await supabase
      .from('convention_contracts')
      .update({
        status: 'sent',
        signature_status: 'pending',
        signature_method: 'electronic',
        documenso_document_id: document.id,
        documenso_recipient_id: recipient.id,
        documenso_signing_url: signingUrl,
        signature_sent_at: new Date().toISOString(),
      })
      .eq('id', conventionId)
      .eq('establishment_id', establishmentId)

    if (updateError) {
      console.error('CRITICAL: Documenso doc créé mais DB update échoué:', updateError.message)
      return {
        error: `Document envoyé sur Documenso (id ${document.id}) mais erreur DB : ${updateError.message}`,
      }
    }

    logActivity({
      action: 'create',
      entityType: 'convention_contract_signature',
      entityId: conventionId,
      entityName: convention.contract_number,
      details: {
        documenso_document_id: document.id,
        recipient_email: convention.signatory_email,
        scope: convention.scope_name,
      },
    })

    revalidatePath('/admin/conventions')
    revalidatePath(`/admin/conventions/${conventionId}`)
    return { data: { documensoDocumentId: document.id, signingUrl } }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ============================================
// Envoi multiple : boucle sur l'unitaire et retourne le rapport par ID
// ============================================

export interface BulkSendResult {
  conventionId: string
  scopeName: string
  contractNumber: string
  ok: boolean
  error?: string
}

/**
 * Envoie plusieurs conventions à la suite. Retourne un rapport par ID.
 *
 * Volontairement séquentiel (pas en `Promise.all`) pour ne pas exploser
 * le quota Documenso ni saturer le SMTP Brevo. Sur 49 envois c'est ~30s.
 *
 * En cas d'erreur sur une convention, on continue avec les suivantes :
 * le rapport indique qui a échoué pour permettre une reprise manuelle.
 */
export async function sendConventionsForSignatureBulk(
  conventionIds: string[],
): Promise<{ data?: { results: BulkSendResult[]; summary: { total: number; ok: number; failed: number } }; error?: string }> {
  try {
    if (!Array.isArray(conventionIds) || conventionIds.length === 0) {
      return { error: 'Aucune convention sélectionnée' }
    }

    const { establishmentId } = await requirePermission('manage_establishment')
    const admin = createAdminClient()

    // Pré-charger les libellés pour pouvoir reporter même si l'envoi échoue
    const { data: previews } = await admin
      .from('convention_contracts')
      .select('id, scope_name, contract_number')
      .eq('establishment_id', establishmentId)
      .in('id', conventionIds)

    const previewMap = new Map<string, { scope_name: string; contract_number: string }>()
    for (const p of previews ?? []) {
      previewMap.set(p.id, { scope_name: p.scope_name, contract_number: p.contract_number })
    }

    const results: BulkSendResult[] = []
    for (const id of conventionIds) {
      const preview = previewMap.get(id) ?? { scope_name: '?', contract_number: '?' }
      const res = await sendConventionForSignature(id)
      if (res.error) {
        results.push({ conventionId: id, scopeName: preview.scope_name, contractNumber: preview.contract_number, ok: false, error: res.error })
      } else {
        results.push({ conventionId: id, scopeName: preview.scope_name, contractNumber: preview.contract_number, ok: true })
      }
    }

    const ok = results.filter((r) => r.ok).length
    const failed = results.length - ok

    revalidatePath('/admin/conventions')

    return { data: { results, summary: { total: results.length, ok, failed } } }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
