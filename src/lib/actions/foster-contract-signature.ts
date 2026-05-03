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

    // Fetch contract + foster + animal info
    const { data: contract, error } = await admin
      .from('foster_contracts')
      .select('*, foster:clients!foster_client_id(id, name, email), animal:animals!animal_id(id, name, species)')
      .eq('id', contractId)
      .eq('establishment_id', establishmentId)
      .single()

    // Fetch establishment info for the email branding
    const { data: establishment } = await admin
      .from('establishments')
      .select('name, email')
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

    const pdfBase64 = pdfResult.buffer.toString('base64')

    // 2. Create the Documenso document with the FA as recipient
    const animalName = contract.animal?.name ?? 'votre futur protégé'
    const fosterFirstName = contract.foster.name.split(' ')[0]
    const orgName = establishment?.name?.trim() || 'le refuge'
    const orgEmail = establishment?.email?.trim() || ''

    const emailSubject = `Convention famille d'accueil — ${animalName} | ${orgName}`
    const contactLine = orgEmail ? `Pour toute question : ${orgEmail}\n\n` : ''
    const emailMessage =
      `Bonjour ${fosterFirstName},\n\n` +
      `Merci pour votre engagement aux côtés de ${orgName} pour accueillir ${animalName}.\n\n` +
      `Vous trouverez ci-joint la convention de placement en famille d'accueil. Merci de la signer électroniquement avant le début du placement.\n\n` +
      contactLine +
      `L'équipe ${orgName}`

    let document
    try {
      document = await createDocument({
        title: `Convention famille d'accueil — ${animalName} — ${orgName} (${contract.contract_number})`,
        externalId: contract.id,
        pdfBase64,
        pdfFileName: pdfResult.filename,
        recipients: [
          {
            email: contract.foster.email,
            name: contract.foster.name,
            role: 'SIGNER',
          },
        ],
        meta: {
          subject: emailSubject,
          message: emailMessage,
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

    // 4. Send for signing (this triggers the email to the FA)
    try {
      await sendDocument(document.id, { sendEmail: true })
    } catch (e) {
      return { error: `Erreur envoi pour signature : ${(e as Error).message}` }
    }

    // 5. Update the contract record
    const updateData = {
      documenso_document_id: document.id,
      documenso_recipient_id: recipient.id,
      documenso_signing_url: recipient.signingUrl ?? null,
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
        signingUrl: recipient.signingUrl ?? null,
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

    revalidatePath(`/animals/${contract.animal_id}`)
    return { data: { status: updateData.signature_status, signedAt: recipient?.signedAt ?? null } }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
