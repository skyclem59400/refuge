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
// Helpers for syncRingoverCalls
// ---------------------------------------------------------------------------

/** Extract URL from various shapes: string URL, object with .url/.link, nested .record_url */
function extractUrl(data: unknown): string | null {
  if (typeof data === 'string' && data.startsWith('http')) return data
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>
    if (typeof obj.url === 'string') return obj.url
    if (typeof obj.link === 'string') return obj.link
    if (typeof obj.record_url === 'string') return obj.record_url
  }
  return null
}

/** Derive call status from Ringover v2 fields */
function deriveCallStatus(call: Record<string, unknown>, direction: string): string {
  const lastState = String(call.last_state || '').toUpperCase()

  if (lastState.includes('VOICEMAIL')) return 'VOICEMAIL'
  if (lastState === 'MISSED' || lastState === 'ABANDONED' || (!call.is_answered && direction === 'in')) return 'MISSED'
  if (call.is_answered || lastState === 'ANSWERED') return 'ANSWERED'
  if (direction === 'out') return 'OUT'

  // Fallback to legacy fields
  if (call.status) return String(call.status).toUpperCase()
  return 'UNKNOWN'
}

/** Map a raw Ringover call to a DB record */
function mapCallToRecord(call: Record<string, unknown>, establishmentId: string) {
  const direction = call.direction === 'out' || call.direction === 'OUT' ? 'out' : 'in'
  const status = deriveCallStatus(call, direction)
  const lastState = String(call.last_state || '').toUpperCase()

  const voicemailData = call.voicemail
  const recordData = call.record
  const voicemailUrl = extractUrl(voicemailData) || (typeof call.voicemail_url === 'string' ? call.voicemail_url : null)
  const recordingUrl = extractUrl(recordData)
    || (typeof call.record_url === 'string' ? call.record_url : null)
    || (typeof call.record_link === 'string' ? call.record_link : null)
    || (typeof call.recording_url === 'string' ? call.recording_url : null)

  return {
    establishment_id: establishmentId,
    ringover_call_id: String(call.cdr_id || call.call_id || call.id),
    direction,
    status,
    caller_number: String(call.from_number || call.caller_number || '') || null,
    caller_name: String(call.from_name || call.caller_name || call.contact_name || '') || null,
    callee_number: String(call.to_number || call.callee_number || '') || null,
    callee_name: String(call.to_name || call.callee_name || '') || null,
    agent_id: call.agent_id ? String(call.agent_id) : null,
    agent_name: call.agent_name ? String(call.agent_name) : null,
    start_time: String(call.start_time || call.start_date || ''),
    end_time: (call.end_time || call.end_date) ? String(call.end_time || call.end_date) : null,
    duration: Math.round(Number(call.total_duration || call.incall_duration || call.duration) || 0),
    wait_time: Math.round(Number(call.queue_duration || call.wait_time || call.waiting_duration) || 0),
    has_voicemail: !!(voicemailData || lastState.includes('VOICEMAIL')),
    voicemail_url: voicemailUrl,
    has_recording: !!recordData,
    recording_url: recordingUrl,
    tags: (call.tags as string[]) || [],
    notes: (call.note || call.notes) ? String(call.note || call.notes) : null,
    callback_needed: direction === 'in' && (status === 'MISSED' || status === 'VOICEMAIL'),
    raw_data: call,
    synced_at: new Date().toISOString(),
  }
}

/** Log a successful auth test and optionally show the first call sample */
function logAuthSuccess(label: string, testCalls: unknown[]): void {
  console.log(`[Ringover Sync] Auth OK with "${label}".`, testCalls.length, 'calls')
  if (testCalls.length > 0) {
    console.log('[Ringover Sync] Sample call:', JSON.stringify(testCalls[0]).slice(0, 600))
  }
}

/** Log a failed auth attempt */
function logAuthFailure(label: string, status: number, body: string, keyPrefix: string): void {
  console.log(`[Ringover Sync] Auth "${label}" failed:`, status, 'body:', body.slice(0, 500))
  console.log(`[Ringover Sync] Key used (first 8 chars):`, keyPrefix + '...')
}

/** Try multiple auth formats against the Ringover API, return the working one */
async function findWorkingAuth(apiKey: string): Promise<{ auth: string | null; lastStatus: number; lastBody: string }> {
  const authFormats = [
    { label: 'raw', value: apiKey },
    { label: 'Bearer', value: `Bearer ${apiKey}` },
  ]
  let lastStatus = 0
  let lastBody = ''

  for (const fmt of authFormats) {
    const testResp = await fetch(`${RINGOVER_API_BASE}/calls`, {
      method: 'POST',
      headers: {
        Authorization: fmt.value,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ limit_count: 1 }),
    })

    if (!testResp.ok) {
      lastStatus = testResp.status
      lastBody = await testResp.text().catch(() => '')
      logAuthFailure(fmt.label, lastStatus, lastBody, fmt.value.slice(0, 8))
      await sleep(600)
      continue
    }

    const testData = await testResp.json()
    const testCalls = testData?.call_list || testData?.calls || []
    const callList = Array.isArray(testCalls) ? testCalls : []
    logAuthSuccess(fmt.label, callList)
    return { auth: fmt.value, lastStatus: 0, lastBody: '' }
  }

  return { auth: null, lastStatus, lastBody }
}

/** Filter calls by accueil number suffix match */
function filterCallsByAccueilNumber(callList: Record<string, unknown>[], accueilNumber: string): Record<string, unknown>[] {
  const accueilDigits = accueilNumber.replace(/[^0-9]/g, '')
  const accueilSuffix = accueilDigits.length >= 9 ? accueilDigits.slice(-9) : accueilDigits

  if (!accueilSuffix) return callList

  return callList.filter((call) => {
    const fromDigits = String(call.from_number || '').replace(/[^0-9]/g, '')
    const toDigits = String(call.to_number || '').replace(/[^0-9]/g, '')
    return fromDigits.endsWith(accueilSuffix) || toDigits.endsWith(accueilSuffix)
  })
}

// ---------------------------------------------------------------------------
// 1. syncRingoverCalls — full sync of calls from Ringover API
// ---------------------------------------------------------------------------

/** Compute the sync start date from cursor or default to 15 days ago */
function computeSyncStartDate(syncCursor: string | null, now: Date): string {
  if (syncCursor) return syncCursor
  const fifteenDaysAgo = new Date(now)
  fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15)
  return fifteenDaysAgo.toISOString()
}

/** Fetch a page of calls from Ringover API (POST with JSON body + cursor pagination) */
async function fetchCallsPage(
  startDate: string,
  lastIdReturned: number,
  auth: string,
  page: number
): Promise<{ callList: Record<string, unknown>[] | null; lastId: number; error?: string }> {
  const body: Record<string, unknown> = {
    start_date: startDate,
    limit_count: 500,
  }
  if (lastIdReturned > 0) {
    body.last_id_returned = lastIdReturned
  }

  console.log('[Ringover Sync] Fetching page', page, 'cursor:', lastIdReturned)

  const response = await fetch(`${RINGOVER_API_BASE}/calls`, {
    method: 'POST',
    headers: {
      Authorization: auth,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    console.error('[Ringover Sync] API error:', response.status, errorText)
    return { callList: null, lastId: 0, error: `Erreur API Ringover (${response.status})` }
  }

  const data = await response.json()
  const callList = data?.call_list || data?.calls || []

  if (!Array.isArray(callList) || callList.length === 0) {
    if (page === 0) console.log('[Ringover Sync] Empty response. Keys:', Object.keys(data))
    return { callList: null, lastId: 0 }
  }

  if (page === 0) console.log('[Ringover Sync] First call keys:', Object.keys(callList[0]))

  // Extract last cdr_id for cursor-based pagination
  const lastCall = callList[callList.length - 1] as Record<string, unknown>
  const lastId = Number(lastCall.cdr_id || lastCall.call_id || lastCall.id || 0)

  return { callList, lastId }
}

/** Upsert a batch of call records and track the latest call time */
async function upsertCallBatch(
  supabase: ReturnType<typeof createAdminClient>,
  records: ReturnType<typeof mapCallToRecord>[],
  latestCallTime: string | null
): Promise<{ latestCallTime: string | null; error?: string }> {
  if (records.length === 0) return { latestCallTime }

  const { error: upsertError } = await supabase
    .from('ringover_calls')
    .upsert(records, { onConflict: 'establishment_id,ringover_call_id' })

  if (upsertError) {
    console.error('[Ringover Sync] Upsert error:', upsertError.message)
    return { latestCallTime, error: `Erreur lors de l'enregistrement : ${upsertError.message}` }
  }

  let updated = latestCallTime
  for (const record of records) {
    if (record.start_time && (!updated || record.start_time > updated)) {
      updated = record.start_time
    }
  }
  return { latestCallTime: updated }
}

/** Fetch the active Ringover connection for the given establishment */
async function fetchActiveConnection(
  supabase: ReturnType<typeof createAdminClient>,
  establishmentId: string
) {
  const { data: conn, error: connError } = await supabase
    .from('ringover_connections')
    .select('*')
    .eq('establishment_id', establishmentId)
    .eq('is_active', true)
    .maybeSingle()

  if (connError) return { error: connError.message } as const
  if (!conn) return { error: 'Aucune connexion Ringover active.' } as const
  return { conn } as const
}

/** Build an error message when the Ringover API key is rejected */
function buildAuthErrorMessage(lastStatus: number, lastBody: string): string {
  return `Cle API Ringover rejetee (${lastStatus}). Verifiez que la cle est valide dans Ringover Dashboard > Developpeur > Cle API. ${lastBody.slice(0, 100)}`
}

/** Paginate through Ringover calls, upsert each batch, return totals */
async function syncAllCallPages(
  supabase: ReturnType<typeof createAdminClient>,
  establishmentId: string,
  startDate: string,
  auth: string,
  accueilNumber: string
): Promise<{ error?: string; totalCount: number; latestCallTime: string | null }> {
  let lastIdReturned = 0
  let totalCount = 0
  let latestCallTime: string | null = null
  let pageNum = 0
  const PAGE_SIZE = 500
  const MAX_PAGES = 20

  while (pageNum < MAX_PAGES) {
    const page = await fetchCallsPage(startDate, lastIdReturned, auth, pageNum)
    if (page.error) return { error: page.error, totalCount, latestCallTime }
    if (!page.callList) break

    const filteredCalls = filterCallsByAccueilNumber(page.callList, accueilNumber)
    const records = filteredCalls.map(call => mapCallToRecord(call, establishmentId))

    const batchResult = await upsertCallBatch(supabase, records, latestCallTime)
    if (batchResult.error) return { error: batchResult.error, totalCount, latestCallTime }

    latestCallTime = batchResult.latestCallTime
    totalCount += records.length

    const isLastPage = page.callList.length < PAGE_SIZE
    if (isLastPage || page.lastId === 0) break

    lastIdReturned = page.lastId
    pageNum++
    await sleep(600)
  }

  return { totalCount, latestCallTime }
}

/** Update the Ringover connection with the latest sync timestamp */
async function updateSyncCursor(
  supabase: ReturnType<typeof createAdminClient>,
  connId: string,
  now: Date,
  latestCallTime: string | null
) {
  const updateData: Record<string, string> = {
    last_sync_at: now.toISOString(),
    updated_at: now.toISOString(),
  }
  if (latestCallTime) updateData.sync_cursor = latestCallTime

  await supabase
    .from('ringover_connections')
    .update(updateData)
    .eq('id', connId)
}

export async function syncRingoverCalls() {
  try {
    const { establishmentId } = await requirePermission('manage_establishment')
    const supabase = createAdminClient()

    const connResult = await fetchActiveConnection(supabase, establishmentId)
    if ('error' in connResult) return { error: connResult.error }
    const { conn } = connResult

    const now = new Date()
    const startDate = computeSyncStartDate(conn.sync_cursor, now)

    const { auth: workingAuth, lastStatus, lastBody } = await findWorkingAuth(conn.api_key.trim())
    if (!workingAuth) {
      return { error: buildAuthErrorMessage(lastStatus, lastBody) }
    }

    const syncResult = await syncAllCallPages(supabase, establishmentId, startDate, workingAuth, conn.accueil_number || '')
    if (syncResult.error) return { error: syncResult.error }

    await updateSyncCursor(supabase, conn.id, now, syncResult.latestCallTime)

    revalidatePath('/appels')
    return { data: { synced: syncResult.totalCount } }
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
        'id, caller_number, caller_name, start_time, status, has_voicemail, voicemail_url, duration, wait_time, callback_completed, callback_notes, ai_summary, ai_sentiment'
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
  purge_calls?: boolean
}) {
  try {
    const { establishmentId } = await requirePermission('manage_establishment')
    const supabase = createAdminClient()

    // When changing number, purge old calls and reset cursor for full re-sync
    if (data.purge_calls !== false) {
      await supabase
        .from('ringover_calls')
        .delete()
        .eq('establishment_id', establishmentId)
    }

    const { error } = await supabase
      .from('ringover_connections')
      .update({
        accueil_number: data.accueil_number,
        accueil_label: data.accueil_label || null,
        sync_cursor: null,
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

// ---------------------------------------------------------------------------
// 11. debugRecordingData — check what `record` field contains in raw_data
// ---------------------------------------------------------------------------

export async function debugRecordingData() {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    const { data: calls } = await supabase
      .from('ringover_calls')
      .select('id, ringover_call_id, has_recording, recording_url, raw_data')
      .eq('establishment_id', establishmentId)
      .eq('has_recording', true)
      .order('start_time', { ascending: false })
      .limit(5)

    return {
      data: (calls || []).map((c) => ({
        id: c.id,
        ringover_call_id: c.ringover_call_id,
        has_recording: c.has_recording,
        recording_url: c.recording_url,
        raw_record_field: (c.raw_data as Record<string, unknown>)?.record,
        raw_record_type: typeof (c.raw_data as Record<string, unknown>)?.record,
        raw_record_url: (c.raw_data as Record<string, unknown>)?.record_url,
        raw_record_link: (c.raw_data as Record<string, unknown>)?.record_link,
        raw_recording_url: (c.raw_data as Record<string, unknown>)?.recording_url,
      })),
    }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ---------------------------------------------------------------------------
// 12. fetchAudioUrl — get recording/voicemail URL for a single call
// First checks raw_data, then falls back to Ringover API detail endpoint.
// ---------------------------------------------------------------------------

/** Extract recording and voicemail URLs from a call data object */
function extractAudioUrls(data: Record<string, unknown>): { recordingUrl: string | null; voicemailUrl: string | null } {
  const recordingUrl = extractUrl(data.record)
    || (typeof data.record_url === 'string' ? data.record_url : null)
    || (typeof data.record_link === 'string' ? data.record_link : null)
    || (typeof data.recording_url === 'string' ? data.recording_url : null)
  const voicemailUrl = extractUrl(data.voicemail)
    || (typeof data.voicemail_url === 'string' ? data.voicemail_url : null)
  return { recordingUrl, voicemailUrl }
}

/** Save discovered audio URLs to the DB and return the result */
async function saveAndReturnAudioUrls(
  supabase: ReturnType<typeof createAdminClient>,
  callId: string,
  recordingUrl: string | null,
  voicemailUrl: string | null
) {
  const updates: Record<string, string> = {}
  if (recordingUrl) updates.recording_url = recordingUrl
  if (voicemailUrl) updates.voicemail_url = voicemailUrl

  await supabase
    .from('ringover_calls')
    .update(updates)
    .eq('id', callId)

  revalidatePath('/appels')
  return { data: { recording_url: recordingUrl || voicemailUrl } }
}

/** Fetch call detail from Ringover API and extract audio URLs */
async function fetchCallDetailFromApi(
  supabase: ReturnType<typeof createAdminClient>,
  establishmentId: string,
  ringoverCallId: string
): Promise<{ error?: string; callDetail?: Record<string, unknown>; recordingUrl?: string | null; voicemailUrl?: string | null }> {
  const { data: conn } = await supabase
    .from('ringover_connections')
    .select('api_key')
    .eq('establishment_id', establishmentId)
    .single()

  if (!conn?.api_key) return { error: 'Connexion Ringover manquante' }

  const detailResp = await fetch(`${RINGOVER_API_BASE}/calls/${ringoverCallId}`, {
    headers: { Authorization: conn.api_key },
  })

  if (!detailResp.ok) return { error: `API Ringover ${detailResp.status}` }

  const detail = await detailResp.json()
  const callDetail = (detail?.call || detail) as Record<string, unknown>
  const { recordingUrl, voicemailUrl } = extractAudioUrls(callDetail)
  return { callDetail, recordingUrl, voicemailUrl }
}

/** Build a debug response when no audio URL could be found */
function buildNoAudioResponse(callDetail: Record<string, unknown>) {
  return {
    data: {
      recording_url: null,
      detail_keys: Object.keys(callDetail),
      record_field: callDetail.record,
      voicemail_field: callDetail.voicemail,
    },
  }
}

export async function fetchRecordingUrl(callId: string) {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    const { data: call } = await supabase
      .from('ringover_calls')
      .select('id, ringover_call_id, has_recording, has_voicemail, raw_data')
      .eq('id', callId)
      .eq('establishment_id', establishmentId)
      .single()

    if (!call) return { error: 'Appel introuvable' }

    // Step 1: Try to extract from existing raw_data
    const raw = (call.raw_data || {}) as Record<string, unknown>
    const { recordingUrl: recordingFromRaw, voicemailUrl: voicemailFromRaw } = extractAudioUrls(raw)
    const hasAudioInRawData = !!(recordingFromRaw || voicemailFromRaw)

    if (hasAudioInRawData) {
      return saveAndReturnAudioUrls(supabase, callId, recordingFromRaw, voicemailFromRaw)
    }

    // Step 2: Call Ringover API for fresh data
    const apiResult = await fetchCallDetailFromApi(supabase, establishmentId, call.ringover_call_id)
    if (apiResult.error) return { error: apiResult.error }

    const hasAudioFromApi = !!(apiResult.recordingUrl || apiResult.voicemailUrl)
    if (hasAudioFromApi) {
      return saveAndReturnAudioUrls(supabase, callId, apiResult.recordingUrl!, apiResult.voicemailUrl!)
    }

    return buildNoAudioResponse(apiResult.callDetail!)
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ---------------------------------------------------------------------------
// 13. Auto-sync configuration (Trigger.dev)
// ---------------------------------------------------------------------------

/** Get auto-sync config for current establishment */
export async function getAutoSyncConfig() {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('ringover_connections')
      .select('auto_sync_enabled, auto_sync_cron, auto_sync_schedule_id')
      .eq('establishment_id', establishmentId)
      .maybeSingle()

    if (error) return { error: error.message }
    return { data: data || { auto_sync_enabled: false, auto_sync_cron: '0 6 * * *', auto_sync_schedule_id: null } }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/** Toggle auto-sync and create/delete Trigger.dev schedule */
export async function toggleAutoSync(enabled: boolean, cron?: string) {
  try {
    const { establishmentId } = await requirePermission('manage_establishment')
    const supabase = createAdminClient()

    const { data: conn, error: connError } = await supabase
      .from('ringover_connections')
      .select('id, auto_sync_schedule_id')
      .eq('establishment_id', establishmentId)
      .single()

    if (connError || !conn) return { error: 'Connexion Ringover introuvable' }

    const triggerSecretKey = process.env.TRIGGER_SECRET_KEY
    if (!triggerSecretKey) {
      return { error: 'TRIGGER_SECRET_KEY non configure sur le serveur' }
    }

    const cronExpression = cron || '0 6 * * *'

    if (enabled) {
      // Create or update Trigger.dev schedule
      const schedulePayload: Record<string, unknown> = {
        task: 'ringover-daily-sync',
        cron: cronExpression,
        timezone: 'Europe/Paris',
        externalId: `ringover-${establishmentId}`,
        deduplicationKey: `ringover-auto-sync-${establishmentId}`,
      }

      const resp = await fetch('https://api.trigger.dev/api/v1/schedules', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${triggerSecretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(schedulePayload),
      })

      if (!resp.ok) {
        const errorText = await resp.text().catch(() => '')
        return { error: `Erreur Trigger.dev (${resp.status}): ${errorText.slice(0, 200)}` }
      }

      const schedule = await resp.json()
      const scheduleId = schedule.id || schedule.scheduleId

      await supabase
        .from('ringover_connections')
        .update({
          auto_sync_enabled: true,
          auto_sync_cron: cronExpression,
          auto_sync_schedule_id: scheduleId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conn.id)
    } else {
      // Delete Trigger.dev schedule if exists
      if (conn.auto_sync_schedule_id) {
        await fetch(`https://api.trigger.dev/api/v1/schedules/${conn.auto_sync_schedule_id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${triggerSecretKey}` },
        })
      }

      await supabase
        .from('ringover_connections')
        .update({
          auto_sync_enabled: false,
          auto_sync_schedule_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conn.id)
    }

    revalidatePath('/appels')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/** Update auto-sync cron schedule */
export async function updateAutoSyncCron(cron: string) {
  try {
    const { establishmentId } = await requirePermission('manage_establishment')
    const supabase = createAdminClient()

    const { data: conn, error: connError } = await supabase
      .from('ringover_connections')
      .select('id, auto_sync_enabled, auto_sync_schedule_id')
      .eq('establishment_id', establishmentId)
      .single()

    if (connError || !conn) return { error: 'Connexion Ringover introuvable' }
    if (!conn.auto_sync_enabled) return { error: 'Auto-sync non active' }

    // Re-create the schedule with new cron (deduplicationKey ensures replacement)
    return toggleAutoSync(true, cron)
  } catch (e) {
    return { error: (e as Error).message }
  }
}
