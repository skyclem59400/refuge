import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { jsonWithCors, preflightWithCors } from '@/lib/public/cors'
import {
  DEFAULT_ADOPTION_APPOINTMENT_SETTINGS,
  type AdoptionAppointmentSettings,
  type WeekDayKey,
  type OpeningRange,
} from '@/lib/types/database'

export const dynamic = 'force-dynamic'

export async function OPTIONS(req: NextRequest) {
  return preflightWithCors(req.headers.get('origin'))
}

/**
 * GET /api/public/adoption/slots?animal_id=<uuid>
 *
 * Retourne les créneaux disponibles pour l'établissement de l'animal donné.
 * Utilise la même mécanique que getAvailableAdoptionSlots côté CRM, mais
 * sans dépendre du contexte d'auth (calculé via service_role).
 */
export async function GET(req: NextRequest) {
  const origin = req.headers.get('origin')
  const url = new URL(req.url)
  const animalId = url.searchParams.get('animal_id')

  if (!animalId) {
    return jsonWithCors({ error: 'animal_id requis' }, origin, { status: 400 })
  }

  try {
    const admin = createAdminClient()

    // 1. Récupérer establishment_id de l'animal + settings
    const { data: animal } = await admin
      .from('animals')
      .select('establishment_id, adoptable, establishments!inner(id, adoption_appointment_settings)')
      .eq('id', animalId)
      .single()

    if (!animal) {
      return jsonWithCors({ error: 'Animal introuvable' }, origin, { status: 404 })
    }

    const row = animal as unknown as {
      establishment_id: string
      adoptable: boolean
      establishments: { id: string; adoption_appointment_settings: Partial<AdoptionAppointmentSettings> }
    }

    if (!row.adoptable) {
      return jsonWithCors({ error: 'Animal non adoptable' }, origin, { status: 403 })
    }

    const settings = normalizeSettings(row.establishments.adoption_appointment_settings)
    if (!settings.enabled || settings.allowed_user_ids.length === 0) {
      return jsonWithCors({ data: { slots: [], settings: publicSettings(settings) } }, origin)
    }

    const today = todayInParis()
    const computedFrom = addDays(today, settings.min_advance_days)
    const computedTo = addDays(today, settings.max_advance_days)

    const [{ data: scheduleRows }, { data: existingAppts }] = await Promise.all([
      admin
        .from('staff_schedule')
        .select('user_id, date, start_time, end_time')
        .eq('establishment_id', row.establishment_id)
        .in('user_id', settings.allowed_user_ids)
        .gte('date', computedFrom)
        .lte('date', computedTo),
      admin
        .from('appointments')
        .select('assigned_user_id, date, start_time, end_time, status')
        .eq('establishment_id', row.establishment_id)
        .gte('date', computedFrom)
        .lte('date', computedTo)
        .in('status', ['pending_validation', 'scheduled', 'confirmed']),
    ])

    type SchedRow = { user_id: string; date: string; start_time: string; end_time: string }
    type ApptRow = { assigned_user_id: string | null; date: string; start_time: string; end_time: string }

    const schedules = (scheduleRows ?? []) as SchedRow[]
    const appts = (existingAppts ?? []) as ApptRow[]

    const schedulesByDate = new Map<string, SchedRow[]>()
    for (const s of schedules) {
      const arr = schedulesByDate.get(s.date) ?? []
      arr.push(s)
      schedulesByDate.set(s.date, arr)
    }
    const apptsByDate = new Map<string, ApptRow[]>()
    for (const a of appts) {
      const arr = apptsByDate.get(a.date) ?? []
      arr.push(a)
      apptsByDate.set(a.date, arr)
    }

    const slots: Array<{ date: string; start_time: string; end_time: string }> = []
    const dates = enumerateDates(computedFrom, computedTo)

    for (const date of dates) {
      if (settings.closed_dates.includes(date)) continue
      const dayKey = weekDayKey(date)
      const dayRanges = settings.opening_hours[dayKey] ?? []
      if (dayRanges.length === 0) continue

      const dailySchedules = schedulesByDate.get(date) ?? []
      const dailyAppts = apptsByDate.get(date) ?? []

      for (const range of dayRanges) {
        const candidates = sliceAligned(range, settings.slot_duration_minutes)
        for (const cand of candidates) {
          const isAnyUserFree = settings.allowed_user_ids.some((uid) => {
            const onShift = dailySchedules.some(
              (s) => s.user_id === uid && rangeContains(s.start_time, s.end_time, cand.start, cand.end),
            )
            if (!onShift) return false
            const overlap = dailyAppts.some(
              (a) => a.assigned_user_id === uid && rangesOverlap(a.start_time, a.end_time, cand.start, cand.end),
            )
            return !overlap
          })
          if (isAnyUserFree) {
            slots.push({ date, start_time: cand.start.slice(0, 5), end_time: cand.end.slice(0, 5) })
          }
        }
      }
    }

    return jsonWithCors(
      {
        data: {
          slots,
          settings: publicSettings(settings),
          fromDate: computedFrom,
          toDate: computedTo,
        },
      },
      origin,
    )
  } catch (e) {
    return jsonWithCors({ error: (e as Error).message }, origin, { status: 500 })
  }
}

function publicSettings(s: AdoptionAppointmentSettings) {
  return {
    enabled: s.enabled,
    slot_duration_minutes: s.slot_duration_minutes,
    min_advance_days: s.min_advance_days,
    max_advance_days: s.max_advance_days,
    opening_hours: s.opening_hours,
  }
}

function normalizeSettings(input: Partial<AdoptionAppointmentSettings> | null): AdoptionAppointmentSettings {
  const base = DEFAULT_ADOPTION_APPOINTMENT_SETTINGS
  if (!input) return { ...base, opening_hours: { ...base.opening_hours } }
  return {
    enabled: input.enabled ?? base.enabled,
    allowed_user_ids: Array.isArray(input.allowed_user_ids) ? input.allowed_user_ids : [],
    slot_duration_minutes: input.slot_duration_minutes ?? base.slot_duration_minutes,
    min_advance_days: input.min_advance_days ?? base.min_advance_days,
    max_advance_days: input.max_advance_days ?? base.max_advance_days,
    opening_hours: {
      mon: input.opening_hours?.mon ?? base.opening_hours.mon,
      tue: input.opening_hours?.tue ?? base.opening_hours.tue,
      wed: input.opening_hours?.wed ?? base.opening_hours.wed,
      thu: input.opening_hours?.thu ?? base.opening_hours.thu,
      fri: input.opening_hours?.fri ?? base.opening_hours.fri,
      sat: input.opening_hours?.sat ?? base.opening_hours.sat,
      sun: input.opening_hours?.sun ?? base.opening_hours.sun,
    },
    closed_dates: Array.isArray(input.closed_dates) ? input.closed_dates : [],
  }
}

function todayInParis(): string {
  const fmt = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' })
  return fmt.format(new Date())
}
function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + n)
  return dt.toISOString().split('T')[0]
}
function enumerateDates(from: string, to: string): string[] {
  const out: string[] = []
  let c = from
  while (c <= to) {
    out.push(c)
    c = addDays(c, 1)
  }
  return out
}
function weekDayKey(iso: string): WeekDayKey {
  const [y, m, d] = iso.split('-').map(Number)
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  const keys: WeekDayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  return keys[day]
}
function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
function minToTime(m: number): string {
  const h = Math.floor(m / 60)
  const mn = m % 60
  return `${String(h).padStart(2, '0')}:${String(mn).padStart(2, '0')}`
}
function sliceAligned(r: OpeningRange, dur: number) {
  const s = timeToMin(r.start)
  const e = timeToMin(r.end)
  const out: { start: string; end: string }[] = []
  for (let c = s; c + dur <= e; c += dur) {
    out.push({ start: minToTime(c), end: minToTime(c + dur) })
  }
  return out
}
function rangeContains(oS: string, oE: string, iS: string, iE: string): boolean {
  return timeToMin(oS) <= timeToMin(iS) && timeToMin(oE) >= timeToMin(iE)
}
function rangesOverlap(aS: string, aE: string, bS: string, bE: string): boolean {
  return timeToMin(aS) < timeToMin(bE) && timeToMin(bS) < timeToMin(aE)
}
