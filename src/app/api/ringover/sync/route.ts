import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { SupabaseClient } from '@supabase/supabase-js'

const RINGOVER_API_BASE = 'https://public-api.ringover.com/v2'
const SYNC_SECRET = process.env.RINGOVER_SYNC_SECRET || ''
const PAGE_SIZE = 500
const MAX_OFFSET = 9000
const THROTTLE_MS = 600

// ── Types ──

interface RingoverConnection {
  id: string
  establishment_id: string
  api_key: string
  accueil_number: string | null
  sync_cursor: string | null
  last_sync_at: string | null
}

type RawCall = Record<string, unknown>

interface CallRecord {
  establishment_id: string
  ringover_call_id: string
  direction: string
  status: string
  caller_number: unknown
  caller_name: unknown
  callee_number: unknown
  callee_name: unknown
  agent_id: string | null
  agent_name: unknown
  start_time: unknown
  end_time: unknown
  duration: number
  wait_time: number
  has_voicemail: boolean
  voicemail_url: unknown
  has_recording: boolean
  recording_url: unknown
  tags: unknown
  notes: unknown
  callback_needed: boolean
  raw_data: RawCall
  synced_at: string
}

// ── Helpers ──

function sanitizePhoneNumber(value: string | null | undefined): string {
  return (value || '').replace(/[^0-9+]/g, '')
}

function validateSyncRequest(authHeader: string | null, establishmentId: string | undefined): Response | null {
  if (authHeader !== SYNC_SECRET && !establishmentId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

async function fetchActiveConnections(
  supabase: SupabaseClient,
  establishmentId?: string
): Promise<RingoverConnection[] | null> {
  let query = supabase
    .from('ringover_connections')
    .select('*')
    .eq('is_active', true)
    .not('accueil_number', 'is', null)

  if (establishmentId) {
    query = query.eq('establishment_id', establishmentId)
  }

  const { data: connections } = await query
  return connections?.length ? (connections as RingoverConnection[]) : null
}

function computeSyncStart(conn: RingoverConnection, now: Date): string {
  return conn.sync_cursor
    ? conn.sync_cursor
    : new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString()
}

async function fetchCallPage(
  apiKey: string,
  syncStart: string,
  endDate: string,
  offset: number
): Promise<RawCall[] | null> {
  const params = new URLSearchParams({
    start_date: syncStart,
    end_date: endDate,
    limit_count: String(PAGE_SIZE),
    limit_offset: String(offset),
  })

  const response = await fetch(`${RINGOVER_API_BASE}/calls?${params}`, {
    method: 'GET',
    headers: { Authorization: apiKey },
  })

  if (!response.ok) return null

  const apiBody = await response.json()
  const callList = apiBody?.call_list || apiBody?.calls || []
  return Array.isArray(callList) && callList.length > 0 ? callList : null
}

function filterCallsByAccueil(calls: RawCall[], accueilNumber: string): RawCall[] {
  if (!accueilNumber) return calls
  return calls.filter((call) => {
    const from = sanitizePhoneNumber(String(call.from_number || ''))
    const to = sanitizePhoneNumber(String(call.to_number || ''))
    return from.includes(accueilNumber) || to.includes(accueilNumber)
  })
}

function mapCallToRecord(call: RawCall, establishmentId: string): CallRecord {
  const dir = call.direction === 'out' || call.direction === 'OUT' ? 'out' : 'in'
  const st = String(call.status || call.call_status || call.type || 'UNKNOWN').toUpperCase()
  return {
    establishment_id: establishmentId,
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
}

function findLatestCallTime(records: CallRecord[], currentLatest: string): string {
  let latest = currentLatest
  for (const r of records) {
    if (r.start_time && String(r.start_time) > latest) {
      latest = String(r.start_time)
    }
  }
  return latest
}

async function upsertRecords(supabase: SupabaseClient, records: CallRecord[]): Promise<void> {
  if (records.length === 0) return
  await supabase
    .from('ringover_calls')
    .upsert(records, { onConflict: 'establishment_id,ringover_call_id', ignoreDuplicates: false })
}

async function updateSyncCursor(supabase: SupabaseClient, connId: string, latestCallTime: string): Promise<void> {
  if (!latestCallTime) return
  await supabase
    .from('ringover_connections')
    .update({ last_sync_at: new Date().toISOString(), sync_cursor: latestCallTime })
    .eq('id', connId)
}

async function syncSingleConnection(
  supabase: SupabaseClient,
  conn: RingoverConnection
): Promise<number> {
  const now = new Date()
  const syncStart = computeSyncStart(conn, now)
  const apiKey = conn.api_key.trim()
  const accueilNumber = sanitizePhoneNumber(conn.accueil_number)

  let offset = 0
  let latestCallTime = conn.sync_cursor || ''
  let connectionSynced = 0

  while (offset < MAX_OFFSET) {
    const callList = await fetchCallPage(apiKey, syncStart, now.toISOString(), offset)
    if (!callList) break

    const filtered = filterCallsByAccueil(callList, accueilNumber)
    const records = filtered.map((call) => mapCallToRecord(call, conn.establishment_id))

    if (records.length > 0) {
      await upsertRecords(supabase, records)
      connectionSynced += records.length
      latestCallTime = findLatestCallTime(records, latestCallTime)
    }

    if (callList.length < PAGE_SIZE) break
    offset += PAGE_SIZE
    await new Promise((resolve) => setTimeout(resolve, THROTTLE_MS))
  }

  await updateSyncCursor(supabase, conn.id, latestCallTime)
  return connectionSynced
}

// ── Route Handler ──

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('x-sync-secret')
    const body = await request.json().catch(() => ({}))
    const establishmentId = body.establishment_id

    const authError = validateSyncRequest(authHeader, establishmentId)
    if (authError) return authError

    const supabase = createAdminClient()
    const connections = await fetchActiveConnections(supabase, establishmentId)
    if (!connections) {
      return Response.json({ synced: 0, message: 'No active connections' })
    }

    let totalSynced = 0
    for (const conn of connections) {
      totalSynced += await syncSingleConnection(supabase, conn)
    }

    return Response.json({ synced: totalSynced })
  } catch (e) {
    console.error('[Ringover Sync] Error:', e)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
