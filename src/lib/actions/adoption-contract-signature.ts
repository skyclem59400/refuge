'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/establishment/permissions'
import { logActivity } from '@/lib/actions/activity-log'
import { buildAdoptionContractPdf } from '@/lib/pdf/adoption-contract-pdf'
import {
  createDocument,
  addField,
  sendDocument,
  getDocument,
  downloadSignedPdf,
  isDocumentFullySigned,
  type DocumensoStatus,
} from '@/lib/documenso/client'
import { ensureDocumensoFolder } from '@/lib/establishment/documenso-folder'
import { sendEmail } from '@/lib/email/client'
import { buildContractSignatureEmail } from '@/lib/email/templates/contract-signature'
import type { SignatureStatus } from '@/lib/types/database'

function mapDocumensoStatus(status: DocumensoStatus, recipientSigned: boolean): SignatureStatus {
  if (status === 'COMPLETED') return 'signed'
  if (status === 'REJECTED') return 'rejected'
  if (status === 'PENDING') return recipientSigned ? 'signed' : 'pending'
  return 'pending'
}

export async function sendAdoptionContractForSignature(contractId: string) {
  try {
    const { establishmentId, userId } = await requirePermission('manage_animals')
    const supabase = await createClient()
    const admin = createAdminClient()

    // Fetch contract + adopter + animal info (animal photo + breed pour l'email)
    const { data: contract, error } = await admin
      .from('adoption_contracts')
      .select('*, adopter:clients!adopter_client_id(id, name, email), animal:animals!animal_id(id, name, species, breed, breed_cross, photo_url)')
      .eq('id', contractId)
      .eq('establishment_id', establishmentId)
      .single()

    if (error || !contract) {
      return { error: 'Contrat introuvable' }
    }

    if (!contract.adopter?.email) {
      return { error: "L'adoptant n'a pas d'email enregistré. Ajoutez-le avant l'envoi." }
    }

    if (contract.signature_status === 'signed') {
      return { error: 'Ce contrat a déjà été signé.' }
    }

    const { data: establishment } = await admin
      .from('establishments')
      .select('name, email, logo_url, website')
      .eq('id', establishmentId)
      .single()

    // ─────────────────────────────────────────────────────────────────────
    // RENVOI PUR (doc Documenso déjà créé) :
    // Le contrat est déjà chez Documenso (`documenso_document_id` set),
    // statut = 'pending' → on renvoie UNIQUEMENT l'email Brevo (signing
    // URL rafraîchie). Cas réel : Brevo a échoué au premier coup, ou
    // l'adoptant a perdu son mail, ou Céline veut juste retenter.
    // ─────────────────────────────────────────────────────────────────────
    if (contract.signature_status === 'pending' && contract.documenso_document_id) {
      let signingUrl: string | null = contract.documenso_signing_url ?? null
      try {
        const refreshed = await getDocument(contract.documenso_document_id)
        const r = (refreshed.recipients ?? refreshed.Recipient ?? [])[0]
        if (r?.signingUrl) {
          signingUrl = r.signingUrl
        } else if (r?.token) {
          const base = process.env.DOCUMENSO_BASE_URL || 'https://signature.optimus-services.fr'
          signingUrl = `${base}/sign/${r.token}`
        }
      } catch (e) {
        console.warn('[adoption-contract-signature] resend: refresh signing URL failed:', (e as Error).message)
      }

      if (!signingUrl) {
        return { error: 'URL de signature introuvable côté Documenso. Annulez ce mouvement et recréez le contrat.' }
      }

      const animalName = contract.animal?.name ?? 'votre futur compagnon'
      const adopterFirstName = contract.adopter.name.split(' ')[0]
      const orgName = establishment?.name?.trim() || 'le refuge'
      const breed = (contract.animal?.breed_cross || contract.animal?.breed || '').trim() || null

      try {
        const { subject, html } = buildContractSignatureEmail({
          kind: 'adoption',
          signingUrl,
          recipientFirstName: adopterFirstName,
          recipientName: contract.adopter.name,
          animalName,
          animalSpecies: contract.animal?.species || '',
          animalBreed: breed,
          animalPhotoUrl: contract.animal?.photo_url ?? null,
          contractNumber: contract.contract_number,
          establishmentName: orgName,
          establishmentEmail: establishment?.email ?? null,
          establishmentLogoUrl: establishment?.logo_url ?? null,
          establishmentWebsite: establishment?.website ?? null,
        })
        await sendEmail({
          to: contract.adopter.email,
          toName: contract.adopter.name,
          subject,
          html,
          fromName: orgName,
          replyTo: establishment?.email ?? undefined,
        })
      } catch (e) {
        return { error: `Échec du renvoi de l'email : ${(e as Error).message}` }
      }

      await supabase
        .from('adoption_contracts')
        .update({
          documenso_signing_url: signingUrl,
          signature_sent_at: new Date().toISOString(),
        })
        .eq('id', contractId)
        .eq('establishment_id', establishmentId)

      logActivity({
        action: 'update',
        entityType: 'adoption_contract_signature',
        entityId: contract.id,
        entityName: contract.contract_number,
        parentType: 'animal',
        parentId: contract.animal_id,
        details: { resent: true, recipient_email: contract.adopter.email },
      })

      revalidatePath(`/animals/${contract.animal_id}`)
      return {
        data: {
          documensoDocumentId: contract.documenso_document_id,
          signingUrl,
          resent: true,
        },
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // PREMIER ENVOI (ou retry après échec sans doc Documenso créé) :
    // signature_status est null/draft/not_sent OU pending sans doc (cas
    // Capucine/Rafiki où le 1er envoi a planté avant Documenso).
    // ─────────────────────────────────────────────────────────────────────

    // 1. Generate PDF en mode SPLIT (2 PDFs séparés mergés) pour connaître
    // précisément la page de fin du contrat principal. L'adoptant doit signer
    // aux 2 endroits : fin contrat principal + fin annexe.
    let pdfResult
    try {
      pdfResult = await buildAdoptionContractPdf(contractId, {
        createdByUserId: userId,
        splitForSignature: true,
      })
    } catch (e) {
      return { error: `Erreur génération PDF : ${(e as Error).message}` }
    }
    if (!pdfResult.mainPageCount) {
      return { error: 'Page count du contrat principal manquant (bug interne)' }
    }

    const animalName = contract.animal?.name ?? 'votre futur compagnon'
    const adopterFirstName = contract.adopter.name.split(' ')[0]
    const orgName = establishment?.name?.trim() || 'le refuge'

    // 3. Create the Documenso document (PDF uploadé sur S3 par v2-beta)
    const folderId = await ensureDocumensoFolder(establishmentId, orgName)
    let document
    try {
      document = await createDocument({
        title: `Contrat d'adoption — ${animalName} — ${orgName} (${contract.contract_number})`,
        externalId: `adoption_${contract.id}`,
        pdfBuffer: pdfResult.buffer,
        pdfFileName: pdfResult.filename,
        folderId: folderId ?? undefined,
        recipients: [
          {
            email: contract.adopter.email,
            name: contract.adopter.name,
            role: 'SIGNER',
          },
        ],
        // Pas de meta.subject/message ici : email envoyé par Optimus en HTML branded SDA.
        meta: {
          language: 'fr',
          timezone: 'Europe/Paris',
          dateFormat: 'dd/MM/yyyy HH:mm',
        },
      })
    } catch (e) {
      return { error: `Erreur création document Documenso : ${(e as Error).message}` }
    }

    const recipient = (document.recipients ?? document.Recipient ?? [])[0]
    if (!recipient) {
      return { error: "Documenso n'a pas créé de destinataire" }
    }

    // 4. Positionner les champs Documenso :
    //    a) 2 SIGNATURES de l'adoptant : une à la fin du contrat principal
    //       (page mainPageCount, qui correspond à la dernière page du PDF
    //       main avant qu'on lui colle l'annexe via pdf-lib), et une à la
    //       fin de l'annexe (page pageCount). Les 2 dans la sigbox Adoptant
    //       colonne GAUCHE (pageX ~8).
    //    b) Sur les autres pages, un INITIALS (paraphe) dans le footer
    //       running Puppeteer (encart "Paraphes" en bas à droite).
    const mainPage = pdfResult.mainPageCount
    const lastPage = pdfResult.pageCount
    const signaturePages = new Set([mainPage, lastPage])

    // Paraphes sur toutes les pages SAUF celles qui ont une signature finale
    for (let pageNumber = 1; pageNumber <= lastPage; pageNumber++) {
      if (signaturePages.has(pageNumber)) continue
      try {
        await addField(document.id, {
          recipientId: recipient.id,
          type: 'INITIALS',
          pageNumber,
          pageX: 78,
          pageY: 95.5,
          pageWidth: 14,
          pageHeight: 4,
        })
      } catch (e) {
        console.warn(`[adoption-contract-signature] addField INITIALS p${pageNumber} failed:`, (e as Error).message)
      }
    }

    // 2 signatures complètes (NAME + DATE + SIGNATURE) sur les 2 pages
    // de signature : contrat principal + annexe.
    const sigFields: Array<{ type: 'NAME' | 'DATE' | 'SIGNATURE'; pageY: number; pageHeight: number }> = [
      { type: 'NAME', pageY: 76, pageHeight: 4 },
      { type: 'DATE', pageY: 81, pageHeight: 4 },
      { type: 'SIGNATURE', pageY: 86, pageHeight: 8 },
    ]
    for (const pageNumber of [mainPage, lastPage]) {
      for (const field of sigFields) {
        try {
          await addField(document.id, {
            recipientId: recipient.id,
            type: field.type,
            pageNumber,
            pageX: 8,
            pageY: field.pageY,
            pageWidth: 38,
            pageHeight: field.pageHeight,
          })
        } catch (e) {
          console.warn(`[adoption-contract-signature] addField ${field.type} p${pageNumber} failed:`, (e as Error).message)
        }
      }
    }

    // 5. Activer la signature côté Documenso SANS envoyer son email (sendEmail: false).
    //    Optimus enverra ensuite son propre HTML branded SDA.
    try {
      await sendDocument(document.id, { sendEmail: false })
    } catch (e) {
      return { error: `Erreur activation signature Documenso : ${(e as Error).message}` }
    }

    // 5.5 Re-fetch document pour récupérer le signingUrl actualisé
    let signingUrl: string | null = recipient.signingUrl ?? null
    try {
      const refreshed = await getDocument(document.id)
      const refreshedRecipient = (refreshed.recipients ?? refreshed.Recipient ?? [])[0]
      if (refreshedRecipient?.signingUrl) {
        signingUrl = refreshedRecipient.signingUrl
      } else if (refreshedRecipient?.token) {
        const base = process.env.DOCUMENSO_BASE_URL || 'https://signature.optimus-services.fr'
        signingUrl = `${base}/sign/${refreshedRecipient.token}`
      }
    } catch (e) {
      console.warn('Could not refresh signing URL:', (e as Error).message)
    }

    if (!signingUrl) {
      return { error: 'Impossible de générer l’URL de signature Documenso' }
    }

    // 5.7 Envoyer notre email branded SDA via Brevo SMTP
    try {
      const breed = (contract.animal?.breed_cross || contract.animal?.breed || '').trim() || null
      const { subject, html } = buildContractSignatureEmail({
        kind: 'adoption',
        signingUrl,
        recipientFirstName: adopterFirstName,
        recipientName: contract.adopter.name,
        animalName,
        animalSpecies: contract.animal?.species || '',
        animalBreed: breed,
        animalPhotoUrl: contract.animal?.photo_url ?? null,
        contractNumber: contract.contract_number,
        establishmentName: orgName,
        establishmentEmail: establishment?.email ?? null,
        establishmentLogoUrl: establishment?.logo_url ?? null,
        establishmentWebsite: establishment?.website ?? null,
      })
      await sendEmail({
        to: contract.adopter.email,
        toName: contract.adopter.name,
        subject,
        html,
        fromName: orgName,
        replyTo: establishment?.email ?? undefined,
      })
    } catch (e) {
      console.error('[adoption-contract-signature] email send failed:', (e as Error).message)
    }

    // 6. Update contract record
    const updateData = {
      documenso_document_id: document.id,
      documenso_recipient_id: recipient.id,
      documenso_signing_url: signingUrl,
      signature_status: 'pending' as SignatureStatus,
      signature_sent_at: new Date().toISOString(),
    }

    const { error: updateError } = await supabase
      .from('adoption_contracts')
      .update(updateData)
      .eq('id', contractId)
      .eq('establishment_id', establishmentId)

    if (updateError) {
      console.error('CRITICAL: Documenso sent but DB update failed:', updateError.message)
      return { error: `Document envoyé sur Documenso (id ${document.id}) mais erreur de mise à jour locale: ${updateError.message}` }
    }

    revalidatePath(`/animals/${contract.animal_id}`)
    logActivity({
      action: 'create',
      entityType: 'adoption_contract_signature',
      entityId: contract.id,
      entityName: contract.contract_number,
      parentType: 'animal',
      parentId: contract.animal_id,
      details: { documenso_document_id: document.id, recipient_email: contract.adopter.email },
    })

    return {
      data: {
        documensoDocumentId: document.id,
        signingUrl: recipient.signingUrl ?? null,
      },
    }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function syncAdoptionContractSignatureStatus(contractId: string) {
  try {
    const { establishmentId } = await requirePermission('manage_animals')
    const supabase = await createClient()
    const admin = createAdminClient()

    const { data: contract } = await admin
      .from('adoption_contracts')
      .select('id, animal_id, documenso_document_id, signature_status')
      .eq('id', contractId)
      .eq('establishment_id', establishmentId)
      .single()

    if (!contract?.documenso_document_id) {
      return { error: 'Aucun document Documenso lié à ce contrat' }
    }

    const doc = await getDocument(contract.documenso_document_id)
    const recipients = doc.recipients ?? doc.Recipient ?? []
    const recipient = recipients[0]
    const fullySigned = isDocumentFullySigned(doc)

    const updateData: Record<string, unknown> = {
      signature_status: mapDocumensoStatus(doc.status, !!recipient?.signedAt),
    }

    if (recipient?.signedAt) {
      updateData.signed_at_via_documenso = recipient.signedAt
    }

    if (fullySigned && contract.signature_status !== 'signed') {
      try {
        const signedPdfBuffer = await downloadSignedPdf(contract.documenso_document_id)
        const fileName = `signed_adoption_${contract.id}_${Date.now()}.pdf`
        const { data: upload, error: uploadErr } = await admin.storage
          .from('adoption-contracts')
          .upload(fileName, Buffer.from(signedPdfBuffer), {
            contentType: 'application/pdf',
            upsert: false,
          })
        if (!uploadErr && upload) {
          const { data: pub } = admin.storage.from('adoption-contracts').getPublicUrl(upload.path)
          updateData.signed_pdf_url = pub.publicUrl
        }
      } catch (e) {
        console.warn('Could not download/store signed PDF:', (e as Error).message)
      }
    }

    const { error } = await supabase
      .from('adoption_contracts')
      .update(updateData)
      .eq('id', contractId)
      .eq('establishment_id', establishmentId)

    if (error) return { error: error.message }

    // Propager au mouvement lié + appliquer le changement de statut animal
    // (équivalent du webhook Documenso, utile quand le webhook a échoué).
    const newStatus = updateData.signature_status as SignatureStatus
    if ((newStatus === 'signed' || newStatus === 'rejected') && contract.signature_status !== newStatus) {
      try {
        const { finalizeMovementOnSignature } = await import('@/lib/actions/movement-with-contract')
        await finalizeMovementOnSignature({
          contractId: contract.id,
          contractType: 'adoption',
          status: newStatus,
        })
      } catch (e) {
        console.error('[sync adoption] finalizeMovementOnSignature failed:', (e as Error).message)
      }
    }

    revalidatePath(`/animals/${contract.animal_id}`)
    return { data: { status: updateData.signature_status, signedAt: recipient?.signedAt ?? null } }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
