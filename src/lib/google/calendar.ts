import 'server-only'
import { JWT } from 'google-auth-library'

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar'
const DEFAULT_TIME_ZONE = 'Europe/Paris'

/**
 * Whether Google Calendar sync is configured (service account key present).
 */
export function isGoogleCalendarConfigured(): boolean {
  return !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY
}

interface ServiceAccountCreds {
  client_email: string
  private_key: string
}

/**
 * Parse the service account JSON from env. Tolerates raw JSON or base64-encoded JSON.
 * Returns null if missing or unparseable.
 */
function parseServiceAccount(): ServiceAccountCreds | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!raw) return null

  let parsed: Record<string, unknown> | null = null
  try {
    parsed = JSON.parse(raw)
  } catch {
    try {
      const decoded = Buffer.from(raw, 'base64').toString('utf8')
      parsed = JSON.parse(decoded)
    } catch {
      return null
    }
  }

  if (!parsed || typeof parsed.client_email !== 'string' || typeof parsed.private_key !== 'string') {
    return null
  }

  return {
    client_email: parsed.client_email,
    private_key: parsed.private_key.replace(/\\n/g, '\n'),
  }
}

/**
 * Obtain an OAuth access token for the service account via JWT.
 * Returns null on any failure (never throws).
 */
async function getAccessToken(): Promise<string | null> {
  try {
    const creds = parseServiceAccount()
    if (!creds) return null

    const client = new JWT({
      email: creds.client_email,
      key: creds.private_key,
      scopes: [CALENDAR_SCOPE],
    })

    const { token } = await client.getAccessToken()
    return token || null
  } catch (e) {
    console.error('[google-calendar] failed to get access token', e)
    return null
  }
}

export interface CalendarEventInput {
  calendarId: string
  summary: string
  description?: string | null
  /** Local datetime like `2026-06-01T08:00:00` (no offset), interpreted with timeZone. */
  startDateTime: string
  /** Local datetime like `2026-06-01T08:00:00` (no offset), interpreted with timeZone. */
  endDateTime: string
  timeZone?: string
}

function buildEventBody(input: CalendarEventInput) {
  const timeZone = input.timeZone || DEFAULT_TIME_ZONE
  return {
    summary: input.summary,
    description: input.description ?? undefined,
    start: { dateTime: input.startDateTime, timeZone },
    end: { dateTime: input.endDateTime, timeZone },
  }
}

/**
 * Create or update a calendar event.
 * - Returns null if sync is not configured or calendarId is missing.
 * - If eventId is provided, PATCHes the event; on 404/410 retries as a create.
 * - On any other failure, logs and returns the original eventId (no throw).
 * - On success returns the event id.
 */
export async function upsertCalendarEvent(
  eventId: string | null,
  input: CalendarEventInput
): Promise<string | null> {
  if (!isGoogleCalendarConfigured() || !input.calendarId) return null

  try {
    const token = await getAccessToken()
    if (!token) return eventId

    const body = buildEventBody(input)
    const baseUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(input.calendarId)}/events`

    const doCreate = async (): Promise<string | null> => {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        console.error('[google-calendar] create event failed', res.status, await res.text())
        return eventId
      }
      const json = await res.json()
      return json.id ?? eventId
    }

    if (eventId) {
      const res = await fetch(`${baseUrl}/${encodeURIComponent(eventId)}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (res.status === 404 || res.status === 410) {
        // Event deleted upstream — recreate it.
        return doCreate()
      }
      if (!res.ok) {
        console.error('[google-calendar] update event failed', res.status, await res.text())
        return eventId
      }
      const json = await res.json()
      return json.id ?? eventId
    }

    return doCreate()
  } catch (e) {
    console.error('[google-calendar] upsert event error', e)
    return eventId
  }
}

/**
 * Delete a calendar event. Ignores 404/410, logs other failures, never throws.
 */
export async function deleteCalendarEvent(calendarId: string, eventId: string): Promise<void> {
  if (!isGoogleCalendarConfigured() || !calendarId || !eventId) return

  try {
    const token = await getAccessToken()
    if (!token) return

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }
    )

    if (res.ok || res.status === 404 || res.status === 410) return
    console.error('[google-calendar] delete event failed', res.status, await res.text())
  } catch (e) {
    console.error('[google-calendar] delete event error', e)
  }
}

/**
 * Ensure a Postgres time value (e.g. `08:00` or `08:00:00`) has seconds.
 */
function withSeconds(time: string): string {
  const parts = time.split(':')
  if (parts.length === 2) return `${time}:00`
  return time
}

/**
 * Build calendar event fields from a staff_schedule row + resolved member name.
 */
export function buildScheduleEventInput(params: {
  calendarId: string
  memberName?: string | null
  date: string
  start_time: string
  end_time: string
  notes?: string | null
}): CalendarEventInput {
  const name = params.memberName?.trim() || 'Présence'
  const summary = params.notes ? `${name} — ${params.notes}` : name
  return {
    calendarId: params.calendarId,
    summary,
    description: params.notes ?? undefined,
    startDateTime: `${params.date}T${withSeconds(params.start_time)}`,
    endDateTime: `${params.date}T${withSeconds(params.end_time)}`,
  }
}
