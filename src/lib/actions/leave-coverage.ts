'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/establishment/permissions'
import type {
  EstablishmentMember,
  LeaveRequest,
  LeaveType,
  ContractType,
} from '@/lib/types/database'

function isMemberOnExtendedLeave(member: EstablishmentMember, day: string): boolean {
  if (member.availability_status !== 'on_extended_leave') return false
  if (member.extended_leave_from && day < member.extended_leave_from) return false
  if (member.extended_leave_until && day > member.extended_leave_until) return false
  return true
}

function dayInRange(day: string, start: string, end: string): boolean {
  return day >= start && day <= end
}

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export type CoverageStatus = 'ok' | 'tight' | 'below'

export interface CoverageAbsence {
  member_id: string
  contract_type: ContractType
  reason: 'extended_leave' | 'leave_approved' | 'leave_pending'
  leave_request_id?: string
  leave_type_id?: string
}

export interface CoverageDay {
  date: string
  weekday: number
  is_weekend: boolean
  active_salaried: string[]
  active_auto: string[]
  active_other: string[]
  absent: CoverageAbsence[]
  available_salaried_count: number
  available_total_count: number
  /** Effectif salarié total sous contrat ce jour (présents + absents salariés). */
  total_salaried_count: number
  threshold: number
  status_with_pending: CoverageStatus
  status_approved_only: CoverageStatus
}

export interface CoverageRangeResult {
  days: CoverageDay[]
  members: EstablishmentMember[]
  leave_types: LeaveType[]
  threshold: number
}

function statusFor(available: number, threshold: number): CoverageStatus {
  if (available < threshold) return 'below'
  if (available === threshold) return 'tight'
  return 'ok'
}

export async function getCoverageRange(params: {
  start_date: string
  end_date: string
}): Promise<{ data?: CoverageRangeResult; error?: string }> {
  try {
    const { establishmentId } = await requirePermission('manage_leaves')
    const admin = createAdminClient()

    const [estRes, membersRes, requestsRes, typesRes] = await Promise.all([
      admin
        .from('establishments')
        .select('min_daily_staff')
        .eq('id', establishmentId)
        .single(),
      admin
        .from('establishment_members')
        .select('*')
        .eq('establishment_id', establishmentId),
      admin
        .from('leave_requests')
        .select('*')
        .eq('establishment_id', establishmentId)
        .in('status', ['approved', 'pending'])
        .lte('start_date', params.end_date)
        .gte('end_date', params.start_date),
      admin
        .from('leave_types')
        .select('*')
        .eq('establishment_id', establishmentId)
        .eq('is_active', true),
    ])

    if (estRes.error) return { error: estRes.error.message }
    if (membersRes.error) return { error: membersRes.error.message }
    if (requestsRes.error) return { error: requestsRes.error.message }
    if (typesRes.error) return { error: typesRes.error.message }

    const threshold = estRes.data?.min_daily_staff ?? 3
    const members = (membersRes.data || []) as EstablishmentMember[]
    const requests = (requestsRes.data || []) as LeaveRequest[]
    const leaveTypes = (typesRes.data || []) as LeaveType[]

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

    const days: CoverageDay[] = []
    const start = new Date(params.start_date + 'T00:00:00')
    const end = new Date(params.end_date + 'T00:00:00')

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const day = ymd(d)
      const weekday = d.getDay()
      const is_weekend = weekday === 0 || weekday === 6

      const active_salaried: string[] = []
      const active_auto: string[] = []
      const active_other: string[] = []
      const absent: CoverageAbsence[] = []
      const absentIds = new Set<string>()

      for (const m of members) {
        if (isMemberOnExtendedLeave(m, day)) {
          absent.push({
            member_id: m.id,
            contract_type: m.contract_type,
            reason: 'extended_leave',
          })
          absentIds.add(m.id)
          continue
        }
        if (m.contract_type === 'salarie') active_salaried.push(m.id)
        else if (m.contract_type === 'auto_entrepreneur') active_auto.push(m.id)
        else active_other.push(m.id)
      }

      for (const r of requests) {
        if (!dayInRange(day, r.start_date, r.end_date)) continue
        if (absentIds.has(r.member_id)) continue
        const m = members.find((mm) => mm.id === r.member_id)
        if (!m) continue
        absent.push({
          member_id: m.id,
          contract_type: m.contract_type,
          reason: r.status === 'approved' ? 'leave_approved' : 'leave_pending',
          leave_request_id: r.id,
          leave_type_id: r.leave_type_id,
        })
      }

      const approvedAbsentIds = new Set(
        absent.filter((a) => a.reason !== 'leave_pending').map((a) => a.member_id)
      )
      const allAbsentIds = new Set(absent.map((a) => a.member_id))

      const salariedApprovedAvail = active_salaried.filter((id) => !approvedAbsentIds.has(id)).length
      const salariedWithPendingAvail = active_salaried.filter((id) => !allAbsentIds.has(id)).length
      const totalApprovedAvail =
        salariedApprovedAvail +
        active_auto.filter((id) => !approvedAbsentIds.has(id)).length +
        active_other.filter((id) => !approvedAbsentIds.has(id)).length

      // Effectif salarié total sous contrat ce jour-là :
      // présents (active_salaried) + absents salariés (arrêt long ou congé).
      const totalSalaried =
        active_salaried.length +
        absent.filter((a) => a.contract_type === 'salarie').length

      days.push({
        date: day,
        weekday,
        is_weekend,
        active_salaried,
        active_auto,
        active_other,
        absent,
        available_salaried_count: salariedApprovedAvail,
        available_total_count: totalApprovedAvail,
        total_salaried_count: totalSalaried,
        threshold,
        status_with_pending: statusFor(salariedWithPendingAvail, threshold),
        status_approved_only: statusFor(salariedApprovedAvail, threshold),
      })
    }

    return { data: { days, members, leave_types: leaveTypes, threshold } }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export interface CoverageImpactResult {
  days: CoverageDay[]
  worst_available_salaried: number
  threshold: number
  will_go_below: boolean
  member_is_salaried: boolean
}

/**
 * Salaried availability over the period of a single pending request, computed
 * as if that request were approved (other pending requests stay pending).
 */
export async function getCoverageImpactForRequest(
  requestId: string
): Promise<{ data?: CoverageImpactResult; error?: string }> {
  try {
    const { establishmentId } = await requirePermission('manage_leaves')
    const admin = createAdminClient()

    const { data: req, error: reqErr } = await admin
      .from('leave_requests')
      .select('*')
      .eq('id', requestId)
      .eq('establishment_id', establishmentId)
      .single()

    if (reqErr || !req) return { error: 'Demande non trouvee' }

    const range = await getCoverageRange({
      start_date: req.start_date,
      end_date: req.end_date,
    })
    if (range.error || !range.data) return { error: range.error || 'Erreur de calcul' }

    const member = range.data.members.find((m) => m.id === req.member_id)
    const memberIsSalaried = member?.contract_type === 'salarie'
    const threshold = range.data.threshold

    const days: CoverageDay[] = range.data.days.map((d) => {
      const approvedIds = new Set(
        d.absent.filter((a) => a.reason !== 'leave_pending').map((a) => a.member_id)
      )
      if (memberIsSalaried && member && d.active_salaried.includes(member.id)) {
        approvedIds.add(member.id)
      }
      const avail = d.active_salaried.filter((id) => !approvedIds.has(id)).length
      return { ...d, available_salaried_count: avail }
    })

    const worst =
      days.length === 0
        ? 0
        : days.reduce((min, d) => Math.min(min, d.available_salaried_count), Infinity)

    return {
      data: {
        days,
        worst_available_salaried: worst === Infinity ? 0 : worst,
        threshold,
        will_go_below: memberIsSalaried && worst < threshold,
        member_is_salaried: !!memberIsSalaried,
      },
    }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
