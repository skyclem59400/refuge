import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()

    if (!payload.call_id) {
      return Response.json({ received: true, skipped: 'missing call_id' })
    }

    const supabase = createAdminClient()
    const targetNumber = payload.to_number || payload.from_number

    // Find establishment by matching number
    const { data: conn } = await supabase
      .from('ringover_connections')
      .select('establishment_id')
      .eq('is_active', true)
      .or(`accueil_number.eq.${targetNumber},astreinte_number.eq.${targetNumber}`)
      .maybeSingle()

    if (!conn) {
      return Response.json({ received: true, skipped: 'no matching connection' })
    }

    const dir = payload.direction === 'out' ? 'out' : 'in'
    const st = String(payload.status || 'UNKNOWN')

    await supabase
      .from('ringover_calls')
      .upsert(
        {
          establishment_id: conn.establishment_id,
          ringover_call_id: String(payload.call_id),
          direction: dir,
          status: st,
          caller_number: payload.from_number || null,
          caller_name: payload.from_name || null,
          callee_number: payload.to_number || null,
          callee_name: payload.to_name || null,
          agent_id: payload.agent_id ? String(payload.agent_id) : null,
          agent_name: payload.agent_name || null,
          start_time: payload.start_time || new Date().toISOString(),
          end_time: payload.end_time || null,
          duration: Number(payload.duration) || 0,
          wait_time: Number(payload.wait_time) || 0,
          has_voicemail: Boolean(payload.has_voicemail),
          voicemail_url: payload.voicemail_url || null,
          has_recording: Boolean(payload.has_recording),
          recording_url: payload.recording_url || null,
          tags: payload.tags || [],
          notes: payload.notes || null,
          callback_needed: dir === 'in' && (st === 'MISSED' || st === 'VOICEMAIL'),
          raw_data: payload,
          synced_at: new Date().toISOString(),
        },
        { onConflict: 'establishment_id,ringover_call_id', ignoreDuplicates: false }
      )

    return Response.json({ received: true, processed: true })
  } catch (e) {
    console.error('[Ringover Webhook] Error:', e)
    return Response.json({ error: 'Internal server error' }, { status: 200 })
  }
}
