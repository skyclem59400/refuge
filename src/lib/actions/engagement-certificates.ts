'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/establishment/permissions'
import { logActivity } from '@/lib/actions/activity-log'
import { buildEngagementCertificatePdf } from '@/lib/pdf/engagement-certificate-pdf'
import {
  createDocument,
  addField,
  sendDocument,
  getDocument,
} from '@/lib/documenso/client'
import { ensureDocumensoFolder } from '@/lib/establishment/documenso-folder'
import { sendEmail } from '@/lib/email/client'
import { buildContractSignatureEmail } from '@/lib/email/templates/contract-signature'
import type { EngagementCertificate } from '@/lib/types/database'

// ============================================
// Read
// ============================================

/**
 * Récupère le certificat d'engagement en cours pour un animal donné.
 * "En cours" = status != cancelled && status != expired (donc draft, sent, signed).
 * Plusieurs certificats peuvent exister dans l'historique mais un seul actif à la fois.
 */
export async function getEngagementCertificateForAnimal(animalId: string) {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('engagement_certificates')
      .select('*, adopter:clients!adopter_client_id(id, kind, name, first_name, email, phone, city)')
      .eq('animal_id', animalId)
      .not('status', 'in', '(cancelled,expired)')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      return { error: error.message }
    }

    return { data: data ?? null }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function getEngagementCertificate(id: string) {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('engagement_certificates')
      .select('*, adopter:clients!adopter_client_id(id, kind, name, first_name, email, phone, address, postal_code, city), animal:animals!animal_id(id, name, species)')
      .eq('id', id)
      .single()

    if (error || !data) {
      return { error: 'Certificat introuvable' }
    }

    return { data }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ============================================
// Create + send via Documenso + mark pre-reservation
// ============================================

interface CreateEngagementInput {
  animal_id: string
  client_id: string
  notes?: string | null
}

/**
 * Pipeline complet :
 *   1. Vérifie qu'il n'y a pas déjà un certificat actif pour l'animal
 *   2. Crée la ligne engagement_certificates (status='draft')
 *   3. Génère le PDF Puppeteer
 *   4. Crée le document Documenso, positionne les fields, active la signature
 *   5. Envoie un email branded SDA au client
 *   6. Met l'animal en pré-réservation (pre_reservation_client_id + reserved=true)
 */
export async function createAndSendEngagementCertificate(input: CreateEngagementInput) {
  try {
    const { establishmentId, userId } = await requirePermission('manage_adoptions')
    const supabase = await createClient()
    const admin = createAdminClient()

    // 0. Vérif pré-réservation existante
    const { data: animal, error: animalErr } = await admin
      .from('animals')
      .select('id, name, species, status, pre_reservation_client_id')
      .eq('id', input.animal_id)
      .eq('establishment_id', establishmentId)
      .single()

    if (animalErr || !animal) {
      return { error: 'Animal introuvable' }
    }

    if (animal.pre_reservation_client_id) {
      return { error: 'Cet animal a déjà une pré-réservation active' }
    }

    // 1. Récupère le client adoptant pour vérifier l'email
    const { data: client, error: clientErr } = await admin
      .from('clients')
      .select('id, kind, name, first_name, email')
      .eq('id', input.client_id)
      .eq('establishment_id', establishmentId)
      .single()

    if (clientErr || !client) {
      return { error: 'Adoptant introuvable' }
    }

    if (!client.email) {
      return { error: "L'adoptant n'a pas d'email enregistré. Ajoutez-le avant l'envoi du certificat." }
    }

    // 2. Génère le numéro de certificat
    const { data: certNumber, error: numberError } = await admin.rpc('get_next_engagement_certificate_number', {
      est_id: establishmentId,
    })

    if (numberError || !certNumber) {
      return { error: 'Impossible de générer le numéro de certificat' }
    }

    // 3. Insère la ligne (status='draft')
    const { data: certificate, error: insertError } = await supabase
      .from('engagement_certificates')
      .insert({
        establishment_id: establishmentId,
        animal_id: input.animal_id,
        adopter_client_id: input.client_id,
        certificate_number: certNumber,
        status: 'draft',
        notes: input.notes ?? null,
        created_by: userId,
      })
      .select()
      .single()

    if (insertError || !certificate) {
      return { error: insertError?.message || 'Impossible de créer le certificat' }
    }

    // 4. Génération du PDF
    let pdfResult
    try {
      pdfResult = await buildEngagementCertificatePdf(certificate.id)
    } catch (e) {
      // Cleanup la ligne créée
      await admin.from('engagement_certificates').delete().eq('id', certificate.id)
      return { error: `Erreur génération PDF : ${(e as Error).message}` }
    }

    // 5. Récupère l'établissement pour le branding email
    const { data: establishment } = await admin
      .from('establishments')
      .select('name, email, logo_url, website')
      .eq('id', establishmentId)
      .single()

    const orgName = establishment?.name?.trim() || 'le refuge'
    const adopterDisplayName = client.kind === 'organization'
      ? client.name
      : (client.first_name ? `${client.first_name} ${client.name}` : client.name)
    const adopterFirstName = client.kind === 'organization'
      ? client.name
      : (client.first_name || client.name.split(' ')[0])

    // 6. Crée le document Documenso (prefix "engagement_" pour le routing webhook)
    const folderId = await ensureDocumensoFolder(establishmentId, orgName)
    let document
    try {
      document = await createDocument({
        title: `Certificat d'engagement — ${animal.name} — ${orgName} (${certificate.certificate_number})`,
        externalId: `engagement_${certificate.id}`,
        pdfBuffer: pdfResult.buffer,
        pdfFileName: pdfResult.filename,
        folderId: folderId ?? undefined,
        recipients: [
          {
            email: client.email,
            name: adopterDisplayName,
            role: 'SIGNER',
          },
        ],
        meta: {
          language: 'fr',
          timezone: 'Europe/Paris',
          dateFormat: 'dd/MM/yyyy HH:mm',
        },
      })
    } catch (e) {
      await admin.from('engagement_certificates').delete().eq('id', certificate.id)
      return { error: `Erreur création document Documenso : ${(e as Error).message}` }
    }

    const recipient = (document.recipients ?? document.Recipient ?? [])[0]
    if (!recipient) {
      await admin.from('engagement_certificates').delete().eq('id', certificate.id)
      return { error: 'Documenso n’a pas créé de destinataire' }
    }

    // 7. Positionne les champs Documenso sur la dernière page (sigbox adoptant)
    //    - NAME : auto-rempli
    //    - DATE : auto-rempli
    //    - SIGNATURE : à dessiner par le signataire
    const lastPage = pdfResult.pageCount
    const fieldsToAdd: Array<{ type: 'NAME' | 'DATE' | 'SIGNATURE'; pageY: number; pageHeight: number }> = [
      { type: 'NAME', pageY: 79, pageHeight: 4 },
      { type: 'DATE', pageY: 84, pageHeight: 4 },
      { type: 'SIGNATURE', pageY: 89, pageHeight: 8 },
    ]
    for (const field of fieldsToAdd) {
      try {
        await addField(document.id, {
          recipientId: recipient.id,
          type: field.type,
          pageNumber: lastPage,
          pageX: 8,
          pageY: field.pageY,
          pageWidth: 38,
          pageHeight: field.pageHeight,
        })
      } catch (e) {
        console.warn(`[engagement-certificate] addField ${field.type} failed:`, (e as Error).message)
      }
    }

    // 8. Active la signature Documenso (sendEmail=false : on envoie notre propre email branded)
    try {
      await sendDocument(document.id, { sendEmail: false })
    } catch (e) {
      return { error: `Erreur activation signature Documenso : ${(e as Error).message}` }
    }

    // 9. Récupère le signingUrl à jour
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
      console.warn('[engagement-certificate] could not refresh signing URL:', (e as Error).message)
    }

    if (!signingUrl) {
      return { error: 'Impossible de générer l’URL de signature Documenso' }
    }

    // 10. Envoie l'email branded SDA
    try {
      const { subject, html } = buildContractSignatureEmail({
        kind: 'engagement',
        signingUrl,
        recipientFirstName: adopterFirstName,
        recipientName: adopterDisplayName,
        animalName: animal.name,
        animalSpecies: animal.species || '',
        animalBreed: null,
        animalPhotoUrl: null,
        contractNumber: certificate.certificate_number,
        establishmentName: orgName,
        establishmentEmail: establishment?.email ?? null,
        establishmentLogoUrl: establishment?.logo_url ?? null,
        establishmentWebsite: establishment?.website ?? null,
      })
      await sendEmail({
        to: client.email,
        toName: adopterDisplayName,
        subject,
        html,
        fromName: orgName,
        replyTo: establishment?.email ?? undefined,
      })
    } catch (e) {
      // Non-bloquant : doc dispo côté Documenso, admin peut renvoyer manuellement
      console.error('[engagement-certificate] email send failed:', (e as Error).message)
    }

    // 11. Met à jour la ligne certificate avec les références Documenso + status='sent'
    const nowIso = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('engagement_certificates')
      .update({
        status: 'sent',
        documenso_document_id: document.id,
        documenso_recipient_id: recipient.id,
        documenso_signing_url: signingUrl,
        signature_sent_at: nowIso,
        delivered_at: nowIso,
      })
      .eq('id', certificate.id)
      .eq('establishment_id', establishmentId)

    if (updateError) {
      console.error('CRITICAL: Documenso sent but DB update failed:', updateError.message)
      return { error: `Document envoyé sur Documenso (id ${document.id}) mais erreur de mise à jour locale: ${updateError.message}` }
    }

    // 12. Marque l'animal en pré-réservation
    const { error: animalUpdateError } = await supabase
      .from('animals')
      .update({
        pre_reservation_client_id: input.client_id,
        reserved: true,
      })
      .eq('id', input.animal_id)
      .eq('establishment_id', establishmentId)

    if (animalUpdateError) {
      console.error('[engagement-certificate] animal update failed:', animalUpdateError.message)
    }

    revalidatePath(`/animals/${input.animal_id}`)
    revalidatePath('/animals')
    logActivity({
      action: 'create',
      entityType: 'engagement_certificate',
      entityId: certificate.id,
      entityName: certificate.certificate_number,
      parentType: 'animal',
      parentId: input.animal_id,
      details: { documenso_document_id: document.id, recipient_email: client.email },
    })

    return {
      data: {
        certificate: certificate as EngagementCertificate,
        documensoDocumentId: document.id,
        signingUrl,
      },
    }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ============================================
// Cancel pre-reservation
// ============================================

/**
 * Annule la pré-réservation d'un animal :
 *   - Marque le certificat en cours comme 'cancelled'
 *   - Remet l'animal disponible (pre_reservation_client_id=null, reserved=false)
 *
 * Note : on ne supprime pas la ligne pour garder une trace historique.
 */
export async function cancelPreReservation(animalId: string) {
  try {
    const { establishmentId } = await requirePermission('manage_adoptions')
    const supabase = await createClient()
    const admin = createAdminClient()

    const { data: animal, error: animalErr } = await admin
      .from('animals')
      .select('id, pre_reservation_client_id')
      .eq('id', animalId)
      .eq('establishment_id', establishmentId)
      .single()

    if (animalErr || !animal) {
      return { error: 'Animal introuvable' }
    }

    if (!animal.pre_reservation_client_id) {
      return { error: 'Cet animal n’a pas de pré-réservation active' }
    }

    // Récupère le certificat en cours (s'il existe)
    const { data: certificate } = await admin
      .from('engagement_certificates')
      .select('id, certificate_number')
      .eq('animal_id', animalId)
      .eq('establishment_id', establishmentId)
      .not('status', 'in', '(cancelled,expired)')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (certificate) {
      const { error: certError } = await supabase
        .from('engagement_certificates')
        .update({ status: 'cancelled' })
        .eq('id', certificate.id)
        .eq('establishment_id', establishmentId)

      if (certError) {
        return { error: `Erreur annulation certificat : ${certError.message}` }
      }
    }

    // Remet l'animal disponible
    const { error: animalUpdateError } = await supabase
      .from('animals')
      .update({
        pre_reservation_client_id: null,
        reserved: false,
      })
      .eq('id', animalId)
      .eq('establishment_id', establishmentId)

    if (animalUpdateError) {
      return { error: `Erreur mise à jour animal : ${animalUpdateError.message}` }
    }

    revalidatePath(`/animals/${animalId}`)
    revalidatePath('/animals')

    if (certificate) {
      logActivity({
        action: 'delete',
        entityType: 'engagement_certificate',
        entityId: certificate.id,
        entityName: certificate.certificate_number,
        parentType: 'animal',
        parentId: animalId,
        details: { reason: 'pre_reservation_cancelled' },
      })
    }

    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ============================================
// Mark as signed (called from Documenso webhook)
// ============================================

/**
 * À appeler depuis le webhook Documenso quand le certificat est signé.
 * Calcule can_finalize_at = signed_at + 7 jours.
 */
export async function markEngagementCertificateSigned(
  certificateId: string,
  signedAt: Date
): Promise<{ success: true } | { error: string }> {
  try {
    const admin = createAdminClient()

    // Calcul J+7 calendaire
    const canFinalizeAt = new Date(signedAt)
    canFinalizeAt.setDate(canFinalizeAt.getDate() + 7)
    const canFinalizeDate = canFinalizeAt.toISOString().split('T')[0]

    const { data: cert, error } = await admin
      .from('engagement_certificates')
      .update({
        status: 'signed',
        signed_at: signedAt.toISOString(),
        signed_at_via_documenso: signedAt.toISOString(),
        can_finalize_at: canFinalizeDate,
      })
      .eq('id', certificateId)
      .select('animal_id, certificate_number')
      .single()

    if (error || !cert) {
      return { error: error?.message || 'Certificat introuvable' }
    }

    revalidatePath(`/animals/${cert.animal_id}`)
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
