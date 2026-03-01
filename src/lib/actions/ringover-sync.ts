'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireEstablishment, requirePermission } from '@/lib/establishment/permissions'
import type {
  RingoverCallRecord,
  RingoverDashboardStats,
  RingoverHourlyData,
  RingoverDailyData,
  RingoverCallbackItem,
  RingoverTopCaller,
} from '@/lib/types/database'

const RINGOVER_API_BASE = 'https://public-api.ringover.com/v2'

// ---------------------------------------------------------------------------
// Helper: compute date filter start from a period string
// ---------------------------------------------------------------------------

function periodStartDate(period: 'today' | '7d' | '30d' | 'all'): string | null {
  const now = new Date()
  switch (period) {
    case 'today': {
      const d = new Date(now)
      d.setHours(0, 0, 0, 0)
      return d.toISOString()
    }
    case '7d': {
      const d = new Date(now)
      d.setDate(d.getDate() - 7)
      return d.toISOString()
    }
    case '30d': {
      const d = new Date(now)
      d.setDate(d.getDate() - 30)
      return d.toISOString()
    }
    case 'all':
      return null
  }
}

// ---------------------------------------------------------------------------
// Helper: sleep for rate limiting
// ---------------------------------------------------------------------------

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// 1. syncRingoverCalls — full sync of calls from Ringover API
// ---------------------------------------------------------------------------

export async function syncRingoverCalls() {
  try {
    const { establishmentId } = await requirePermission('manage_establishment')
    const supabase = createAdminClient()

    // Get active connection with accueil_number
    const { data: conn, error: connError } = await supabase
      .from('ringover_connections')
      .select('*')
      .eq('establishment_id', establishmentId)
      .eq('is_active', true)
      .maybeSingle()

    if (connError) return { error: connError.message }
    if (!conn || !conn.accueil_number) {
      return { error: 'Aucune connexion Ringover active avec un numero d\'accueil configure.' }
    }

    // Determine start date: from sync_cursor or 15 days ago
    const now = new Date()
    let startDate: string
    if (conn.sync_cursor) {
      startDate = conn.sync_cursor
    } else {
      const fifteenDaysAgo = new Date(now)
      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15)
      startDate = fifteenDaysAgo.toISOString()
    }
    const endDate = now.toISOString()
    const apiKey = conn.api_key.trim()

    // ── Try multiple auth formats to find the working one ──
    const authFormats = [
      { label: 'raw', value: apiKey },
      { label: 'Bearer', value: `Bearer ${apiKey}` },
    ]
    let workingAuth: string | null = null
    let lastStatus = 0
    let lastBody = ''

    for (const fmt of authFormats) {
      const testResp = await fetch(`${RINGOVER_API_BASE}/calls`, {
        headers: { Authorization: fmt.value },
      })
      if (testResp.ok) {
        workingAuth = fmt.value
        const testData = await testResp.json()
        const testCalls = testData?.call_list || testData?.calls || []
        console.log(`[Ringover Sync] Auth OK with "${fmt.label}".`, Array.isArray(testCalls) ? testCalls.length : 0, 'calls')
        if (Array.isArray(testCalls) && testCalls.length > 0) {
          console.log('[Ringover Sync] Sample call:', JSON.stringify(testCalls[0]).slice(0, 600))
        }
        break
      }
      lastStatus = testResp.status
      lastBody = await testResp.text().catch(() => '')
      console.log(`[Ringover Sync] Auth "${fmt.label}" failed:`, testResp.status)
      await sleep(600)
    }

    if (!workingAuth) {
      return {
        error: `Cle API Ringover rejetee (${lastStatus}). Verifiez que la cle est valide dans Ringover Dashboard > Developpeur > Cle API. ${lastBody.slice(0, 100)}`,
      }
    }

    let offset = 0
    let totalCount = 0
    let latestCallTime: string | null = null

    while (true) {
      // Ringover API v2 GET /calls — query parameters
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        limit_count: '500',
        limit_offset: String(offset),
      })

      const url = `${RINGOVER_API_BASE}/calls?${params}`
      console.log('[Ringover Sync] Fetching offset', offset)

      const response = await fetch(url, {
        headers: { Authorization: workingAuth },
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        console.error('[Ringover Sync] API error:', response.status, errorText)
        return { error: `Erreur API Ringover (${response.status})` }
      }

      const body = await response.json()
      const callList = body?.call_list || body?.calls || []

      if (!Array.isArray(callList) || callList.length === 0) {
        // Log response structure on first empty page for debugging
        if (offset === 0) {
          console.log('[Ringover Sync] Empty response. Keys:', Object.keys(body))
        }
        break
      }

      // Log first call structure for debugging
      if (offset === 0 && callList.length > 0) {
        console.log('[Ringover Sync] First call keys:', Object.keys(callList[0]))
      }

      // Filter to only calls involving the accueil number (client-side filter)
      const accueilNumber = conn.accueil_number.replace(/[^0-9+]/g, '')
      const filteredCalls = callList.filter((call: Record<string, unknown>) => {
        const from = String(call.from_number || '').replace(/[^0-9+]/g, '')
        const to = String(call.to_number || '').replace(/[^0-9+]/g, '')
        // If no number filtering needed (API key scoped to user), keep all
        if (!accueilNumber) return true
        return from.includes(accueilNumber) || to.includes(accueilNumber)
          || from === accueilNumber || to === accueilNumber
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const records = filteredCalls.map((call: any) => {
        const direction = call.direction === 'out' || call.direction === 'OUT' ? 'out' : 'in'
        const rawStatus = String(call.status || call.call_status || call.type || 'UNKNOWN')
        const status = rawStatus.toUpperCase()
        const callStartTime = call.start_date || call.start_time

        return {
          establishment_id: establishmentId,
          ringover_call_id: String(call.cdr_id || call.call_id || call.id),
          direction,
          status,
          caller_number: call.from_number || call.caller_number || null,
          caller_name: call.from_name || call.caller_name || call.contact_name || null,
          callee_number: call.to_number || call.callee_number || null,
          callee_name: call.to_name || call.callee_name || null,
          agent_id: call.agent_id ? String(call.agent_id) : null,
          agent_name: call.agent_name || null,
          start_time: callStartTime,
          end_time: call.end_date || call.end_time || null,
          duration: Number(call.duration) || 0,
          wait_time: Number(call.wait_time || call.waiting_duration) || 0,
          has_voicemail: Boolean(call.has_voicemail || call.voicemail),
          voicemail_url: call.voicemail_url || null,
          has_recording: Boolean(call.has_recording || call.recording),
          recording_url: call.recording_url || null,
          tags: call.tags || [],
          notes: call.notes || null,
          callback_needed:
            direction === 'in' && (status === 'MISSED' || status === 'VOICEMAIL'),
          raw_data: call,
          synced_at: new Date().toISOString(),
        }
      })

      // Upsert batch (skip if no records after filtering)
      if (records.length > 0) {
        const { error: upsertError } = await supabase
          .from('ringover_calls')
          .upsert(records, { onConflict: 'establishment_id,ringover_call_id' })

        if (upsertError) {
          console.error('[Ringover Sync] Upsert error:', upsertError.message)
          return { error: `Erreur lors de l'enregistrement : ${upsertError.message}` }
        }

        totalCount += records.length

        // Track latest call time for cursor update
        for (const record of records) {
          if (record.start_time && (!latestCallTime || record.start_time > latestCallTime)) {
            latestCallTime = record.start_time
          }
        }
      }

      // Break conditions
      if (callList.length < 500) break
      offset += 500
      if (offset >= 9000) break

      // Rate limit: 600ms between batches
      await sleep(600)
    }

    // Update sync_cursor and last_sync_at on connection
    const updateData: Record<string, string> = {
      last_sync_at: now.toISOString(),
      updated_at: now.toISOString(),
    }
    if (latestCallTime) {
      updateData.sync_cursor = latestCallTime
    }

    await supabase
      .from('ringover_connections')
      .update(updateData)
      .eq('id', conn.id)

    revalidatePath('/appels')

    return { data: { synced: totalCount } }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ---------------------------------------------------------------------------
// 2. getRingoverAccueilStats — dashboard statistics
// ---------------------------------------------------------------------------

export async function getRingoverAccueilStats(
  period: 'today' | '7d' | '30d' | 'all' = '7d'
) {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    let query = supabase
      .from('ringover_calls')
      .select('*')
      .eq('establishment_id', establishmentId)

    const start = periodStartDate(period)
    if (start) {
      query = query.gte('start_time', start)
    }

    const { data: calls, error } = await query

    if (error) return { error: error.message }

    const allCalls = (calls || []) as RingoverCallRecord[]

    const inboundCalls = allCalls.filter((c) => c.direction === 'in')
    const totalCalls = allCalls.length
    const answeredCalls = inboundCalls.filter((c) => c.status === 'ANSWERED').length
    const missedCalls = inboundCalls.filter((c) => c.status === 'MISSED').length
    const voicemailCalls = inboundCalls.filter((c) => c.status === 'VOICEMAIL').length
    const outboundCalls = allCalls.filter((c) => c.direction === 'out').length

    const inboundTotal = inboundCalls.length
    const answerRate = inboundTotal > 0 ? (answeredCalls / inboundTotal) * 100 : 0
    const missedRate = inboundTotal > 0 ? (missedCalls / inboundTotal) * 100 : 0

    const answeredWithDuration = inboundCalls.filter(
      (c) => c.status === 'ANSWERED' && c.duration > 0
    )
    const avgDuration =
      answeredWithDuration.length > 0
        ? answeredWithDuration.reduce((sum, c) => sum + c.duration, 0) /
          answeredWithDuration.length
        : 0

    const callsWithWait = allCalls.filter((c) => c.wait_time > 0)
    const avgWaitTime =
      callsWithWait.length > 0
        ? callsWithWait.reduce((sum, c) => sum + c.wait_time, 0) / callsWithWait.length
        : 0

    const totalDuration = allCalls.reduce((sum, c) => sum + c.duration, 0)

    const callbacksPending = allCalls.filter(
      (c) => c.callback_needed && !c.callback_completed
    ).length

    const stats: RingoverDashboardStats = {
      totalCalls,
      answeredCalls,
      missedCalls,
      voicemailCalls,
      outboundCalls,
      answerRate: Math.round(answerRate * 10) / 10,
      missedRate: Math.round(missedRate * 10) / 10,
      avgDuration: Math.round(avgDuration),
      avgWaitTime: Math.round(avgWaitTime),
      totalDuration,
      callbacksPending,
    }

    return { data: stats }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ---------------------------------------------------------------------------
// 3. getRingoverAccueilCalls — filtered call list
// ---------------------------------------------------------------------------

export async function getRingoverAccueilCalls(filters?: {
  status?: string
  direction?: string
  search?: string
  limit?: number
}) {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    const limit = filters?.limit || 100

    let query = supabase
      .from('ringover_calls')
      .select('*')
      .eq('establishment_id', establishmentId)
      .order('start_time', { ascending: false })
      .limit(limit)

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    if (filters?.direction) {
      query = query.eq('direction', filters.direction)
    }

    if (filters?.search) {
      const s = `%${filters.search}%`
      query = query.or(`caller_number.ilike.${s},caller_name.ilike.${s}`)
    }

    const { data, error } = await query

    if (error) return { error: error.message }
    return { data: (data || []) as RingoverCallRecord[] }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ---------------------------------------------------------------------------
// 4. getRingoverCallbacks — pending callbacks
// ---------------------------------------------------------------------------

export async function getRingoverCallbacks() {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('ringover_calls')
      .select(
        'id, caller_number, caller_name, start_time, status, has_voicemail, voicemail_url, duration, wait_time, callback_completed, callback_notes'
      )
      .eq('establishment_id', establishmentId)
      .eq('callback_needed', true)
      .eq('callback_completed', false)
      .order('start_time', { ascending: false })
      .limit(50)

    if (error) return { error: error.message }
    return { data: (data || []) as RingoverCallbackItem[] }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ---------------------------------------------------------------------------
// 5. markRingoverCallback — mark a callback as completed
// ---------------------------------------------------------------------------

export async function markRingoverCallback(callId: string, notes?: string) {
  try {
    const { userId } = await requirePermission('manage_establishment')
    const supabase = createAdminClient()

    const { error } = await supabase
      .from('ringover_calls')
      .update({
        callback_completed: true,
        callback_completed_at: new Date().toISOString(),
        callback_completed_by: userId,
        callback_notes: notes || null,
      })
      .eq('id', callId)

    if (error) return { error: error.message }

    revalidatePath('/appels')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ---------------------------------------------------------------------------
// 6. dismissRingoverCallback — dismiss a callback (not needed)
// ---------------------------------------------------------------------------

export async function dismissRingoverCallback(callId: string) {
  try {
    await requirePermission('manage_establishment')
    const supabase = createAdminClient()

    const { error } = await supabase
      .from('ringover_calls')
      .update({ callback_needed: false })
      .eq('id', callId)

    if (error) return { error: error.message }

    revalidatePath('/appels')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ---------------------------------------------------------------------------
// 7. getRingoverHourlyDistribution — calls by hour of day
// ---------------------------------------------------------------------------

export async function getRingoverHourlyDistribution(
  period: '7d' | '30d' = '7d'
) {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    const start = periodStartDate(period)

    let query = supabase
      .from('ringover_calls')
      .select('start_time, status')
      .eq('establishment_id', establishmentId)
      .eq('direction', 'in')

    if (start) {
      query = query.gte('start_time', start)
    }

    const { data: calls, error } = await query

    if (error) return { error: error.message }

    // Initialize 24 hourly buckets
    const hourly: RingoverHourlyData[] = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      total: 0,
      answered: 0,
      missed: 0,
    }))

    for (const call of calls || []) {
      const hour = new Date(call.start_time).getHours()
      hourly[hour].total++
      if (call.status === 'ANSWERED') {
        hourly[hour].answered++
      } else if (call.status === 'MISSED' || call.status === 'VOICEMAIL') {
        hourly[hour].missed++
      }
    }

    return { data: hourly }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ---------------------------------------------------------------------------
// 8. getRingoverDailyTrend — calls by day
// ---------------------------------------------------------------------------

export async function getRingoverDailyTrend(days: number = 30) {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const { data: calls, error } = await supabase
      .from('ringover_calls')
      .select('start_time, status, wait_time')
      .eq('establishment_id', establishmentId)
      .eq('direction', 'in')
      .gte('start_time', startDate.toISOString())

    if (error) return { error: error.message }

    // Aggregate by date
    const dailyMap = new Map<
      string,
      { total: number; answered: number; missed: number; waitTimeSum: number; waitTimeCount: number }
    >()

    for (const call of calls || []) {
      const date = new Date(call.start_time).toISOString().split('T')[0]
      if (!dailyMap.has(date)) {
        dailyMap.set(date, { total: 0, answered: 0, missed: 0, waitTimeSum: 0, waitTimeCount: 0 })
      }
      const entry = dailyMap.get(date)!
      entry.total++
      if (call.status === 'ANSWERED') {
        entry.answered++
      } else if (call.status === 'MISSED' || call.status === 'VOICEMAIL') {
        entry.missed++
      }
      if (call.wait_time > 0) {
        entry.waitTimeSum += call.wait_time
        entry.waitTimeCount++
      }
    }

    // Sort by date ascending
    const daily: RingoverDailyData[] = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, entry]) => ({
        date,
        total: entry.total,
        answered: entry.answered,
        missed: entry.missed,
        avgWaitTime:
          entry.waitTimeCount > 0
            ? Math.round(entry.waitTimeSum / entry.waitTimeCount)
            : 0,
      }))

    return { data: daily }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ---------------------------------------------------------------------------
// 9. getRingoverTopCallers — most frequent callers
// ---------------------------------------------------------------------------

export async function getRingoverTopCallers(limit: number = 10) {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: calls, error } = await supabase
      .from('ringover_calls')
      .select('caller_number, caller_name, status, start_time')
      .eq('establishment_id', establishmentId)
      .eq('direction', 'in')
      .gte('start_time', thirtyDaysAgo.toISOString())

    if (error) return { error: error.message }

    // Group by caller_number
    const callerMap = new Map<
      string,
      {
        caller_name: string | null
        total_calls: number
        missed_calls: number
        last_call_time: string
      }
    >()

    for (const call of calls || []) {
      const num = call.caller_number
      if (!num) continue

      if (!callerMap.has(num)) {
        callerMap.set(num, {
          caller_name: call.caller_name,
          total_calls: 0,
          missed_calls: 0,
          last_call_time: call.start_time,
        })
      }

      const entry = callerMap.get(num)!
      entry.total_calls++
      if (call.status === 'MISSED' || call.status === 'VOICEMAIL') {
        entry.missed_calls++
      }
      // Update name if we have a more recent one
      if (call.caller_name && call.start_time > entry.last_call_time) {
        entry.caller_name = call.caller_name
      }
      if (call.start_time > entry.last_call_time) {
        entry.last_call_time = call.start_time
      }
    }

    // Sort by total_calls desc, slice to limit
    const topCallers: RingoverTopCaller[] = Array.from(callerMap.entries())
      .map(([caller_number, entry]) => ({
        caller_number,
        ...entry,
      }))
      .sort((a, b) => b.total_calls - a.total_calls)
      .slice(0, limit)

    return { data: topCallers }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ---------------------------------------------------------------------------
// 10. saveAccueilNumber — save the accueil phone number
// ---------------------------------------------------------------------------

export async function saveAccueilNumber(data: {
  accueil_number: string
  accueil_label?: string
}) {
  try {
    const { establishmentId } = await requirePermission('manage_establishment')
    const supabase = createAdminClient()

    const { error } = await supabase
      .from('ringover_connections')
      .update({
        accueil_number: data.accueil_number,
        accueil_label: data.accueil_label || null,
        updated_at: new Date().toISOString(),
      })
      .eq('establishment_id', establishmentId)

    if (error) return { error: error.message }

    revalidatePath('/appels')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
