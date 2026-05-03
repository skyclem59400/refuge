import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/server'
import { downloadSignedPdf } from '@/lib/documenso/client'
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

  // Documents from Optimus carry an externalId. Adoption contracts are
  // namespaced with the "adoption_" prefix to differentiate from foster
  // contracts (which use the bare contract uuid).
  const externalId = payload.data?.externalId
  const isAdoption = typeof externalId === 'string' && externalId.startsWith('adoption_')
  const tableName: 'adoption_contracts' | 'foster_contracts' = isAdoption ? 'adoption_contracts' : 'foster_contracts'
  const bucketName: 'adoption-contracts' | 'foster-contracts' = isAdoption ? 'adoption-contracts' : 'foster-contracts'

  type ContractRow = { id: string; animal_id: string; signature_status: string; documenso_document_id: number | null }

  // Find the contract by Documenso document id (preferred) or by id from externalId.
  // We type the select results explicitly because Supabase narrows the runtime type to `never`
  // when the table name is a union literal and not a hardcoded string.
  let contract: ContractRow | null = null
  {
    const { data } = await admin
      .from(tableName)
      .select('id, animal_id, signature_status, documenso_document_id')
      .eq('documenso_document_id', documensoDocId)
      .maybeSingle<ContractRow>()
    contract = data
  }

  if (!contract && externalId) {
    const idLookup = isAdoption ? externalId.replace(/^adoption_/, '') : externalId
    const { data } = await admin
      .from(tableName)
      .select('id, animal_id, signature_status, documenso_document_id')
      .eq('id', idLookup)
      .maybeSingle<ContractRow>()
    contract = data
  }

  if (!contract) {
    return NextResponse.json({ ok: true, ignored: 'contract not found' })
  }

  const updateData: Record<string, unknown> = { signature_status: newStatus }

  const recipients = payload.data?.recipients ?? payload.data?.Recipient ?? []
  const firstSigned = recipients.find((r) => r.signedAt)
  if (firstSigned?.signedAt) {
    updateData.signed_at_via_documenso = firstSigned.signedAt
  }
  if (newStatus === 'viewed' && !updateData.signature_viewed_at) {
    updateData.signature_viewed_at = new Date().toISOString()
  }

  const finalEvent = payload.event === 'document.completed' || payload.event === 'document.signed'
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

  return NextResponse.json({ ok: true, contractId: contract.id, type: isAdoption ? 'adoption' : 'foster', newStatus })
}
