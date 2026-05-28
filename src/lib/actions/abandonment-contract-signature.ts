'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/establishment/permissions'
import { logActivity } from '@/lib/actions/activity-log'
import { buildAbandonmentContractPdf } from '@/lib/pdf/abandonment-contract-pdf'
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
import { getClientDisplayName, type SignatureStatus } from '@/lib/types/database'

function mapDocumensoStatus(status: DocumensoStatus, recipientSigned: boolean): SignatureStatus {
  if (status === 'COMPLETED') return 'signed'
  if (status === 'REJECTED') return 'rejected'
  if (status === 'PENDING') return recipientSigned ? 'signed' : 'pending'
  return 'pending'
}

export async function sendAbandonmentContractForSignature(contractId: string) {
  try {
    const { establishmentId, userId } = await requirePermission('manage_movements')
    const supabase = await createClient()
    const admin = createAdminClient()

    const { data: contract, error } = await admin
      .from('abandonment_contracts')
      .select(`*,
        cedant:clients!cedant_client_id(id, kind, name, first_name, email),
        animal:animals!animal_id(id, name, species, breed, photo_url)`)
      .eq('id', contractId)
      .eq('establishment_id', establishmentId)
      .single()

    if (error || !contract) {
      return { error: 'Contrat introuvable' }
    }

    if (!contract.cedant?.email) {
      return { error: "Le cédant n'a pas d'email enregistré. Renseigne-le sur sa fiche avant l'envoi." }
    }

    if (contract.signature_status === 'pending' || contract.signature_status === 'signed') {
      return { error: 'Ce contrat a déjà été envoyé pour signature' }
    }

    const { data: establishment } = await admin
      .from('establishments')
      .select('name, email, logo_url, website')
      .eq('id', establishmentId)
      .single()

    // 1. Génère le PDF (avec nom du membre qui envoie pré-rempli dans l'encart
    // "Signature du Refuge SDA").
    let pdfResult
    try {
      pdfResult = await buildAbandonmentContractPdf(contractId, { createdByUserId: userId })
    } catch (e) {
      return { error: `Erreur génération PDF : ${(e as Error).message}` }
    }

    const cedantDisplay = getClientDisplayName(contract.cedant)
    const cedantFirstName = contract.cedant.first_name || cedantDisplay.split(' ')[0]
    const orgName = establishment?.name?.trim() || 'le refuge'
    const animalName = contract.animal?.name ?? 'votre animal'

    // 2. Création du document Documenso
    const folderId = await ensureDocumensoFolder(establishmentId, orgName)
    let document
    try {
      document = await createDocument({
        title: `Contrat d'abandon — ${animalName} — ${orgName} (${contract.contract_number})`,
        externalId: `abandonment_${contract.id}`,
        pdfBuffer: pdfResult.buffer,
        pdfFileName: pdfResult.filename,
        folderId: folderId ?? undefined,
        recipients: [
          {
            email: contract.cedant.email,
            name: cedantDisplay,
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
      return { error: `Erreur création document Documenso : ${(e as Error).message}` }
    }

    const recipient = (document.recipients ?? document.Recipient ?? [])[0]
    if (!recipient) {
      return { error: "Documenso n'a pas créé de destinataire" }
    }

    // 3. Positionner les champs Documenso :
    //    a) Sur la dernière page, dans la sigbox "Cédant" (colonne GAUCHE — pageX 10) :
    //       - NAME : auto-rempli avec le nom complet du recipient
    //       - DATE : auto-rempli avec la date de signature
    //       - SIGNATURE : champ à dessiner par le signataire
    //    b) Sur chaque page intermédiaire, un INITIALS (paraphe) dans le
    //       footer running Puppeteer (encart "Paraphes" en bas à droite,
    //       pageY ~95-99). Pratique juridique standard : chaque page paraphée
    //       pour éviter substitution.
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
        console.warn(`[abandonment-contract-signature] addField INITIALS p${pageNumber} failed:`, (e as Error).message)
      }
    }

    // Signature finale dans la sigbox cédant (colonne gauche, pageX 10)
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
          pageX: 10,
          pageY: field.pageY,
          pageWidth: 38,
          pageHeight: field.pageHeight,
        })
      } catch (e) {
        console.warn(`[abandonment-contract-signature] addField ${field.type} failed:`, (e as Error).message)
      }
    }

    // 4. Active la signature sans envoyer l'email Documenso (on envoie le nôtre)
    try {
      await sendDocument(document.id, { sendEmail: false })
    } catch (e) {
      return { error: `Erreur activation signature Documenso : ${(e as Error).message}` }
    }

    // 5. Récupère l'URL de signature actualisée
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

    // 6. Email branded SDA (via Brevo SMTP) avec le lien de signature
    try {
      const breed = (contract.animal?.breed || '').trim() || null
      const { subject, html } = buildContractSignatureEmail({
        kind: 'abandonment',
        signingUrl,
        recipientFirstName: cedantFirstName,
        recipientName: cedantDisplay,
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
        to: contract.cedant.email,
        toName: cedantDisplay,
        subject,
        html,
        fromName: orgName,
        replyTo: establishment?.email ?? undefined,
      })
    } catch (e) {
      console.error('[abandonment-contract-signature] email send failed:', (e as Error).message)
    }

    // 7. Met à jour le contrat
    const { error: updateError } = await supabase
      .from('abandonment_contracts')
      .update({
        documenso_document_id: document.id,
        documenso_recipient_id: recipient.id,
        documenso_signing_url: signingUrl,
        signature_status: 'pending' as SignatureStatus,
        signature_sent_at: new Date().toISOString(),
        status: 'pending_signature',
      })
      .eq('id', contractId)
      .eq('establishment_id', establishmentId)

    if (updateError) {
      console.error('CRITICAL: Documenso sent but DB update failed:', updateError.message)
      return { error: `Document envoyé sur Documenso (id ${document.id}) mais erreur de mise à jour locale: ${updateError.message}` }
    }

    revalidatePath(`/animals/${contract.animal_id}`)
    logActivity({
      action: 'create',
      entityType: 'abandonment_contract_signature',
      entityId: contract.id,
      entityName: contract.contract_number,
      parentType: 'animal',
      parentId: contract.animal_id,
      details: { documenso_document_id: document.id, recipient_email: contract.cedant.email },
    })

    return {
      data: { documensoDocumentId: document.id, signingUrl },
    }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function syncAbandonmentContractSignatureStatus(contractId: string) {
  try {
    const { establishmentId } = await requirePermission('manage_movements')
    const supabase = await createClient()
    const admin = createAdminClient()

    const { data: contract } = await admin
      .from('abandonment_contracts')
      .select('id, animal_id, documenso_document_id, signature_status, status')
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
        const fileName = `signed_abandonment_${contract.id}_${Date.now()}.pdf`
        const { data: upload, error: uploadErr } = await admin.storage
          .from('abandonment-contracts')
          .upload(fileName, Buffer.from(signedPdfBuffer), {
            contentType: 'application/pdf',
            upsert: false,
          })
        if (!uploadErr && upload) {
          const { data: pub } = admin.storage.from('abandonment-contracts').getPublicUrl(upload.path)
          updateData.signed_pdf_url = pub.publicUrl
        }
      } catch (e) {
        console.warn('Could not download/store signed PDF:', (e as Error).message)
      }
      // Quand la signature est complète, on passe le contrat en "active"
      updateData.status = 'active'
    }

    const { error } = await supabase
      .from('abandonment_contracts')
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
