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

  // Find the contract by Documenso document id (or fallback on externalId)
  let contractQuery = admin
    .from('foster_contracts')
    .select('id, animal_id, signature_status, documenso_document_id')
    .eq('documenso_document_id', documensoDocId)
    .maybeSingle()

  let { data: contract } = await contractQuery

  if (!contract && payload.data?.externalId) {
    const { data: byExternal } = await admin
      .from('foster_contracts')
      .select('id, animal_id, signature_status, documenso_document_id')
      .eq('id', payload.data.externalId)
      .maybeSingle()
    contract = byExternal
  }

  if (!contract) {
    return NextResponse.json({ ok: true, ignored: 'contract not found' })
  }

  const updateData: Record<string, unknown> = { signature_status: newStatus }

  // Stamp viewed/signed timestamps from the recipient details if present
  const recipients = payload.data?.recipients ?? payload.data?.Recipient ?? []
  const firstSigned = recipients.find((r) => r.signedAt)
  if (firstSigned?.signedAt) {
    updateData.signed_at_via_documenso = firstSigned.signedAt
  }
  if (newStatus === 'viewed' && !updateData.signature_viewed_at) {
    updateData.signature_viewed_at = new Date().toISOString()
  }

  // Once signed, also fetch the signed PDF and stash its URL.
  // Only do this on completion events (not on every recipient signing) to
  // avoid downloading partial documents if multiple recipients exist.
  const finalEvent = payload.event === 'document.completed' || payload.event === 'document.signed'
  if (newStatus === 'signed' && finalEvent && contract.signature_status !== 'signed') {
    try {
      const buf = await downloadSignedPdf(documensoDocId)
      const fileName = `signed_${contract.id}_${Date.now()}.pdf`
      const { data: upload, error: uploadErr } = await admin.storage
        .from('foster-contracts')
        .upload(fileName, Buffer.from(buf), {
          contentType: 'application/pdf',
          upsert: false,
        })
      if (!uploadErr && upload) {
        const { data: pub } = admin.storage.from('foster-contracts').getPublicUrl(upload.path)
        updateData.signed_pdf_url = pub.publicUrl
      }
    } catch (e) {
      console.warn('Webhook: could not download signed PDF:', (e as Error).message)
    }
  }

  const { error } = await admin
    .from('foster_contracts')
    .update(updateData)
    .eq('id', contract.id)

  if (error) {
    console.error('Webhook update error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, contractId: contract.id, newStatus })
}
