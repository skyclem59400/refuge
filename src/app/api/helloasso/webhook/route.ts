import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

interface HelloAssoPaymentData {
  id: number
  amount: number
  date: string
  state: string
  payer: {
    firstName: string
    lastName: string
    email: string
    address?: string
    city?: string
    zipCode?: string
  }
  order: {
    id: number
    organizationSlug: string
  }
}

interface HelloAssoWebhookPayload {
  data: HelloAssoPaymentData
  eventType: 'Payment' | 'Order' | 'Form'
}

export async function POST(request: NextRequest) {
  try {
    const payload: HelloAssoWebhookPayload = await request.json()

    // Only process Payment events
    if (payload.eventType !== 'Payment') {
      return Response.json({ received: true, skipped: 'not a payment event' })
    }

    const payment = payload.data

    // Only process authorized payments
    if (payment.state !== 'Authorized') {
      return Response.json({ received: true, skipped: 'payment not authorized' })
    }

    const supabase = createAdminClient()
    const organizationSlug = payment.order.organizationSlug

    // Look up the active HelloAsso connection for this organization
    const { data: connection, error: connectionError } = await supabase
      .from('helloasso_connections')
      .select('establishment_id')
      .eq('organization_slug', organizationSlug)
      .eq('is_active', true)
      .single()

    if (connectionError || !connection) {
      console.error('[HelloAsso Webhook] No active connection found for organization:', organizationSlug)
      return Response.json(
        { error: 'No active connection found for this organization' },
        { status: 200 } // Return 200 to prevent HelloAsso retries
      )
    }

    const establishmentId = connection.establishment_id

    // Check for duplicate payment
    const { data: existing } = await supabase
      .from('donations')
      .select('id')
      .eq('helloasso_payment_id', payment.id)
      .single()

    if (existing) {
      return Response.json({ received: true, skipped: 'duplicate payment' })
    }

    // Get next CERFA number
    const { data: cerfaNumber, error: cerfaError } = await supabase.rpc('get_next_cerfa_number', {
      est_id: establishmentId,
    })

    if (cerfaError) {
      console.error('[HelloAsso Webhook] CERFA number error:', cerfaError.message)
      return Response.json(
        { error: 'Failed to generate CERFA number' },
        { status: 200 }
      )
    }

    // Build donor name
    const donorName = `${payment.payer.firstName} ${payment.payer.lastName}`.trim()

    // Insert donation
    const { error: insertError } = await supabase
      .from('donations')
      .insert({
        establishment_id: establishmentId,
        source: 'helloasso',
        payment_method: 'helloasso',
        nature: 'numeraire',
        helloasso_payment_id: payment.id,
        helloasso_order_id: payment.order.id,
        amount: payment.amount / 100, // HelloAsso amounts are in centimes
        date: payment.date,
        donor_name: donorName,
        donor_email: payment.payer.email || null,
        donor_address: payment.payer.address || null,
        donor_city: payment.payer.city || null,
        donor_postal_code: payment.payer.zipCode || null,
        cerfa_number: cerfaNumber,
        cerfa_generated: true,
        cerfa_generated_at: new Date().toISOString(),
      })

    if (insertError) {
      console.error('[HelloAsso Webhook] Insert error:', insertError.message)
      return Response.json(
        { error: 'Failed to insert donation' },
        { status: 200 }
      )
    }

    return Response.json({ received: true, created: true })
  } catch (e) {
    console.error('[HelloAsso Webhook] Error:', e)
    return Response.json(
      { error: 'Internal server error' },
      { status: 200 } // Return 200 to prevent HelloAsso retries on unrecoverable errors
    )
  }
}
