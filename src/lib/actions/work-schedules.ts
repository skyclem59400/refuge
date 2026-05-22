'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { requirePermission, requireEstablishment } from '@/lib/establishment/permissions'
import type { DayOfWeek, EstablishmentMember, MemberWorkSchedule } from '@/lib/types/database'

/**
 * Server actions de gestion des semaines types (member_work_schedules).
 *
 * - Le template est UNIQUE par (member_id, day_of_week) parmi les lignes courantes
 *   (uniq_mws_current : WHERE valid_until IS NULL).
 * - Pour la v1, on met à jour en place (pas de versioning). valid_from sert juste
 *   de traçabilité de la dernière modification.
 */

export interface DayScheduleInput {
  is_rest_day: boolean
  start_am: string | null
  end_am: string | null
  start_pm: string | null
  end_pm: string | null
}

export interface MemberWithSchedule {
  member: EstablishmentMember
  schedule: MemberWorkSchedule[]   // 0 à 7 lignes (manquantes = pas encore défini)
  weekly_hours: number
}

function hoursFromTime(start: string | null, end: string | null): number {
  if (!start || !end) return 0
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return (eh * 60 + em - (sh * 60 + sm)) / 60
}

function computeWeeklyHours(schedule: MemberWorkSchedule[]): number {
  let total = 0
  for (const day of schedule) {
    if (day.is_rest_day) continue
    total += hoursFromTime(day.start_am, day.end_am)
    total += hoursFromTime(day.start_pm, day.end_pm)
  }
  return Math.round(total * 100) / 100
}

/**
 * Récupère la semaine type courante d'un membre (filtre valid_until IS NULL).
 * Retourne 0 à 7 lignes (les jours non définis manquent).
 */
export async function getMemberWorkSchedule(
  memberId: string
): Promise<{ data?: { schedule: MemberWorkSchedule[]; weekly_hours: number }; error?: string }> {
  try {
    const { establishmentId } = await requireEstablishment()
    const admin = createAdminClient()

    const { data, error } = await admin
      .from('member_work_schedules')
      .select('*')
      .eq('member_id', memberId)
      .eq('establishment_id', establishmentId)
      .is('valid_until', null)
      .order('day_of_week')

    if (error) return { error: error.message }

    const schedule = (data || []) as MemberWorkSchedule[]
    return { data: { schedule, weekly_hours: computeWeeklyHours(schedule) } }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/**
 * Liste tous les membres "concernés par le CRA" (salaries + auto_entrepreneurs)
 * avec leur semaine type courante. Exclut les bénévoles et "autre".
 */
export async function listMembersWithSchedules(): Promise<{
  data?: MemberWithSchedule[]
  error?: string
}> {
  try {
    const { establishmentId } = await requirePermission('manage_leaves')
    const admin = createAdminClient()

    // Membres concernés
    const { data: membersData, error: membersErr } = await admin
      .from('establishment_members')
      .select('*')
      .eq('establishment_id', establishmentId)
      .in('contract_type', ['salarie', 'auto_entrepreneur'])
      .order('contract_type')

    if (membersErr) return { error: membersErr.message }
    const members = (membersData || []) as EstablishmentMember[]

    // Enrichir noms
    const userIds = members.map((m) => m.user_id).filter(Boolean)
    if (userIds.length > 0) {
      const { data: usersInfo } = await admin.rpc('get_users_info', { user_ids: userIds })
      if (usersInfo && Array.isArray(usersInfo)) {
        for (const u of usersInfo) {
          const m = members.find((mm) => mm.user_id === u.id)
          if (m) {
            m.full_name = u.full_name || null
            m.email = u.email || undefined
          }
        }
      }
    }

    // Schedules de tous les membres
    const memberIds = members.map((m) => m.id)
    const { data: schedulesData, error: schedErr } = await admin
      .from('member_work_schedules')
      .select('*')
      .in('member_id', memberIds)
      .is('valid_until', null)
      .order('day_of_week')

    if (schedErr) return { error: schedErr.message }

    const schedulesByMember = new Map<string, MemberWorkSchedule[]>()
    for (const row of (schedulesData || []) as MemberWorkSchedule[]) {
      const arr = schedulesByMember.get(row.member_id) || []
      arr.push(row)
      schedulesByMember.set(row.member_id, arr)
    }

    const result: MemberWithSchedule[] = members.map((m) => {
      const schedule = schedulesByMember.get(m.id) || []
      return { member: m, schedule, weekly_hours: computeWeeklyHours(schedule) }
    })

    return { data: result }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/**
 * Crée ou met à jour la semaine type d'un membre pour un jour donné.
 * Garde une seule ligne courante (valid_until IS NULL) par (member, day_of_week).
 */
export async function upsertWorkScheduleDay(
  memberId: string,
  dayOfWeek: DayOfWeek,
  payload: DayScheduleInput
): Promise<{ data?: MemberWorkSchedule; error?: string }> {
  try {
    const { establishmentId } = await requirePermission('manage_leaves')
    const admin = createAdminClient()

    // Validation : pas après 17h
    for (const t of [payload.end_am, payload.end_pm]) {
      if (t && t > '17:00') {
        return { error: "Aucun horaire ne peut dépasser 17h00 (règle SDA)." }
      }
    }
    if (payload.is_rest_day) {
      payload.start_am = null
      payload.end_am = null
      payload.start_pm = null
      payload.end_pm = null
    }

    // Existe-t-il déjà une ligne courante ?
    const { data: existing } = await admin
      .from('member_work_schedules')
      .select('id')
      .eq('member_id', memberId)
      .eq('day_of_week', dayOfWeek)
      .is('valid_until', null)
      .maybeSingle()

    if (existing?.id) {
      const { data, error } = await admin
        .from('member_work_schedules')
        .update({
          is_rest_day: payload.is_rest_day,
          start_am: payload.start_am,
          end_am: payload.end_am,
          start_pm: payload.start_pm,
          end_pm: payload.end_pm,
          valid_from: new Date().toISOString().slice(0, 10),
        })
        .eq('id', existing.id)
        .select()
        .single()
      if (error) return { error: error.message }
      return { data: data as MemberWorkSchedule }
    }

    const { data, error } = await admin
      .from('member_work_schedules')
      .insert({
        member_id: memberId,
        establishment_id: establishmentId,
        day_of_week: dayOfWeek,
        is_rest_day: payload.is_rest_day,
        start_am: payload.start_am,
        end_am: payload.end_am,
        start_pm: payload.start_pm,
        end_pm: payload.end_pm,
      })
      .select()
      .single()

    if (error) return { error: error.message }
    return { data: data as MemberWorkSchedule }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/**
 * Définit (ou supprime) l'horaire jours fériés d'un membre.
 * Si tous les champs sont null/'', le membre ne travaille pas les fériés (défaut).
 * Sinon, ces horaires s'appliquent à TOUS les jours fériés sauf override jour-par-jour.
 */
export async function upsertHolidaySchedule(
  memberId: string,
  payload: {
    start_am: string | null
    end_am: string | null
    start_pm: string | null
    end_pm: string | null
  }
): Promise<{ data?: true; error?: string }> {
  try {
    await requirePermission('manage_leaves')
    const admin = createAdminClient()

    // Validation max 17h
    for (const t of [payload.end_am, payload.end_pm]) {
      if (t && t > '17:00') {
        return { error: 'Aucun horaire ne peut dépasser 17h00 (règle SDA).' }
      }
    }

    const { error } = await admin
      .from('establishment_members')
      .update({
        holiday_start_am: payload.start_am || null,
        holiday_end_am: payload.end_am || null,
        holiday_start_pm: payload.start_pm || null,
        holiday_end_pm: payload.end_pm || null,
      })
      .eq('id', memberId)
    if (error) return { error: error.message }
    return { data: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/**
 * Applique l'horaire standard refuge (8-12 / 14-17) sur tous les jours sauf ceux
 * marqués repos. Utilitaire pour initialiser ou réinitialiser un collaborateur.
 */
export async function applyStandardSchedule(
  memberId: string,
  restDays: DayOfWeek[]
): Promise<{ data?: MemberWorkSchedule[]; error?: string }> {
  try {
    const result: MemberWorkSchedule[] = []
    for (let d = 0 as DayOfWeek; d <= 6; d = (d + 1) as DayOfWeek) {
      const isRest = restDays.includes(d)
      const r = await upsertWorkScheduleDay(memberId, d, {
        is_rest_day: isRest,
        start_am: isRest ? null : '08:00',
        end_am: isRest ? null : '12:00',
        start_pm: isRest ? null : '14:00',
        end_pm: isRest ? null : '17:00',
      })
      if (r.error) return { error: r.error }
      if (r.data) result.push(r.data)
    }
    return { data: result }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
