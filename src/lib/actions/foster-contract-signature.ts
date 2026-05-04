'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/establishment/permissions'
import { logActivity } from '@/lib/actions/activity-log'
import { buildFosterContractPdf } from '@/lib/pdf/foster-contract-pdf'
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

// ============================================
// Map Documenso statuses to our DB enum
// ============================================

function mapDocumensoStatus(status: DocumensoStatus, recipientSigned: boolean): SignatureStatus {
  if (status === 'COMPLETED') return 'signed'
  if (status === 'REJECTED') return 'rejected'
  if (status === 'PENDING') return recipientSigned ? 'signed' : 'pending'
  return 'pending'
}

// ============================================
// Send a contract for electronic signature
// ============================================

export async function sendContractForSignature(contractId: string) {
  try {
    const { establishmentId } = await requirePermission('manage_animals')
    const supabase = await createClient()
    const admin = createAdminClient()

    // Fetch contract + foster + animal info (animal photos en plus pour l'email)
    const { data: contract, error } = await admin
      .from('foster_contracts')
      .select('*, foster:clients!foster_client_id(id, name, email), animal:animals!animal_id(id, name, species, breed, breed_cross, photo_url)')
      .eq('id', contractId)
      .eq('establishment_id', establishmentId)
      .single()

    // Fetch establishment info for the email branding (logo + website pour le footer)
    const { data: establishment } = await admin
      .from('establishments')
      .select('name, email, logo_url, website')
      .eq('id', establishmentId)
      .single()

    if (error || !contract) {
      return { error: 'Contrat introuvable' }
    }

    if (!contract.foster?.email) {
      return { error: 'La famille d’accueil n’a pas d’email enregistre. Ajoutez-le avant l’envoi.' }
    }

    if (contract.signature_status === 'pending' || contract.signature_status === 'signed') {
      return { error: 'Ce contrat a deja ete envoye pour signature' }
    }

    // 1. Generate the contract PDF
    let pdfResult
    try {
      pdfResult = await buildFosterContractPdf(contractId)
    } catch (e) {
      return { error: `Erreur generation PDF : ${(e as Error).message}` }
    }

    // 2. Create the Documenso document with the FA as recipient
    // (pdfBuffer sera uploadé sur l'URL S3 retournée par v2-beta)
    const folderId = await ensureDocumensoFolder(establishmentId, establishment?.name?.trim() || 'le refuge')

    const animalName = contract.animal?.name ?? 'votre futur protégé'
    const fosterFirstName = contract.foster.name.split(' ')[0]
    const orgName = establishment?.name?.trim() || 'le refuge'

    let document
    try {
      document = await createDocument({
        title: `Convention famille d'accueil — ${animalName} — ${orgName} (${contract.contract_number})`,
        externalId: contract.id,
        pdfBuffer: pdfResult.buffer,
        pdfFileName: pdfResult.filename,
        folderId: folderId ?? undefined,
        recipients: [
          {
            email: contract.foster.email,
            name: contract.foster.name,
            role: 'SIGNER',
          },
        ],
        // Pas de meta.subject/message ici : l'email d'invitation est envoyé par
        // Optimus en HTML branded SDA, pas par Documenso. On garde quand même
        // language=fr pour les rappels automatiques que Documenso envoie tout seul
        // (rappels J+5, etc.) et pour la page de signature elle-même.
        meta: {
          language: 'fr',
          timezone: 'Europe/Paris',
          dateFormat: 'dd/MM/yyyy HH:mm',
        },
      })
    } catch (e) {
      return { error: `Erreur creation document Documenso : ${(e as Error).message}` }
    }

    const recipient = (document.recipients ?? document.Recipient ?? [])[0]
    if (!recipient) {
      return { error: 'Documenso n’a pas cree de destinataire' }
    }

    // 3. Position a signature field on the last page (bottom-right area, A4)
    try {
      await addField(document.id, {
        recipientId: recipient.id,
        type: 'SIGNATURE',
        pageNumber: 1,
        pageX: 60,
        pageY: 80,
        pageWidth: 30,
        pageHeight: 8,
      })
    } catch (e) {
      // Non-blocking: the FA can still sign by adding their own signature
      console.warn('Could not pre-position signature field:', (e as Error).message)
    }

    // 4. "Envoyer" le doc Documenso SANS déclencher son email (sendEmail: false).
    //    Ça active la signature côté Documenso (status PENDING + token recipient
    //    valide) sans que Documenso envoie son template d'email anglais générique.
    try {
      await sendDocument(document.id, { sendEmail: false })
    } catch (e) {
      return { error: `Erreur activation signature Documenso : ${(e as Error).message}` }
    }

    // 4.5 Re-fetch le document pour récupérer le signingUrl à jour du recipient
    let signingUrl: string | null = recipient.signingUrl ?? null
    try {
      const refreshed = await getDocument(document.id)
      const refreshedRecipient = (refreshed.recipients ?? refreshed.Recipient ?? [])[0]
      if (refreshedRecipient?.signingUrl) {
        signingUrl = refreshedRecipient.signingUrl
      } else if (refreshedRecipient?.token) {
        // Fallback : construire l'URL depuis le token si signingUrl absent
        const base = process.env.DOCUMENSO_BASE_URL || 'https://signature.optimus-services.fr'
        signingUrl = `${base}/sign/${refreshedRecipient.token}`
      }
    } catch (e) {
      console.warn('Could not refresh signing URL:', (e as Error).message)
    }

    if (!signingUrl) {
      return { error: 'Impossible de générer l’URL de signature Documenso' }
    }

    // 4.7 Envoyer notre email branded SDA via Brevo SMTP
    try {
      const breed = (contract.animal?.breed_cross || contract.animal?.breed || '').trim() || null
      const { subject, html } = buildContractSignatureEmail({
        kind: 'foster',
        signingUrl,
        recipientFirstName: fosterFirstName,
        recipientName: contract.foster.name,
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
        to: contract.foster.email,
        toName: contract.foster.name,
        subject,
        html,
        fromName: orgName,
        replyTo: establishment?.email ?? undefined,
      })
    } catch (e) {
      // Non-bloquant : le doc est dispo côté Documenso, l'admin peut renvoyer manuellement
      console.error('[foster-contract-signature] email send failed:', (e as Error).message)
    }

    // 5. Update the contract record
    const updateData = {
      documenso_document_id: document.id,
      documenso_recipient_id: recipient.id,
      documenso_signing_url: signingUrl,
      signature_status: 'pending' as SignatureStatus,
      signature_sent_at: new Date().toISOString(),
    }

    const { error: updateError } = await supabase
      .from('foster_contracts')
      .update(updateData)
      .eq('id', contractId)
      .eq('establishment_id', establishmentId)

    if (updateError) {
      // Document was sent but DB failed to update - log loud
      console.error('CRITICAL: Documenso sent but DB update failed:', updateError.message)
      return { error: `Document envoye sur Documenso (id ${document.id}) mais erreur de mise a jour locale: ${updateError.message}` }
    }

    revalidatePath(`/animals/${contract.animal_id}`)
    logActivity({
      action: 'create',
      entityType: 'foster_contract_signature',
      entityId: contract.id,
      entityName: contract.contract_number,
      parentType: 'animal',
      parentId: contract.animal_id,
      details: { documenso_document_id: document.id, recipient_email: contract.foster.email },
    })

    return {
      data: {
        documensoDocumentId: document.id,
        signingUrl,
      },
    }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ============================================
// Sync signature status from Documenso (manual or post-webhook)
// ============================================

export async function syncContractSignatureStatus(contractId: string) {
  try {
    const { establishmentId } = await requirePermission('manage_animals')
    const supabase = await createClient()
    const admin = createAdminClient()

    const { data: contract } = await admin
      .from('foster_contracts')
      .select('id, animal_id, documenso_document_id, signature_status')
      .eq('id', contractId)
      .eq('establishment_id', establishmentId)
      .single()

    if (!contract?.documenso_document_id) {
      return { error: 'Aucun document Documenso lie a ce contrat' }
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

    // Once fully signed, fetch and store the signed PDF
    if (fullySigned && contract.signature_status !== 'signed') {
      try {
        const signedPdfBuffer = await downloadSignedPdf(contract.documenso_document_id)
        const fileName = `signed_${contract.id}_${Date.now()}.pdf`
        const { data: upload, error: uploadErr } = await admin.storage
          .from('foster-contracts')
          .upload(fileName, Buffer.from(signedPdfBuffer), {
            contentType: 'application/pdf',
            upsert: false,
          })
        if (!uploadErr && upload) {
          const { data: pub } = admin.storage.from('foster-contracts').getPublicUrl(upload.path)
          updateData.signed_pdf_url = pub.publicUrl
        }
      } catch (e) {
        console.warn('Could not download/store signed PDF:', (e as Error).message)
      }
    }

    const { error } = await supabase
      .from('foster_contracts')
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
          contractType: 'foster',
          status: newStatus,
        })
      } catch (e) {
        console.error('[sync foster] finalizeMovementOnSignature failed:', (e as Error).message)
      }
    }

    revalidatePath(`/animals/${contract.animal_id}`)
    return { data: { status: updateData.signature_status, signedAt: recipient?.signedAt ?? null } }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
