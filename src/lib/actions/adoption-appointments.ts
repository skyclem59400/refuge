'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireEstablishment, requirePermission } from '@/lib/establishment/permissions'
import {
  DEFAULT_ADOPTION_APPOINTMENT_SETTINGS,
  type AdoptionAppointmentSettings,
  type WeekDayKey,
  type OpeningRange,
} from '@/lib/types/database'

// ============================================================
// SETTINGS — lecture / écriture
// ============================================================

export async function getAdoptionAppointmentSettings(): Promise<AdoptionAppointmentSettings> {
  const { establishmentId } = await requireEstablishment()
  const admin = createAdminClient()

  const { data } = await admin
    .from('establishments')
    .select('adoption_appointment_settings')
    .eq('id', establishmentId)
    .single()

  return normalizeSettings((data?.adoption_appointment_settings ?? null) as Partial<AdoptionAppointmentSettings> | null)
}

export async function updateAdoptionAppointmentSettings(settings: AdoptionAppointmentSettings) {
  try {
    const { establishmentId } = await requirePermission('manage_establishment')
    const supabase = await createClient()

    const normalized = normalizeSettings(settings)
    const validation = validateSettings(normalized)
    if (validation) return { error: validation }

    const { error } = await supabase
      .from('establishments')
      .update({ adoption_appointment_settings: normalized })
      .eq('id', establishmentId)

    if (error) return { error: error.message }

    revalidatePath('/etablissement')
    revalidatePath('/planning')
    return { success: true, settings: normalized }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ============================================================
// ALGO — calcul des créneaux disponibles
// ============================================================

export interface AvailableSlot {
  date: string // YYYY-MM-DD
  start_time: string // HH:MM
  end_time: string // HH:MM
  available_user_ids: string[]
}

export interface SlotComputationResult {
  settings: AdoptionAppointmentSettings
  slots: AvailableSlot[]
  fromDate: string
  toDate: string
}

/**
 * Calcule les créneaux ouverts à la réservation publique pour les RDV adoption.
 *
 * Algorithme :
 *  1. Pour chaque jour entre fromDate et toDate :
 *     - Skip si avant J+min_advance_days ou après J+max_advance_days
 *     - Skip si dans closed_dates ou pas d'horaires d'ouverture pour le jour de la semaine
 *  2. Pour chaque plage d'ouverture, découper en créneaux alignés (durée = slot_duration_minutes)
 *  3. Pour chaque créneau, intersecter avec staff_schedule des allowed_user_ids
 *  4. Soustraire les appointments existants (pending_validation/scheduled/confirmed)
 *  5. Garder uniquement les créneaux où ≥1 user autorisé est encore libre
 */
export async function getAvailableAdoptionSlots(args?: {
  fromDate?: string
  toDate?: string
}): Promise<SlotComputationResult> {
  const { establishmentId } = await requireEstablishment()
  const admin = createAdminClient()

  const settings = await getAdoptionAppointmentSettings()

  const today = todayInParis()
  const computedFrom = args?.fromDate ?? addDays(today, settings.min_advance_days)
  const computedTo = args?.toDate ?? addDays(today, settings.max_advance_days)

  if (!settings.enabled || settings.allowed_user_ids.length === 0) {
    return { settings, slots: [], fromDate: computedFrom, toDate: computedTo }
  }

  const [{ data: scheduleRows }, { data: existingAppts }] = await Promise.all([
    admin
      .from('staff_schedule')
      .select('user_id, date, start_time, end_time')
      .eq('establishment_id', establishmentId)
      .in('user_id', settings.allowed_user_ids)
      .gte('date', computedFrom)
      .lte('date', computedTo),
    admin
      .from('appointments')
      .select('assigned_user_id, date, start_time, end_time, status')
      .eq('establishment_id', establishmentId)
      .gte('date', computedFrom)
      .lte('date', computedTo)
      .in('status', ['pending_validation', 'scheduled', 'confirmed']),
  ])

  type SchedRow = { user_id: string; date: string; start_time: string; end_time: string }
  type ApptRow = { assigned_user_id: string | null; date: string; start_time: string; end_time: string }

  const schedules = (scheduleRows ?? []) as SchedRow[]
  const appts = (existingAppts ?? []) as ApptRow[]

  // Index schedules par date
  const schedulesByDate = new Map<string, SchedRow[]>()
  for (const s of schedules) {
    const arr = schedulesByDate.get(s.date) ?? []
    arr.push(s)
    schedulesByDate.set(s.date, arr)
  }

  // Index appointments par date
  const apptsByDate = new Map<string, ApptRow[]>()
  for (const a of appts) {
    const arr = apptsByDate.get(a.date) ?? []
    arr.push(a)
    apptsByDate.set(a.date, arr)
  }

  const slots: AvailableSlot[] = []
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
        const availableUserIds = settings.allowed_user_ids.filter((uid) => {
          const isOnShift = dailySchedules.some(
            (s) => s.user_id === uid && rangeContains(s.start_time, s.end_time, cand.start, cand.end),
          )
          if (!isOnShift) return false

          const hasOverlap = dailyAppts.some(
            (a) => a.assigned_user_id === uid && rangesOverlap(a.start_time, a.end_time, cand.start, cand.end),
          )
          return !hasOverlap
        })

        if (availableUserIds.length > 0) {
          slots.push({ date, start_time: cand.start, end_time: cand.end, available_user_ids: availableUserIds })
        }
      }
    }
  }

  return { settings, slots, fromDate: computedFrom, toDate: computedTo }
}

// ============================================================
// Helpers internes (testables, pas exportés en server action)
// ============================================================

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

function validateSettings(s: AdoptionAppointmentSettings): string | null {
  if (s.slot_duration_minutes < 15 || s.slot_duration_minutes > 240) {
    return 'La durée d\'un créneau doit être comprise entre 15 et 240 minutes.'
  }
  if (s.min_advance_days < 0 || s.min_advance_days > 60) {
    return 'Anticipation minimale incorrecte (0-60 jours).'
  }
  if (s.max_advance_days < s.min_advance_days || s.max_advance_days > 180) {
    return 'Anticipation maximale incorrecte (max 180 jours, >= anticipation min).'
  }
  for (const day of Object.keys(s.opening_hours) as WeekDayKey[]) {
    for (const r of s.opening_hours[day]) {
      if (!isHHMM(r.start) || !isHHMM(r.end)) {
        return `Horaire invalide pour ${day} (format HH:MM attendu).`
      }
      if (r.start >= r.end) {
        return `Plage horaire incohérente pour ${day} (début ≥ fin).`
      }
    }
  }
  return null
}

function isHHMM(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s)
}

function todayInParis(): string {
  const fmt = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' })
  return fmt.format(new Date())
}

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().split('T')[0]
}

function enumerateDates(fromIso: string, toIso: string): string[] {
  const result: string[] = []
  let cursor = fromIso
  while (cursor <= toIso) {
    result.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return result
}

function weekDayKey(isoDate: string): WeekDayKey {
  const [y, m, d] = isoDate.split('-').map(Number)
  // JS getUTCDay : 0=Sun, 1=Mon, ..., 6=Sat
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  const keys: WeekDayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  return keys[day]
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function sliceAligned(range: OpeningRange, durationMin: number): { start: string; end: string }[] {
  const startMin = timeToMinutes(range.start)
  const endMin = timeToMinutes(range.end)
  const out: { start: string; end: string }[] = []
  for (let cursor = startMin; cursor + durationMin <= endMin; cursor += durationMin) {
    out.push({ start: minutesToTime(cursor), end: minutesToTime(cursor + durationMin) })
  }
  return out
}

function rangeContains(outerStart: string, outerEnd: string, innerStart: string, innerEnd: string): boolean {
  return timeToMinutes(outerStart) <= timeToMinutes(innerStart) && timeToMinutes(outerEnd) >= timeToMinutes(innerEnd)
}

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return timeToMinutes(aStart) < timeToMinutes(bEnd) && timeToMinutes(bStart) < timeToMinutes(aEnd)
}
