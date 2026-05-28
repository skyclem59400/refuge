'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/establishment/permissions'
import { logActivity } from '@/lib/actions/activity-log'
import { buildAdoptionCancellationPdf } from '@/lib/pdf/adoption-cancellation-pdf'
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

const EXTERNAL_PREFIX = 'adoption_cancellation_'

/**
 * Envoie l'avenant d'annulation d'adoption (retour pendant période d'accueil) pour
 * signature électronique via Documenso. Le contrat principal reste référencé ;
 * la signature de l'avenant met à jour les colonnes cancellation_* uniquement.
 */
export async function sendAdoptionCancellationForSignature(contractId: string) {
  try {
    const { establishmentId, userId } = await requirePermission('manage_animals')
    const supabase = await createClient()
    const admin = createAdminClient()

    const { data: contract, error } = await admin
      .from('adoption_contracts')
      .select(
        'id, contract_number, animal_id, status, cancellation_signature_status, returned_at, adopter:clients!adopter_client_id(id, name, email), animal:animals!animal_id(id, name, species, breed, breed_cross, photo_url)'
      )
      .eq('id', contractId)
      .eq('establishment_id', establishmentId)
      .single<{
        id: string
        contract_number: string
        animal_id: string
        status: string
        cancellation_signature_status: string | null
        returned_at: string | null
        adopter: { id: string; name: string; email: string | null } | null
        animal: { id: string; name: string; species: string; breed: string | null; breed_cross: string | null; photo_url: string | null } | null
      }>()

    if (error || !contract) return { error: 'Contrat introuvable' }
    if (contract.status !== 'trial_returned') {
      return { error: 'Seuls les contrats avec retour pendant periode d\'accueil peuvent recevoir un avenant' }
    }
    if (!contract.returned_at) {
      return { error: 'Le retour doit etre enregistre avant l\'envoi de l\'avenant' }
    }
    if (!contract.adopter?.email) {
      return { error: 'L\'adoptant n\'a pas d\'email enregistre' }
    }
    if (
      contract.cancellation_signature_status === 'pending' ||
      contract.cancellation_signature_status === 'signed'
    ) {
      return { error: 'L\'avenant a deja ete envoye pour signature' }
    }

    const { data: establishment } = await admin
      .from('establishments')
      .select('name, email, logo_url, website')
      .eq('id', establishmentId)
      .single()

    // 1. Build the cancellation PDF (avec nom du membre qui envoie pré-rempli
    // dans l'encart "Pour le refuge").
    let pdfResult
    try {
      pdfResult = await buildAdoptionCancellationPdf(contractId, { createdByUserId: userId })
    } catch (e) {
      return { error: `Erreur generation PDF : ${(e as Error).message}` }
    }

    const animalName = contract.animal?.name ?? 'l\'animal'
    const adopterFirstName = contract.adopter.name.split(' ')[0]
    const orgName = establishment?.name?.trim() || 'le refuge'

    // 2. Create Documenso document
    const folderId = await ensureDocumensoFolder(establishmentId, orgName)
    let document
    try {
      document = await createDocument({
        title: `Avenant d'annulation - ${animalName} - ${orgName} (${contract.contract_number})`,
        externalId: `${EXTERNAL_PREFIX}${contract.id}`,
        pdfBuffer: pdfResult.buffer,
        pdfFileName: `Avenant_annulation_${contract.contract_number}.pdf`,
        folderId: folderId ?? undefined,
        recipients: [
          {
            email: contract.adopter.email,
            name: contract.adopter.name,
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
      return { error: `Erreur creation document Documenso : ${(e as Error).message}` }
    }

    const recipient = (document.recipients ?? document.Recipient ?? [])[0]
    if (!recipient) return { error: 'Documenso n\'a pas cree de destinataire' }

    // 3. Positionner les champs Documenso :
    //    a) Sur la dernière page, dans le bloc adoptant (colonne DROITE du
    //       grid à 2 colonnes — pageX 55) :
    //       - NAME : auto-rempli avec le nom complet du recipient
    //       - DATE : auto-rempli avec la date de signature
    //       - SIGNATURE : champ à dessiner par le signataire
    //    b) Sur chaque page intermédiaire, un INITIALS (paraphe) dans le
    //       footer running Puppeteer (encart "Paraphes" en bas à droite,
    //       pageY ~95-99).
    const lastPage = pdfResult.pageCount

    // Paraphes sur chaque page sauf la dernière (qui a la signature finale)
    for (let pageNumber = 1; pageNumber < lastPage; pageNumber++) {
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
        console.warn(`[adoption-cancellation-signature] addField INITIALS p${pageNumber} failed:`, (e as Error).message)
      }
    }

    // Signature finale dans le bloc adoptant (colonne droite)
    const fieldsToAdd: Array<{ type: 'NAME' | 'DATE' | 'SIGNATURE'; pageY: number; pageHeight: number }> = [
      { type: 'NAME', pageY: 76, pageHeight: 4 },
      { type: 'DATE', pageY: 81, pageHeight: 4 },
      { type: 'SIGNATURE', pageY: 86, pageHeight: 8 },
    ]
    for (const field of fieldsToAdd) {
      try {
        await addField(document.id, {
          recipientId: recipient.id,
          type: field.type,
          pageNumber: lastPage,
          pageX: 55,
          pageY: field.pageY,
          pageWidth: 38,
          pageHeight: field.pageHeight,
        })
      } catch (e) {
        console.warn(`[adoption-cancellation-signature] addField ${field.type} failed:`, (e as Error).message)
      }
    }

    // 4. Activer la signature SANS envoyer l'email Documenso (on envoie le notre)
    try {
      await sendDocument(document.id, { sendEmail: false })
    } catch (e) {
      return { error: `Erreur activation signature Documenso : ${(e as Error).message}` }
    }

    // 5. Refresh document pour récupérer signingUrl à jour
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

    if (!signingUrl) return { error: 'Impossible de generer l\'URL de signature Documenso' }

    // 6. Email branded
    try {
      const breed = (contract.animal?.breed_cross || contract.animal?.breed || '').trim() || null
      const { subject, html } = buildContractSignatureEmail({
        kind: 'adoption_cancellation',
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
      console.error('[adoption-cancellation-signature] email send failed:', (e as Error).message)
    }

    // 7. Update contract record (cancellation_* columns)
    const { error: updateError } = await supabase
      .from('adoption_contracts')
      .update({
        cancellation_documenso_document_id: document.id,
        cancellation_documenso_recipient_id: recipient.id,
        cancellation_documenso_signing_url: signingUrl,
        cancellation_signature_status: 'pending' as SignatureStatus,
        cancellation_signature_sent_at: new Date().toISOString(),
      })
      .eq('id', contractId)
      .eq('establishment_id', establishmentId)

    if (updateError) {
      return {
        error: `Document envoye Documenso (id ${document.id}) mais erreur de mise a jour locale: ${updateError.message}`,
      }
    }

    revalidatePath(`/animals/${contract.animal_id}`)
    logActivity({
      action: 'create',
      entityType: 'adoption_cancellation_signature',
      entityId: contract.id,
      entityName: contract.contract_number,
      parentType: 'animal',
      parentId: contract.animal_id,
      details: { documenso_document_id: document.id, recipient_email: contract.adopter.email },
    })

    return { data: { documensoDocumentId: document.id, signingUrl } }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function syncAdoptionCancellationSignatureStatus(contractId: string) {
  try {
    const { establishmentId } = await requirePermission('manage_animals')
    const supabase = await createClient()
    const admin = createAdminClient()

    const { data: contract } = await admin
      .from('adoption_contracts')
      .select(
        'id, animal_id, cancellation_documenso_document_id, cancellation_signature_status'
      )
      .eq('id', contractId)
      .eq('establishment_id', establishmentId)
      .single<{
        id: string
        animal_id: string
        cancellation_documenso_document_id: number | null
        cancellation_signature_status: string
      }>()

    if (!contract?.cancellation_documenso_document_id) {
      return { error: 'Aucun avenant Documenso lie a ce contrat' }
    }

    const doc = await getDocument(contract.cancellation_documenso_document_id)
    const recipients = doc.recipients ?? doc.Recipient ?? []
    const recipient = recipients[0]
    const fullySigned = isDocumentFullySigned(doc)

    const updateData: Record<string, unknown> = {
      cancellation_signature_status: mapDocumensoStatus(doc.status, !!recipient?.signedAt),
    }

    if (recipient?.signedAt) {
      updateData.cancellation_signed_at = recipient.signedAt
    }

    if (fullySigned && contract.cancellation_signature_status !== 'signed') {
      try {
        const signedBuf = await downloadSignedPdf(contract.cancellation_documenso_document_id)
        const fileName = `signed_cancellation_${contract.id}_${Date.now()}.pdf`
        const { data: upload, error: uploadErr } = await admin.storage
          .from('adoption-contracts')
          .upload(fileName, Buffer.from(signedBuf), {
            contentType: 'application/pdf',
            upsert: false,
          })
        if (!uploadErr && upload) {
          const { data: pub } = admin.storage.from('adoption-contracts').getPublicUrl(upload.path)
          updateData.cancellation_signed_pdf_url = pub.publicUrl
        }
      } catch (e) {
        console.warn('Could not download/store signed cancellation PDF:', (e as Error).message)
      }
    }

    const { error } = await supabase
      .from('adoption_contracts')
      .update(updateData)
      .eq('id', contractId)
      .eq('establishment_id', establishmentId)

    if (error) return { error: error.message }

    revalidatePath(`/animals/${contract.animal_id}`)
    return { success: true, status: updateData.cancellation_signature_status }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
