import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

const RINGOVER_API_BASE = 'https://public-api.ringover.com/v2'
const SYNC_SECRET = process.env.RINGOVER_SYNC_SECRET || ''

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('x-sync-secret')
    const body = await request.json().catch(() => ({}))
    const establishmentId = body.establishment_id

    if (authHeader !== SYNC_SECRET && !establishmentId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()

    let query = supabase
      .from('ringover_connections')
      .select('*')
      .eq('is_active', true)
      .not('accueil_number', 'is', null)

    if (establishmentId) {
      query = query.eq('establishment_id', establishmentId)
    }

    const { data: connections } = await query
    if (!connections?.length) {
      return Response.json({ synced: 0, message: 'No active connections' })
    }

    let totalSynced = 0

    for (const conn of connections) {
      const now = new Date()
      const syncStart = conn.sync_cursor
        ? conn.sync_cursor
        : new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString()
      const apiKey = conn.api_key.trim()
      const accueilNumber = (conn.accueil_number || '').replace(/[^0-9+]/g, '')

      let offset = 0
      let latestCallTime = conn.sync_cursor || ''
      let connectionSynced = 0

      while (offset < 9000) {
        // Ringover API v2 GET /calls — query parameters
        const params = new URLSearchParams({
          start_date: syncStart,
          end_date: now.toISOString(),
          limit_count: '500',
          limit_offset: String(offset),
        })
        const response = await fetch(`${RINGOVER_API_BASE}/calls?${params}`, {
          method: 'GET',
          headers: {
            Authorization: apiKey,
          },
        })

        if (!response.ok) {
          console.error(`[Ringover Cron] API error for ${conn.establishment_id}:`, response.status)
          break
        }

        const apiBody = await response.json()
        const callList = apiBody?.call_list || apiBody?.calls || []
        if (!Array.isArray(callList) || callList.length === 0) break

        // Client-side filter to accueil number
        const filtered = callList.filter((call: Record<string, unknown>) => {
          if (!accueilNumber) return true
          const from = String(call.from_number || '').replace(/[^0-9+]/g, '')
          const to = String(call.to_number || '').replace(/[^0-9+]/g, '')
          return from.includes(accueilNumber) || to.includes(accueilNumber)
        })

        const records = filtered.map((call: Record<string, unknown>) => {
          const dir = call.direction === 'out' || call.direction === 'OUT' ? 'out' : 'in'
          const st = String(call.status || call.call_status || call.type || 'UNKNOWN').toUpperCase()
          return {
            establishment_id: conn.establishment_id,
            ringover_call_id: String(call.cdr_id || call.call_id || call.id || ''),
            direction: dir,
            status: st,
            caller_number: call.from_number || call.caller_number || null,
            caller_name: call.from_name || call.caller_name || call.contact_name || null,
            callee_number: call.to_number || call.callee_number || null,
            callee_name: call.to_name || call.callee_name || null,
            agent_id: call.agent_id ? String(call.agent_id) : null,
            agent_name: call.agent_name || null,
            start_time: call.start_date || call.start_time,
            end_time: call.end_date || call.end_time || null,
            duration: Number(call.duration) || 0,
            wait_time: Number(call.wait_time || call.waiting_duration) || 0,
            has_voicemail: Boolean(call.has_voicemail || call.voicemail),
            voicemail_url: call.voicemail_url || null,
            has_recording: Boolean(call.has_recording || call.recording),
            recording_url: call.recording_url || null,
            tags: call.tags || [],
            notes: call.notes || null,
            callback_needed: dir === 'in' && (st === 'MISSED' || st === 'VOICEMAIL'),
            raw_data: call,
            synced_at: new Date().toISOString(),
          }
        })

        if (records.length > 0) {
          await supabase
            .from('ringover_calls')
            .upsert(records, { onConflict: 'establishment_id,ringover_call_id', ignoreDuplicates: false })

          connectionSynced += records.length

          for (const r of records) {
            if (r.start_time && String(r.start_time) > latestCallTime) {
              latestCallTime = String(r.start_time)
            }
          }
        }

        if (callList.length < 500) break
        offset += 500
        await new Promise((resolve) => setTimeout(resolve, 600))
      }

      if (latestCallTime) {
        await supabase
          .from('ringover_connections')
          .update({ last_sync_at: new Date().toISOString(), sync_cursor: latestCallTime })
          .eq('id', conn.id)
      }

      totalSynced += connectionSynced
    }

    return Response.json({ synced: totalSynced })
  } catch (e) {
    console.error('[Ringover Sync] Error:', e)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
