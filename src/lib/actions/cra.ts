'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/establishment/permissions'
import type { LeaveRequest, LeaveType, EstablishmentMember } from '@/lib/types/database'

/**
 * Compte-Rendu d'Activite mensuel d'un collaborateur :
 * un tableau jour par jour avec le statut (travaille / WE / ferie / conge / arret),
 * la duree absente (jours et heures), et la ventilation par type de conge.
 */

export type DayStatus =
  | { kind: 'worked'; date: string; weekday: number; is_weekend: boolean; is_holiday: boolean; hours_worked: number }
  | { kind: 'absent_full'; date: string; weekday: number; is_weekend: boolean; is_holiday: boolean; leave_type_id: string; leave_type_label: string; leave_status: 'approved' | 'pending' }
  | { kind: 'absent_half'; date: string; weekday: number; is_weekend: boolean; is_holiday: boolean; leave_type_id: string; leave_type_label: string; leave_status: 'approved' | 'pending'; half: 'start' | 'end' | 'both' }
  | { kind: 'absent_hours'; date: string; weekday: number; is_weekend: boolean; is_holiday: boolean; leave_type_id: string; leave_type_label: string; leave_status: 'approved' | 'pending'; start_time: string; end_time: string; hours: number }
  | { kind: 'weekend' | 'holiday'; date: string; weekday: number; is_weekend: boolean; is_holiday: boolean; holiday_name?: string }

export interface CraSummary {
  worked_days: number
  worked_hours: number
  absence_days_full: number
  absence_days_half: number
  absence_hours: number
  by_type: Array<{ leave_type_id: string; leave_type_label: string; color: string; days: number; hours: number }>
}

export interface MonthlyCra {
  member: { id: string; full_name: string | null; pseudo: string | null; contract_type: string; role_type: string }
  establishment: { id: string; name: string }
  year: number
  month: number // 1-12
  days: DayStatus[]
  summary: CraSummary
  generated_at: string
}

const STANDARD_DAY_HOURS = 7

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function dayInRange(day: string, start: string, end: string): boolean {
  return day >= start && day <= end
}

function hoursBetween(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return (eh * 60 + em - (sh * 60 + sm)) / 60
}

export async function getMonthlyCra(
  memberId: string,
  year: number,
  month: number
): Promise<{ data?: MonthlyCra; error?: string }> {
  try {
    const { establishmentId } = await requirePermission('manage_leaves')
    const admin = createAdminClient()

    const monthStart = new Date(year, month - 1, 1)
    const monthEnd = new Date(year, month, 0)
    const startISO = ymd(monthStart)
    const endISO = ymd(monthEnd)

    const [memberRes, estRes, requestsRes, typesRes, holidaysRes] = await Promise.all([
      admin
        .from('establishment_members')
        .select('*')
        .eq('id', memberId)
        .eq('establishment_id', establishmentId)
        .single(),
      admin
        .from('establishments')
        .select('id, name')
        .eq('id', establishmentId)
        .single(),
      admin
        .from('leave_requests')
        .select('*')
        .eq('establishment_id', establishmentId)
        .eq('member_id', memberId)
        .in('status', ['approved', 'pending'])
        .lte('start_date', endISO)
        .gte('end_date', startISO),
      admin
        .from('leave_types')
        .select('*')
        .eq('establishment_id', establishmentId),
      admin
        .from('public_holidays')
        .select('*')
        .gte('date', startISO)
        .lte('date', endISO),
    ])

    if (memberRes.error || !memberRes.data) return { error: 'Membre introuvable' }
    if (estRes.error || !estRes.data) return { error: 'Etablissement introuvable' }
    if (requestsRes.error) return { error: requestsRes.error.message }
    if (typesRes.error) return { error: typesRes.error.message }

    const member = memberRes.data as EstablishmentMember
    const establishment = estRes.data
    const requests = (requestsRes.data || []) as LeaveRequest[]
    const types = (typesRes.data || []) as LeaveType[]
    const typeMap = new Map(types.map((t) => [t.id, t]))
    const holidays = new Map<string, string>(
      ((holidaysRes.data || []) as Array<{ date: string; name?: string }>).map((h) => [
        h.date,
        h.name || 'Ferie',
      ])
    )

    // Enrich member name
    if (member.user_id) {
      const { data: usersInfo } = await admin.rpc('get_users_info', { user_ids: [member.user_id] })
      if (usersInfo && Array.isArray(usersInfo) && usersInfo[0]) {
        member.full_name = usersInfo[0].full_name || null
        member.email = usersInfo[0].email || undefined
      }
    }

    const days: DayStatus[] = []
    const summaryByType = new Map<
      string,
      { leave_type_id: string; leave_type_label: string; color: string; days: number; hours: number }
    >()
    let workedDays = 0
    let workedHours = 0
    let absenceDaysFull = 0
    let absenceDaysHalf = 0
    let absenceHours = 0

    for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
      const date = ymd(d)
      const weekday = d.getDay()
      const is_weekend = weekday === 0 || weekday === 6
      const holiday_name = holidays.get(date)
      const is_holiday = !!holiday_name

      // Extended leave overrides everything
      const onExtended =
        member.availability_status === 'on_extended_leave' &&
        (!member.extended_leave_from || date >= member.extended_leave_from) &&
        (!member.extended_leave_until || date <= member.extended_leave_until)

      if (is_holiday) {
        days.push({ kind: 'holiday', date, weekday, is_weekend, is_holiday: true, holiday_name })
        continue
      }
      if (is_weekend) {
        days.push({ kind: 'weekend', date, weekday, is_weekend: true, is_holiday: false })
        continue
      }
      if (onExtended) {
        const label = 'Arret longue duree'
        days.push({
          kind: 'absent_full',
          date,
          weekday,
          is_weekend: false,
          is_holiday: false,
          leave_type_id: 'extended_leave',
          leave_type_label: label,
          leave_status: 'approved',
        })
        absenceDaysFull += 1
        const existing = summaryByType.get('extended_leave')
        if (existing) {
          existing.days += 1
          existing.hours += STANDARD_DAY_HOURS
        } else {
          summaryByType.set('extended_leave', {
            leave_type_id: 'extended_leave',
            leave_type_label: label,
            color: '#a855f7',
            days: 1,
            hours: STANDARD_DAY_HOURS,
          })
        }
        continue
      }

      // Day-overlapping leave requests
      const sameDay = requests.filter((r) => dayInRange(date, r.start_date, r.end_date))

      if (sameDay.length === 0) {
        days.push({
          kind: 'worked',
          date,
          weekday,
          is_weekend: false,
          is_holiday: false,
          hours_worked: STANDARD_DAY_HOURS,
        })
        workedDays += 1
        workedHours += STANDARD_DAY_HOURS
        continue
      }

      const fullDayReq = sameDay.find((r) => r.granularity === 'full_day')
      const halfDayReq = sameDay.find((r) => r.granularity === 'half_day')
      const hourlyReqs = sameDay.filter((r) => r.granularity === 'hourly')

      const accountFor = (
        leave_type_id: string,
        label: string,
        color: string,
        dDays: number,
        dHours: number
      ) => {
        const cur = summaryByType.get(leave_type_id)
        if (cur) {
          cur.days += dDays
          cur.hours += dHours
        } else {
          summaryByType.set(leave_type_id, {
            leave_type_id,
            leave_type_label: label,
            color,
            days: dDays,
            hours: dHours,
          })
        }
      }

      if (fullDayReq) {
        const t = typeMap.get(fullDayReq.leave_type_id)
        const label = t?.name || 'Conge'
        days.push({
          kind: 'absent_full',
          date,
          weekday,
          is_weekend: false,
          is_holiday: false,
          leave_type_id: fullDayReq.leave_type_id,
          leave_type_label: label,
          leave_status: fullDayReq.status as 'approved' | 'pending',
        })
        absenceDaysFull += 1
        accountFor(fullDayReq.leave_type_id, label, t?.color || '#94a3b8', 1, STANDARD_DAY_HOURS)
        continue
      }

      if (halfDayReq) {
        const t = typeMap.get(halfDayReq.leave_type_id)
        const label = t?.name || 'Conge'
        const half: 'start' | 'end' | 'both' =
          halfDayReq.half_day_start && halfDayReq.half_day_end
            ? 'both'
            : halfDayReq.half_day_start
              ? 'start'
              : 'end'
        days.push({
          kind: 'absent_half',
          date,
          weekday,
          is_weekend: false,
          is_holiday: false,
          leave_type_id: halfDayReq.leave_type_id,
          leave_type_label: label,
          leave_status: halfDayReq.status as 'approved' | 'pending',
          half,
        })
        absenceDaysHalf += 1
        const portion = half === 'both' ? 1 : 0.5
        accountFor(
          halfDayReq.leave_type_id,
          label,
          t?.color || '#94a3b8',
          portion,
          portion * STANDARD_DAY_HOURS
        )
        workedHours += (1 - portion) * STANDARD_DAY_HOURS
        if (portion < 1) workedDays += 0.5
        continue
      }

      if (hourlyReqs.length > 0) {
        for (const hr of hourlyReqs) {
          const t = typeMap.get(hr.leave_type_id)
          const label = t?.name || 'Conge'
          const hours = hr.duration_hours
            ? Number(hr.duration_hours)
            : hr.start_time && hr.end_time
              ? hoursBetween(hr.start_time, hr.end_time)
              : 0
          days.push({
            kind: 'absent_hours',
            date,
            weekday,
            is_weekend: false,
            is_holiday: false,
            leave_type_id: hr.leave_type_id,
            leave_type_label: label,
            leave_status: hr.status as 'approved' | 'pending',
            start_time: hr.start_time || '',
            end_time: hr.end_time || '',
            hours,
          })
          absenceHours += hours
          accountFor(hr.leave_type_id, label, t?.color || '#94a3b8', 0, hours)
          workedHours += Math.max(0, STANDARD_DAY_HOURS - hours)
        }
        // Une journée avec arrêts horaires reste comptée comme travaillée (partiel)
        workedDays += 1
        continue
      }

      // Fallback (rare) — no recognised entry
      days.push({
        kind: 'worked',
        date,
        weekday,
        is_weekend: false,
        is_holiday: false,
        hours_worked: STANDARD_DAY_HOURS,
      })
      workedDays += 1
      workedHours += STANDARD_DAY_HOURS
    }

    const summary: CraSummary = {
      worked_days: Math.round(workedDays * 100) / 100,
      worked_hours: Math.round(workedHours * 100) / 100,
      absence_days_full: absenceDaysFull,
      absence_days_half: absenceDaysHalf,
      absence_hours: Math.round(absenceHours * 100) / 100,
      by_type: Array.from(summaryByType.values()).sort((a, b) => b.days - a.days),
    }

    return {
      data: {
        member: {
          id: member.id,
          full_name: member.full_name ?? null,
          pseudo: member.pseudo ?? null,
          contract_type: member.contract_type,
          role_type: member.role_type,
        },
        establishment: establishment as { id: string; name: string },
        year,
        month,
        days,
        summary,
        generated_at: new Date().toISOString(),
      },
    }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
