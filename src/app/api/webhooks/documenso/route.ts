import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/server'
import { downloadSignedPdf } from '@/lib/documenso/client'
import { finalizeMovementOnSignature } from '@/lib/actions/movement-with-contract'
import { markEngagementCertificateSigned } from '@/lib/actions/engagement-certificates'
import type { SignatureStatus } from '@/lib/types/database'

// Documenso webhook events we care about:
//   document.opened     -> recipient opened the link
//   document.signed     -> a recipient signed (one of N)
//   document.completed  -> all recipients have signed (final state)
//   document.rejected   -> a recipient rejected
//
// Signature verification: HMAC SHA-256 over the raw body using DOCUMENSO_WEBHOOK_SECRET.

interface DocumensoWebhookPayload {
  event: string
  data?: {
    id?: number
    externalId?: string | null
    status?: string
    completedAt?: string | null
    recipients?: Array<{
      id: number
      email: string
      signingStatus?: string
      signedAt?: string | null
    }>
    Recipient?: Array<{
      id: number
      email: string
      signingStatus?: string
      signedAt?: string | null
    }>
  }
}

function verifySignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature) return false
  const computed = crypto.createHmac('sha256', secret).update(body).digest('hex')
  // Compare both with and without prefixes that some senders use
  const candidates = [
    signature,
    signature.replace(/^sha256=/, ''),
  ]
  return candidates.some((c) => {
    try {
      return crypto.timingSafeEqual(Buffer.from(c, 'hex'), Buffer.from(computed, 'hex'))
    } catch {
      return false
    }
  })
}

function mapEventToStatus(event: string): SignatureStatus | null {
  switch (event) {
    case 'document.opened':
      return 'viewed'
    case 'document.signed':
    case 'document.completed':
    case 'document.recipient.completed':
      return 'signed'
    case 'document.rejected':
      return 'rejected'
    case 'document.cancelled':
      return 'failed'
    default:
      return null
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-documenso-signature')

  const secret = process.env.DOCUMENSO_WEBHOOK_SECRET
  // If a secret is configured, enforce verification. Otherwise we accept (e.g. local dev).
  if (secret) {
    if (!verifySignature(rawBody, signature, secret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  }

  let payload: DocumensoWebhookPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const documensoDocId = payload.data?.id
  if (!documensoDocId) {
    return NextResponse.json({ ok: true, ignored: 'missing document id' })
  }

  const newStatus = mapEventToStatus(payload.event)
  if (!newStatus) {
    return NextResponse.json({ ok: true, ignored: payload.event })
  }

  const admin = createAdminClient()

  // Documents from Optimus carry an externalId. The prefix distinguishes the type:
  //   "adoption_cancellation_<uuid>" → adoption_contracts (mise à jour cancellation_* cols)
  //   "adoption_<uuid>"              → adoption_contracts
  //   "abandonment_<uuid>"           → abandonment_contracts
  //   "engagement_<uuid>"            → engagement_certificates (loi 30/11/2021)
  //   "convention_<uuid>"            → convention_contracts (fourrière communes)
  //   "<uuid>" (no prefix)           → foster_contracts (legacy)
  const externalId = payload.data?.externalId
  const isAdoptionCancellation =
    typeof externalId === 'string' && externalId.startsWith('adoption_cancellation_')
  const isAdoption =
    typeof externalId === 'string' &&
    externalId.startsWith('adoption_') &&
    !isAdoptionCancellation
  const isAbandonment = typeof externalId === 'string' && externalId.startsWith('abandonment_')
  const isEngagement = typeof externalId === 'string' && externalId.startsWith('engagement_')
  const isConvention = typeof externalId === 'string' && externalId.startsWith('convention_')

  // ============================================
  // Cas spécial : convention_contracts (fourrière communes)
  // — pas d'animal, pas de movement, pas de bucket dédié (réutilise "convention-contracts")
  // — met à jour signature_status + status métier
  // ============================================
  if (isConvention) {
    const idLookup = (externalId ?? '').replace(/^convention_/, '')
    const { data: convention } = await admin
      .from('convention_contracts')
      .select('id, contract_number, scope_name, signature_status, documenso_document_id')
      .or(`documenso_document_id.eq.${documensoDocId},id.eq.${idLookup}`)
      .maybeSingle()

    if (!convention) {
      return NextResponse.json({ ok: true, ignored: 'convention not found' })
    }

    const updateData: Record<string, unknown> = { signature_status: newStatus }

    if (payload.data?.recipients?.find((r) => r.signedAt)?.signedAt) {
      updateData.signed_at_via_documenso = payload.data.recipients.find((r) => r.signedAt)!.signedAt
    } else if (payload.data?.Recipient?.find((r) => r.signedAt)?.signedAt) {
      updateData.signed_at_via_documenso = payload.data.Recipient.find((r) => r.signedAt)!.signedAt
    }

    const finalEvent = payload.event === 'document.completed' || payload.event === 'document.signed'

    // Sur signature finale : passer le status métier en "signed" + télécharger PDF signé
    if (newStatus === 'signed' && finalEvent && convention.signature_status !== 'signed') {
      updateData.status = 'signed'
      if (updateData.signed_at_via_documenso) {
        updateData.signed_date = String(updateData.signed_at_via_documenso).slice(0, 10)
      }

      try {
        const buf = await downloadSignedPdf(documensoDocId)
        // Préfixe "signed_" pour ne pas écraser le PDF source (même bucket)
        const fileName = `signed_${convention.id}_${Date.now()}.pdf`
        const { data: upload, error: uploadErr } = await admin.storage
          .from('convention-contracts')
          .upload(fileName, Buffer.from(buf), {
            contentType: 'application/pdf',
            upsert: false,
          })
        if (!uploadErr && upload) {
          const { data: pub } = admin.storage.from('convention-contracts').getPublicUrl(upload.path)
          updateData.signed_pdf_url = pub.publicUrl
        }
      } catch (e) {
        console.warn('Webhook (convention): could not download signed PDF:', (e as Error).message)
      }
    } else if (newStatus === 'rejected') {
      updateData.status = 'cancelled'
    }

    const { error } = await admin
      .from('convention_contracts')
      .update(updateData)
      .eq('id', convention.id)

    if (error) {
      console.error('Webhook convention update error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, contractId: convention.id, type: 'convention', newStatus })
  }

  type SupportedTable = 'adoption_contracts' | 'foster_contracts' | 'abandonment_contracts' | 'engagement_certificates'
  type SupportedBucket = 'adoption-contracts' | 'foster-contracts' | 'abandonment-contracts' | 'engagement-certificates'

  const tableName: SupportedTable =
    isAdoption || isAdoptionCancellation ? 'adoption_contracts'
    : isAbandonment ? 'abandonment_contracts'
    : isEngagement ? 'engagement_certificates'
    : 'foster_contracts'
  const bucketName: SupportedBucket =
    isAdoption || isAdoptionCancellation ? 'adoption-contracts'
    : isAbandonment ? 'abandonment-contracts'
    : isEngagement ? 'engagement-certificates'
    : 'foster-contracts'

  // Le certificat d'engagement utilise `status` (draft|sent|signed|...) au lieu de
  // `signature_status` (not_sent|pending|signed|...). On lit donc le champ adapté.
  // L'avenant d'annulation d'adoption utilise les colonnes cancellation_*.
  type ContractRow = { id: string; animal_id: string; signature_status: string; documenso_document_id: number | null }

  // Find the contract by Documenso document id (preferred) or by id from externalId.
  const stateColumn = isEngagement
    ? 'status'
    : isAdoptionCancellation
      ? 'cancellation_signature_status'
      : 'signature_status'
  const docIdColumn = isAdoptionCancellation ? 'cancellation_documenso_document_id' : 'documenso_document_id'
  const selectCols = `id, animal_id, ${stateColumn} as signature_status, ${docIdColumn} as documenso_document_id`

  let contract: ContractRow | null = null
  {
    const { data } = await admin
      .from(tableName)
      .select(selectCols)
      .eq(docIdColumn, documensoDocId)
      .maybeSingle<ContractRow>()
    contract = data
  }

  if (!contract && externalId) {
    let idLookup = externalId
    if (isAdoptionCancellation) idLookup = externalId.replace(/^adoption_cancellation_/, '')
    else if (isAdoption) idLookup = externalId.replace(/^adoption_/, '')
    else if (isAbandonment) idLookup = externalId.replace(/^abandonment_/, '')
    else if (isEngagement) idLookup = externalId.replace(/^engagement_/, '')
    const { data } = await admin
      .from(tableName)
      .select(selectCols)
      .eq('id', idLookup)
      .maybeSingle<ContractRow>()
    contract = data
  }

  if (!contract) {
    return NextResponse.json({ ok: true, ignored: 'contract not found' })
  }

  const recipients = payload.data?.recipients ?? payload.data?.Recipient ?? []
  const firstSigned = recipients.find((r) => r.signedAt)
  const finalEvent = payload.event === 'document.completed' || payload.event === 'document.signed'

  // ============================================
  // Cas spécial : engagement_certificates
  // — utilise `status` (draft|sent|signed|...) au lieu de `signature_status`
  // — pas de mouvement à finaliser
  // — déclenche calcul de can_finalize_at = signed_at + 7 jours (via markEngagementCertificateSigned)
  // ============================================
  if (isEngagement) {
    if (newStatus === 'signed' && finalEvent && contract.signature_status !== 'signed') {
      // 1. Télécharge + stocke le PDF signé
      let signedPdfUrl: string | null = null
      try {
        const buf = await downloadSignedPdf(documensoDocId)
        const fileName = `signed_${contract.id}_${Date.now()}.pdf`
        const { data: upload, error: uploadErr } = await admin.storage
          .from(bucketName)
          .upload(fileName, Buffer.from(buf), {
            contentType: 'application/pdf',
            upsert: false,
          })
        if (!uploadErr && upload) {
          const { data: pub } = admin.storage.from(bucketName).getPublicUrl(upload.path)
          signedPdfUrl = pub.publicUrl
        }
      } catch (e) {
        console.warn('Webhook (engagement): could not download signed PDF:', (e as Error).message)
      }

      // 2. Marque signé + calcule J+7
      const signedAt = firstSigned?.signedAt ? new Date(firstSigned.signedAt) : new Date()
      await markEngagementCertificateSigned(contract.id, signedAt)
      if (signedPdfUrl) {
        await admin
          .from('engagement_certificates')
          .update({ signed_pdf_url: signedPdfUrl })
          .eq('id', contract.id)
      }
    } else if (newStatus === 'rejected') {
      await admin
        .from('engagement_certificates')
        .update({ status: 'cancelled' })
        .eq('id', contract.id)
      // Remet l'animal disponible si on a une pré-réservation pointant sur cet adoptant
      await admin
        .from('animals')
        .update({ pre_reservation_client_id: null, reserved: false })
        .eq('id', contract.animal_id)
    } else if (newStatus === 'viewed') {
      await admin
        .from('engagement_certificates')
        .update({ signature_viewed_at: new Date().toISOString() })
        .eq('id', contract.id)
    }

    return NextResponse.json({ ok: true, contractId: contract.id, type: 'engagement', newStatus })
  }

  // ============================================
  // Cas spécial : adoption_cancellation_* (avenant d'annulation d'adoption)
  // — met à jour les colonnes cancellation_* de adoption_contracts
  // — pas de mouvement animal à finaliser (la restitution est déjà enregistrée)
  // ============================================
  if (isAdoptionCancellation) {
    const cancelUpdate: Record<string, unknown> = { cancellation_signature_status: newStatus }

    if (firstSigned?.signedAt) {
      cancelUpdate.cancellation_signed_at = firstSigned.signedAt
    }

    if (newStatus === 'signed' && finalEvent && contract.signature_status !== 'signed') {
      try {
        const buf = await downloadSignedPdf(documensoDocId)
        const fileName = `signed_cancellation_${contract.id}_${Date.now()}.pdf`
        const { data: upload, error: uploadErr } = await admin.storage
          .from('adoption-contracts')
          .upload(fileName, Buffer.from(buf), {
            contentType: 'application/pdf',
            upsert: false,
          })
        if (!uploadErr && upload) {
          const { data: pub } = admin.storage.from('adoption-contracts').getPublicUrl(upload.path)
          cancelUpdate.cancellation_signed_pdf_url = pub.publicUrl
        }
      } catch (e) {
        console.warn('Webhook (cancellation): could not download signed PDF:', (e as Error).message)
      }
    }

    const { error } = await admin
      .from('adoption_contracts')
      .update(cancelUpdate)
      .eq('id', contract.id)

    if (error) {
      console.error('Webhook cancellation update error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, contractId: contract.id, type: 'adoption_cancellation', newStatus })
  }

  // ============================================
  // Cas standard : foster_contracts | adoption_contracts | abandonment_contracts
  // ============================================
  const updateData: Record<string, unknown> = { signature_status: newStatus }

  if (firstSigned?.signedAt) {
    updateData.signed_at_via_documenso = firstSigned.signedAt
  }
  if (newStatus === 'viewed' && !updateData.signature_viewed_at) {
    updateData.signature_viewed_at = new Date().toISOString()
  }

  if (newStatus === 'signed' && finalEvent && contract.signature_status !== 'signed') {
    try {
      const buf = await downloadSignedPdf(documensoDocId)
      const fileName = `signed_${contract.id}_${Date.now()}.pdf`
      const { data: upload, error: uploadErr } = await admin.storage
        .from(bucketName)
        .upload(fileName, Buffer.from(buf), {
          contentType: 'application/pdf',
          upsert: false,
        })
      if (!uploadErr && upload) {
        const { data: pub } = admin.storage.from(bucketName).getPublicUrl(upload.path)
        updateData.signed_pdf_url = pub.publicUrl
      }
    } catch (e) {
      console.warn('Webhook: could not download signed PDF:', (e as Error).message)
    }
  }

  const { error } = await admin
    .from(tableName)
    .update(updateData)
    .eq('id', contract.id)

  if (error) {
    console.error('Webhook update error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Propagate to the linked animal_movement (if any) so its signature_status
  // matches the contract and the deferred animal status change is applied.
  // Only on terminal events. Abandonment contracts do NOT trigger a movement
  // automatically — the animal arrives physically later, the movement is
  // recorded then by an operator.
  const propagate =
    payload.event === 'document.completed' ||
    payload.event === 'document.rejected' ||
    (payload.event === 'document.signed' && finalEvent)
  if (propagate && !isAbandonment) {
    await finalizeMovementOnSignature({
      contractId: contract.id,
      contractType: isAdoption ? 'adoption' : 'foster',
      status: newStatus === 'signed' ? 'signed' : 'rejected',
    }).catch((err) => {
      console.error('Webhook: finalizeMovementOnSignature failed', err)
    })
  }

  // Pour les contrats d'abandon, on bascule le statut métier en "active" à la
  // signature complète (côté webhook au cas où le sync manuel n'est pas appelé).
  if (isAbandonment && propagate && newStatus === 'signed') {
    await admin
      .from('abandonment_contracts')
      .update({ status: 'active' })
      .eq('id', contract.id)
  }

  const type = isAdoption ? 'adoption' : isAbandonment ? 'abandonment' : 'foster'
  return NextResponse.json({ ok: true, contractId: contract.id, type, newStatus })
}
