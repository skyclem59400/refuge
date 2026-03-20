import { schedules } from "@trigger.dev/sdk/v3"
import { createClient } from "@supabase/supabase-js"

const RINGOVER_API_BASE = "https://public-api.ringover.com/v2"

// ---------------------------------------------------------------------------
// Supabase admin client (service role — no RLS)
// ---------------------------------------------------------------------------

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Missing Supabase env vars")
  return createClient(url, key)
}

// ---------------------------------------------------------------------------
// Helpers (duplicated from ringover-sync.ts to keep trigger self-contained)
// ---------------------------------------------------------------------------

function extractUrl(data: unknown): string | null {
  if (typeof data === "string" && data.startsWith("http")) return data
  if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>
    if (typeof obj.url === "string") return obj.url
    if (typeof obj.link === "string") return obj.link
    if (typeof obj.record_url === "string") return obj.record_url
  }
  return null
}

function deriveCallStatus(call: Record<string, unknown>, direction: string): string {
  const lastState = String(call.last_state || "").toUpperCase()
  if (lastState.includes("VOICEMAIL")) return "VOICEMAIL"
  if (lastState === "MISSED" || lastState === "ABANDONED" || (!call.is_answered && direction === "in")) return "MISSED"
  if (call.is_answered || lastState === "ANSWERED") return "ANSWERED"
  if (direction === "out") return "OUT"
  if (call.status) return String(call.status).toUpperCase()
  return "UNKNOWN"
}

function mapCallToRecord(call: Record<string, unknown>, establishmentId: string) {
  const direction = call.direction === "out" || call.direction === "OUT" ? "out" : "in"
  const status = deriveCallStatus(call, direction)
  const lastState = String(call.last_state || "").toUpperCase()

  const voicemailUrl =
    extractUrl(call.voicemail) || (typeof call.voicemail_url === "string" ? call.voicemail_url : null)
  const recordingUrl =
    extractUrl(call.record) ||
    (typeof call.record_url === "string" ? call.record_url : null) ||
    (typeof call.record_link === "string" ? call.record_link : null) ||
    (typeof call.recording_url === "string" ? call.recording_url : null)

  return {
    establishment_id: establishmentId,
    ringover_call_id: String(call.cdr_id || call.call_id || call.id),
    direction,
    status,
    caller_number: String(call.from_number || call.caller_number || "") || null,
    caller_name: String(call.from_name || call.caller_name || call.contact_name || "") || null,
    callee_number: String(call.to_number || call.callee_number || "") || null,
    callee_name: String(call.to_name || call.callee_name || "") || null,
    agent_id: call.agent_id ? String(call.agent_id) : null,
    agent_name: call.agent_name ? String(call.agent_name) : null,
    start_time: String(call.start_time || call.start_date || ""),
    end_time: (call.end_time || call.end_date) ? String(call.end_time || call.end_date) : null,
    duration: Math.round(Number(call.total_duration || call.incall_duration || call.duration) || 0),
    wait_time: Math.round(Number(call.queue_duration || call.wait_time || call.waiting_duration) || 0),
    has_voicemail: !!(call.voicemail || lastState.includes("VOICEMAIL")),
    voicemail_url: voicemailUrl,
    has_recording: !!call.record,
    recording_url: recordingUrl,
    tags: (call.tags as string[]) || [],
    notes: (call.note || call.notes) ? String(call.note || call.notes) : null,
    callback_needed: direction === "in" && (status === "MISSED" || status === "VOICEMAIL"),
    raw_data: call,
    synced_at: new Date().toISOString(),
  }
}

function filterCallsByAccueilNumber(
  callList: Record<string, unknown>[],
  accueilNumber: string
): Record<string, unknown>[] {
  const accueilDigits = accueilNumber.replace(/[^0-9]/g, "")
  const accueilSuffix = accueilDigits.length >= 9 ? accueilDigits.slice(-9) : accueilDigits
  if (!accueilSuffix) return callList

  return callList.filter((call) => {
    const fromDigits = String(call.from_number || "").replace(/[^0-9]/g, "")
    const toDigits = String(call.to_number || "").replace(/[^0-9]/g, "")
    return fromDigits.endsWith(accueilSuffix) || toDigits.endsWith(accueilSuffix)
  })
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// Core sync logic
// ---------------------------------------------------------------------------

async function syncEstablishment(conn: {
  id: string
  establishment_id: string
  api_key: string
  accueil_number: string | null
  sync_cursor: string | null
}) {
  const supabase = getSupabase()
  const apiKey = conn.api_key.trim()

  // Compute start date
  let startDate: string
  if (conn.sync_cursor) {
    startDate = conn.sync_cursor
  } else {
    const fifteenDaysAgo = new Date()
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15)
    startDate = fifteenDaysAgo.toISOString()
  }

  // Find working auth format
  let workingAuth: string | null = null
  for (const auth of [apiKey, `Bearer ${apiKey}`]) {
    const resp = await fetch(`${RINGOVER_API_BASE}/calls`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({ limit_count: 1 }),
    })
    if (resp.ok) {
      workingAuth = auth
      break
    }
    await sleep(600)
  }

  if (!workingAuth) {
    throw new Error(`Cle API Ringover rejetee pour establishment ${conn.establishment_id}`)
  }

  // Paginate through calls
  let lastIdReturned = 0
  let totalCount = 0
  let latestCallTime: string | null = null
  let pageNum = 0

  while (pageNum < 20) {
    const body: Record<string, unknown> = { start_date: startDate, limit_count: 500 }
    if (lastIdReturned > 0) body.last_id_returned = lastIdReturned

    const response = await fetch(`${RINGOVER_API_BASE}/calls`, {
      method: "POST",
      headers: { Authorization: workingAuth, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => "")
      throw new Error(`Erreur API Ringover (${response.status}): ${errorText.slice(0, 200)}`)
    }

    const data = await response.json()
    const callList = data?.call_list || data?.calls || []
    if (!Array.isArray(callList) || callList.length === 0) break

    const filteredCalls = filterCallsByAccueilNumber(callList, conn.accueil_number || "")
    const records = filteredCalls.map((call) => mapCallToRecord(call, conn.establishment_id))

    if (records.length > 0) {
      const { error: upsertError } = await supabase
        .from("ringover_calls")
        .upsert(records, { onConflict: "establishment_id,ringover_call_id" })

      if (upsertError) {
        throw new Error(`Erreur upsert: ${upsertError.message}`)
      }

      for (const record of records) {
        if (record.start_time && (!latestCallTime || record.start_time > latestCallTime)) {
          latestCallTime = record.start_time
        }
      }
      totalCount += records.length
    }

    if (callList.length < 500) break
    const lastCall = callList[callList.length - 1] as Record<string, unknown>
    lastIdReturned = Number(lastCall.cdr_id || lastCall.call_id || lastCall.id || 0)
    if (lastIdReturned === 0) break
    pageNum++
    await sleep(600)
  }

  // Update sync cursor
  const now = new Date().toISOString()
  const updateData: Record<string, string> = { last_sync_at: now, updated_at: now }
  if (latestCallTime) updateData.sync_cursor = latestCallTime

  await supabase.from("ringover_connections").update(updateData).eq("id", conn.id)

  return { synced: totalCount, establishment_id: conn.establishment_id }
}

// ---------------------------------------------------------------------------
// Trigger.dev scheduled task
// ---------------------------------------------------------------------------

export const ringoverDailySync = schedules.task({
  id: "ringover-daily-sync",
  run: async (payload) => {
    const supabase = getSupabase()

    // Fetch all establishments with auto-sync enabled
    const { data: connections, error } = await supabase
      .from("ringover_connections")
      .select("id, establishment_id, api_key, accueil_number, sync_cursor")
      .eq("is_active", true)
      .eq("auto_sync_enabled", true)

    if (error) throw new Error(`DB error: ${error.message}`)
    if (!connections || connections.length === 0) {
      console.log("[Ringover Auto-Sync] No establishments with auto-sync enabled")
      return { synced: 0, establishments: 0 }
    }

    console.log(`[Ringover Auto-Sync] Syncing ${connections.length} establishment(s)...`)

    const results = []
    for (const conn of connections) {
      try {
        const result = await syncEstablishment(conn)
        results.push(result)
        console.log(`[Ringover Auto-Sync] ${conn.establishment_id}: ${result.synced} calls synced`)
      } catch (err) {
        console.error(`[Ringover Auto-Sync] ${conn.establishment_id} failed:`, err)
        results.push({ establishment_id: conn.establishment_id, error: String(err) })
      }
    }

    return {
      establishments: connections.length,
      results,
      timestamp: payload.timestamp,
    }
  },
})
