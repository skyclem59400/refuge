'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireEstablishment, requirePermission } from '@/lib/establishment/permissions'
import { logActivity } from '@/lib/actions/activity-log'
import { createNotification, notifyAdminsWithPermission } from '@/lib/actions/notifications'
import { getCoverageImpactForRequest } from '@/lib/actions/leave-coverage'
import { computeLeaveDays } from '@/lib/leaves/compute-days'
import type { LeaveGranularity, LeaveRequestStatus, MemberWorkSchedule } from '@/lib/types/database'

// ===========================================================================
// HELPERS
// ===========================================================================

/**
 * Check if the current user has the manage_leaves permission.
 * Returns true if they do, false otherwise (does not throw).
 */
async function hasManageLeavesPermission(): Promise<boolean> {
  try {
    await requirePermission('manage_leaves')
    return true
  } catch {
    return false
  }
}

function revalidateLeavePaths() {
  revalidatePath('/espace-collaborateur/conges')
  revalidatePath('/admin/conges')
}

/**
 * Charge la semaine type (jours de repos) + jours fériés et calcule
 * le nombre de jours de CP réellement décomptés du solde.
 *
 * Fallback si aucune semaine type définie : week-end standard (sam + dim).
 */
async function computeLeaveDaysFromDB(params: {
  memberId: string
  startDate: string
  endDate: string
  halfDayStart?: boolean
  halfDayEnd?: boolean
}): Promise<number> {
  const admin = createAdminClient()

  const [schedRes, holidaysRes] = await Promise.all([
    admin
      .from('member_work_schedules')
      .select('day_of_week, is_rest_day')
      .eq('member_id', params.memberId)
      .is('valid_until', null),
    admin
      .from('public_holidays')
      .select('date')
      .gte('date', params.startDate)
      .lte('date', params.endDate),
  ])

  const schedule = (schedRes.data || []) as Pick<MemberWorkSchedule, 'day_of_week' | 'is_rest_day'>[]
  const restWeekdays = schedule.length > 0
    ? schedule.filter((s) => s.is_rest_day).map((s) => s.day_of_week)
    : [0, 6] // fallback : samedi + dimanche

  const holidays = ((holidaysRes.data || []) as Array<{ date: string }>).map((h) => h.date)

  return computeLeaveDays({
    startDate: params.startDate,
    endDate: params.endDate,
    restWeekdays,
    holidays,
    halfDayStart: params.halfDayStart,
    halfDayEnd: params.halfDayEnd,
  })
}

/**
 * Server action exposée à l'UI : retourne le nombre de jours qui SERA décompté
 * pour une demande de congé. Permet aux formulaires d'afficher un aperçu juste
 * (déduction des fériés + jours de repos) avant la soumission.
 *
 * Si `memberId` est omis, on utilise le membership courant.
 */
export async function previewLeaveDaysCount(params: {
  memberId?: string
  startDate: string
  endDate: string
  halfDayStart?: boolean
  halfDayEnd?: boolean
}): Promise<{ data?: number; error?: string }> {
  try {
    const { membership } = await requireEstablishment()
    const memberId = params.memberId || membership.id
    const days = await computeLeaveDaysFromDB({
      memberId,
      startDate: params.startDate,
      endDate: params.endDate,
      halfDayStart: params.halfDayStart,
      halfDayEnd: params.halfDayEnd,
    })
    return { data: days }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ===========================================================================
// READ OPERATIONS (use createAdminClient)
// ===========================================================================

/**
 * Get all active leave types for the establishment
 */
export async function getLeaveTypes() {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('leave_types')
      .select('*')
      .eq('establishment_id', establishmentId)
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) return { error: error.message }
    return { data }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/**
 * Get leave balances, optionally filtered by member and year.
 * Users with manage_leaves see all balances; others see only their own.
 */
export async function getLeaveBalances(filters?: {
  memberId?: string
  year?: number
}) {
  try {
    const { establishmentId, membership } = await requirePermission('view_own_leaves')
    const supabase = createAdminClient()
    const isAdmin = await hasManageLeavesPermission()

    let query = supabase
      .from('leave_balances')
      .select('*, leave_type:leave_types(*)')
      .eq('establishment_id', establishmentId)

    if (filters?.year) {
      query = query.eq('year', filters.year)
    }

    if (filters?.memberId) {
      query = query.eq('member_id', filters.memberId)
    } else if (!isAdmin) {
      // Non-admin users can only see their own balances
      query = query.eq('member_id', membership.id)
    }

    const { data, error } = await query.order('year', { ascending: false })

    if (error) return { error: error.message }
    return { data }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/**
 * Get leave requests with optional filters.
 * Users with manage_leaves see all requests; others see only their own.
 */
export async function getLeaveRequests(filters?: {
  status?: LeaveRequestStatus
  memberId?: string
  year?: number
}) {
  try {
    const { establishmentId, membership } = await requirePermission('view_own_leaves')
    const supabase = createAdminClient()
    const isAdmin = await hasManageLeavesPermission()

    let query = supabase
      .from('leave_requests')
      .select('*')
      .eq('establishment_id', establishmentId)

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    if (filters?.memberId) {
      query = query.eq('member_id', filters.memberId)
    } else if (!isAdmin) {
      query = query.eq('member_id', membership.id)
    }

    if (filters?.year) {
      query = query.gte('start_date', `${filters.year}-01-01`)
        .lte('start_date', `${filters.year}-12-31`)
    }

    const { data: requests, error } = await query.order('created_at', { ascending: false })

    if (error) return { error: error.message }

    // Enrich with leave type info
    const leaveTypeIds = [...new Set((requests || []).map((r) => r.leave_type_id))]
    let leaveTypesMap: Record<string, unknown> = {}

    if (leaveTypeIds.length > 0) {
      const { data: leaveTypes } = await supabase
        .from('leave_types')
        .select('*')
        .in('id', leaveTypeIds)

      leaveTypesMap = Object.fromEntries(
        (leaveTypes || []).map((lt) => [lt.id, lt])
      )
    }

    const enriched = (requests || []).map((r) => ({
      ...r,
      leave_type: leaveTypesMap[r.leave_type_id] || null,
    }))

    return { data: enriched }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/**
 * Get the count of pending leave requests (for admin badge)
 */
export async function getPendingCount() {
  try {
    const { establishmentId } = await requirePermission('manage_leaves')
    const supabase = createAdminClient()

    const { count, error } = await supabase
      .from('leave_requests')
      .select('*', { count: 'exact', head: true })
      .eq('establishment_id', establishmentId)
      .eq('status', 'pending')

    if (error) return { error: error.message }
    return { data: count ?? 0 }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ===========================================================================
// WRITE OPERATIONS (use createClient)
// ===========================================================================

/**
 * Create a leave request for the current user
 */
export async function createLeaveRequest(data: {
  leave_type_id: string
  start_date: string
  end_date: string
  half_day_start?: boolean
  half_day_end?: boolean
  days_count: number
  granularity?: LeaveGranularity
  start_time?: string | null
  end_time?: string | null
  duration_hours?: number | null
  reason?: string
}) {
  try {
    const { establishmentId, membership } = await requirePermission('view_own_leaves')
    const supabase = await createClient()

    if (!data.leave_type_id || !data.start_date || !data.end_date) {
      return { error: 'Tous les champs obligatoires doivent etre remplis' }
    }

    if (data.start_date > data.end_date) {
      return { error: 'La date de debut doit etre avant la date de fin' }
    }

    const granularity: LeaveGranularity = data.granularity || 'full_day'

    if (granularity === 'hourly') {
      if (!data.start_time || !data.end_time) {
        return { error: 'Heure de debut et de fin obligatoires pour un arret horaire' }
      }
      if (data.start_date !== data.end_date) {
        return { error: 'Un arret horaire ne peut couvrir qu une seule journee' }
      }
    }

    // Calcul AUTORITAIRE côté serveur (déduit fériés + jours de repos hebdo).
    // On ignore la valeur transmise par le client pour éviter toute manipulation
    // et garantir la cohérence avec le solde de congés. Cas hourly = 0 (le solde
    // n'est pas en jours mais en heures, géré via duration_hours).
    const authoritativeDaysCount = granularity === 'hourly'
      ? 0
      : await computeLeaveDaysFromDB({
          memberId: membership.id,
          startDate: data.start_date,
          endDate: data.end_date,
          halfDayStart: data.half_day_start,
          halfDayEnd: data.half_day_end,
        })

    const { data: request, error } = await supabase
      .from('leave_requests')
      .insert({
        establishment_id: establishmentId,
        member_id: membership.id,
        leave_type_id: data.leave_type_id,
        start_date: data.start_date,
        end_date: data.end_date,
        half_day_start: data.half_day_start ?? false,
        half_day_end: data.half_day_end ?? false,
        days_count: authoritativeDaysCount,
        granularity,
        start_time: granularity === 'hourly' ? data.start_time : null,
        end_time: granularity === 'hourly' ? data.end_time : null,
        duration_hours: granularity === 'hourly' ? data.duration_hours ?? null : null,
        status: 'pending' as LeaveRequestStatus,
        reason: data.reason || null,
      })
      .select()
      .single()

    if (error) return { error: error.message }

    revalidateLeavePaths()

    logActivity({
      action: 'create',
      entityType: 'leave_request',
      entityId: request.id,
    })

    // Notify admins with manage_leaves permission
    notifyAdminsWithPermission({
      permission: 'manage_leaves',
      type: 'leave_request_submitted',
      title: 'Nouvelle demande de conge',
      body: `Une demande de conge du ${data.start_date} au ${data.end_date} a ete soumise (${authoritativeDaysCount} j décomptés).`,
      link: '/admin/conges',
    })

    return { data: request }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/**
 * Admin/manager creates a leave entry on behalf of a member.
 * Auto-approved (admin already validating by entering).
 */
export async function adminCreateLeaveRequest(data: {
  member_id: string
  leave_type_id: string
  start_date: string
  end_date: string
  half_day_start?: boolean
  half_day_end?: boolean
  days_count: number
  granularity?: LeaveGranularity
  start_time?: string | null
  end_time?: string | null
  duration_hours?: number | null
  reason?: string
  auto_approve?: boolean
}) {
  try {
    const { establishmentId, membership } = await requirePermission('manage_leaves')
    const adminClient = createAdminClient()

    if (!data.member_id || !data.leave_type_id || !data.start_date || !data.end_date) {
      return { error: 'Membre, type et periode obligatoires' }
    }
    if (data.start_date > data.end_date) {
      return { error: 'La date de debut doit etre avant la date de fin' }
    }

    const granularity: LeaveGranularity = data.granularity || 'full_day'
    if (granularity === 'hourly') {
      if (!data.start_time || !data.end_time) {
        return { error: 'Heures obligatoires pour un arret horaire' }
      }
      if (data.start_date !== data.end_date) {
        return { error: 'Un arret horaire ne couvre qu une seule journee' }
      }
    }

    const autoApprove = data.auto_approve ?? true
    const status: LeaveRequestStatus = autoApprove ? 'approved' : 'pending'

    // Calcul AUTORITAIRE côté serveur (cf. createLeaveRequest)
    const authoritativeDaysCount = granularity === 'hourly'
      ? 0
      : await computeLeaveDaysFromDB({
          memberId: data.member_id,
          startDate: data.start_date,
          endDate: data.end_date,
          halfDayStart: data.half_day_start,
          halfDayEnd: data.half_day_end,
        })

    const { data: row, error } = await adminClient
      .from('leave_requests')
      .insert({
        establishment_id: establishmentId,
        member_id: data.member_id,
        leave_type_id: data.leave_type_id,
        start_date: data.start_date,
        end_date: data.end_date,
        half_day_start: data.half_day_start ?? false,
        half_day_end: data.half_day_end ?? false,
        days_count: authoritativeDaysCount,
        granularity,
        start_time: granularity === 'hourly' ? data.start_time : null,
        end_time: granularity === 'hourly' ? data.end_time : null,
        duration_hours: granularity === 'hourly' ? data.duration_hours ?? null : null,
        status,
        reason: data.reason || null,
        reviewed_by: autoApprove ? membership.id : null,
        reviewed_at: autoApprove ? new Date().toISOString() : null,
        admin_comment: autoApprove ? '[Saisie admin]' : null,
      })
      .select()
      .single()

    if (error) return { error: error.message }

    if (autoApprove) {
      const { data: lt } = await adminClient
        .from('leave_types')
        .select('deducts_balance')
        .eq('id', data.leave_type_id)
        .single()

      if (lt?.deducts_balance && granularity !== 'hourly') {
        const year = new Date(data.start_date).getFullYear()
        const { data: balance } = await adminClient
          .from('leave_balances')
          .select('id, used')
          .eq('member_id', data.member_id)
          .eq('leave_type_id', data.leave_type_id)
          .eq('year', year)
          .single()
        if (balance) {
          await adminClient
            .from('leave_balances')
            .update({ used: balance.used + authoritativeDaysCount })
            .eq('id', balance.id)
        }
      }
    }

    revalidateLeavePaths()
    logActivity({
      action: 'create',
      entityType: 'leave_request',
      entityId: row.id,
      details: { admin_created: true, granularity, status },
    })

    return { data: row }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/**
 * Recalcule `days_count` d'une demande existante en appliquant la règle métier
 * mise à jour (déduction des fériés et jours de repos hebdo).
 *
 * Si la demande est `approved` et que le type déduit le solde, ajuste également
 * `leave_balances.used` du delta nécessaire. Idempotent : peut être appelée
 * plusieurs fois, le delta sera 0 si déjà à jour.
 */
export async function recomputeLeaveRequestDays(
  requestId: string
): Promise<{
  data?: { previous_days: number; new_days: number; balance_adjusted: boolean }
  error?: string
}> {
  try {
    await requirePermission('manage_leaves')
    const admin = createAdminClient()

    const { data: req, error: reqErr } = await admin
      .from('leave_requests')
      .select('id, member_id, leave_type_id, start_date, end_date, half_day_start, half_day_end, granularity, days_count, status')
      .eq('id', requestId)
      .single()
    if (reqErr || !req) return { error: 'Demande de congé introuvable' }
    if (req.granularity === 'hourly') {
      return { error: 'Recalcul non applicable à un arrêt horaire (durée en heures, pas en jours).' }
    }

    const newDays = await computeLeaveDaysFromDB({
      memberId: req.member_id,
      startDate: req.start_date,
      endDate: req.end_date,
      halfDayStart: req.half_day_start,
      halfDayEnd: req.half_day_end,
    })

    const previousDays = Number(req.days_count) || 0
    const delta = newDays - previousDays

    if (delta === 0) {
      return { data: { previous_days: previousDays, new_days: newDays, balance_adjusted: false } }
    }

    // Maj de la demande
    const { error: updErr } = await admin
      .from('leave_requests')
      .update({ days_count: newDays })
      .eq('id', requestId)
    if (updErr) return { error: updErr.message }

    // Ajustement du solde si demande approuvée et type déductible
    let balanceAdjusted = false
    if (req.status === 'approved') {
      const { data: lt } = await admin
        .from('leave_types')
        .select('deducts_balance')
        .eq('id', req.leave_type_id)
        .single()
      if (lt?.deducts_balance) {
        const year = new Date(req.start_date).getFullYear()
        const { data: balance } = await admin
          .from('leave_balances')
          .select('id, used')
          .eq('member_id', req.member_id)
          .eq('leave_type_id', req.leave_type_id)
          .eq('year', year)
          .single()
        if (balance) {
          await admin
            .from('leave_balances')
            .update({ used: Math.max(0, Number(balance.used) + delta) })
            .eq('id', balance.id)
          balanceAdjusted = true
        }
      }
    }

    revalidateLeavePaths()
    logActivity({
      action: 'update',
      entityType: 'leave_request',
      entityId: requestId,
      details: { recompute: true, previous_days: previousDays, new_days: newDays, delta, balance_adjusted: balanceAdjusted },
    })

    return { data: { previous_days: previousDays, new_days: newDays, balance_adjusted: balanceAdjusted } }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/**
 * Cancel own pending leave request
 */
export async function cancelLeaveRequest(id: string) {
  try {
    const { establishmentId, membership } = await requirePermission('view_own_leaves')
    const supabase = await createClient()
    const adminClient = createAdminClient()

    // Verify ownership and status
    const { data: existing, error: fetchError } = await adminClient
      .from('leave_requests')
      .select('*')
      .eq('id', id)
      .eq('establishment_id', establishmentId)
      .eq('member_id', membership.id)
      .single()

    if (fetchError || !existing) {
      return { error: 'Demande non trouvee' }
    }

    if (existing.status !== 'pending') {
      return { error: 'Seules les demandes en attente peuvent etre annulees' }
    }

    const { error } = await supabase
      .from('leave_requests')
      .update({ status: 'cancelled' as LeaveRequestStatus })
      .eq('id', id)
      .eq('member_id', membership.id)

    if (error) return { error: error.message }

    revalidateLeavePaths()

    logActivity({
      action: 'update',
      entityType: 'leave_request',
      entityId: id,
      details: { status: 'cancelled' },
    })

    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/**
 * Approve a leave request (admin).
 * If the approval would drop salaried staffing below the establishment threshold,
 * returns `{ below_threshold: true, ... }` unless `options.force` is set.
 */
export async function approveLeaveRequest(
  id: string,
  comment?: string,
  options?: { force?: boolean }
): Promise<
  | { success: true; forced?: boolean }
  | {
      error: string
      below_threshold?: boolean
      worst_available_salaried?: number
      threshold?: number
    }
> {
  try {
    const { establishmentId, membership } = await requirePermission('manage_leaves')
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: request, error: fetchError } = await adminClient
      .from('leave_requests')
      .select('*')
      .eq('id', id)
      .eq('establishment_id', establishmentId)
      .single()

    if (fetchError || !request) {
      return { error: 'Demande non trouvee' }
    }

    if (request.status !== 'pending') {
      return { error: 'Cette demande a deja ete traitee' }
    }

    if (!options?.force) {
      const impact = await getCoverageImpactForRequest(id)
      if (impact.data?.will_go_below) {
        return {
          error: `Effectif salarie insuffisant : ${impact.data.worst_available_salaried}/${impact.data.threshold} le jour le plus critique.`,
          below_threshold: true,
          worst_available_salaried: impact.data.worst_available_salaried,
          threshold: impact.data.threshold,
        }
      }
    }

    const { error } = await supabase
      .from('leave_requests')
      .update({
        status: 'approved' as LeaveRequestStatus,
        reviewed_by: membership.id,
        reviewed_at: new Date().toISOString(),
        admin_comment:
          options?.force && comment
            ? `[Validation forcee] ${comment}`
            : options?.force
              ? '[Validation forcee sous le seuil minimum]'
              : comment || null,
      })
      .eq('id', id)

    if (error) return { error: error.message }

    // If the leave type deducts balance, increment used days
    const { data: leaveType } = await adminClient
      .from('leave_types')
      .select('deducts_balance')
      .eq('id', request.leave_type_id)
      .single()

    if (leaveType?.deducts_balance) {
      const year = new Date(request.start_date).getFullYear()

      const { data: balance } = await adminClient
        .from('leave_balances')
        .select('id, used')
        .eq('member_id', request.member_id)
        .eq('leave_type_id', request.leave_type_id)
        .eq('year', year)
        .single()

      if (balance) {
        await adminClient
          .from('leave_balances')
          .update({ used: balance.used + request.days_count })
          .eq('id', balance.id)
      }
    }

    revalidateLeavePaths()

    logActivity({
      action: 'update',
      entityType: 'leave_request',
      entityId: id,
      details: { status: 'approved', admin_comment: comment, forced: options?.force ?? false },
    })

    const { data: member } = await adminClient
      .from('establishment_members')
      .select('user_id')
      .eq('id', request.member_id)
      .single()

    if (member) {
      createNotification({
        userId: member.user_id,
        type: 'leave_request_approved',
        title: 'Demande de conge approuvee',
        body: comment
          ? `Votre demande de conge a ete approuvee. Commentaire : ${comment}`
          : 'Votre demande de conge a ete approuvee.',
        link: '/espace-collaborateur/conges',
      })
    }

    return { success: true, forced: options?.force ?? false }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/**
 * Refuse a leave request (admin)
 */
export async function refuseLeaveRequest(id: string, comment: string) {
  try {
    const { establishmentId, membership } = await requirePermission('manage_leaves')
    const supabase = await createClient()
    const adminClient = createAdminClient()

    // Fetch the request
    const { data: request, error: fetchError } = await adminClient
      .from('leave_requests')
      .select('*')
      .eq('id', id)
      .eq('establishment_id', establishmentId)
      .single()

    if (fetchError || !request) {
      return { error: 'Demande non trouvee' }
    }

    if (request.status !== 'pending') {
      return { error: 'Cette demande a deja ete traitee' }
    }

    const { error } = await supabase
      .from('leave_requests')
      .update({
        status: 'refused' as LeaveRequestStatus,
        reviewed_by: membership.id,
        reviewed_at: new Date().toISOString(),
        admin_comment: comment,
      })
      .eq('id', id)

    if (error) return { error: error.message }

    revalidateLeavePaths()

    logActivity({
      action: 'update',
      entityType: 'leave_request',
      entityId: id,
      details: { status: 'refused', admin_comment: comment },
    })

    // Notify the requesting member (resolve user_id from member_id)
    const { data: member } = await adminClient
      .from('establishment_members')
      .select('user_id')
      .eq('id', request.member_id)
      .single()

    if (member) {
      createNotification({
        userId: member.user_id,
        type: 'leave_request_refused',
        title: 'Demande de conge refusee',
        body: `Votre demande de conge a ete refusee. Motif : ${comment}`,
        link: '/espace-collaborateur/conges',
      })
    }

    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/**
 * Delete a leave request (admin only).
 * If the request was approved and the type deducts balance, reverses the deduction.
 */
export async function deleteLeaveRequest(id: string) {
  try {
    const { establishmentId } = await requirePermission('manage_leaves')
    const adminClient = createAdminClient()

    const { data: request, error: fetchError } = await adminClient
      .from('leave_requests')
      .select('*')
      .eq('id', id)
      .eq('establishment_id', establishmentId)
      .single()

    if (fetchError || !request) {
      return { error: 'Demande non trouvee' }
    }

    if (request.status === 'approved') {
      const { data: leaveType } = await adminClient
        .from('leave_types')
        .select('deducts_balance')
        .eq('id', request.leave_type_id)
        .single()

      if (leaveType?.deducts_balance) {
        const year = new Date(request.start_date).getFullYear()

        const { data: balance } = await adminClient
          .from('leave_balances')
          .select('id, used')
          .eq('member_id', request.member_id)
          .eq('leave_type_id', request.leave_type_id)
          .eq('year', year)
          .single()

        if (balance) {
          await adminClient
            .from('leave_balances')
            .update({ used: Math.max(0, balance.used - request.days_count) })
            .eq('id', balance.id)
        }
      }
    }

    const { error, count } = await adminClient
      .from('leave_requests')
      .delete({ count: 'exact' })
      .eq('id', id)
      .eq('establishment_id', establishmentId)

    if (error) return { error: error.message }
    if (!count) return { error: 'Aucune demande supprimee (verifiez les permissions)' }

    revalidateLeavePaths()

    logActivity({
      action: 'delete',
      entityType: 'leave_request',
      entityId: id,
    })

    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ===========================================================================
// LEAVE TYPE MANAGEMENT (admin)
// ===========================================================================

/**
 * Create a leave type
 */
export async function createLeaveType(data: {
  name: string
  code: string
  color: string
  requires_approval?: boolean
  deducts_balance?: boolean
}) {
  try {
    const { establishmentId } = await requirePermission('manage_leaves')
    const supabase = await createClient()

    if (!data.name || !data.code || !data.color) {
      return { error: 'Le nom, le code et la couleur sont obligatoires' }
    }

    const { data: leaveType, error } = await supabase
      .from('leave_types')
      .insert({
        establishment_id: establishmentId,
        name: data.name,
        code: data.code,
        color: data.color,
        requires_approval: data.requires_approval ?? true,
        deducts_balance: data.deducts_balance ?? true,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return { error: 'Un type de conge avec ce code existe deja' }
      }
      return { error: error.message }
    }

    revalidateLeavePaths()

    logActivity({
      action: 'create',
      entityType: 'leave_type',
      entityId: leaveType.id,
      entityName: data.name,
    })

    return { data: leaveType }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/**
 * Update a leave type
 */
export async function updateLeaveType(
  id: string,
  data: Partial<{
    name: string
    code: string
    color: string
    requires_approval: boolean
    deducts_balance: boolean
    is_active: boolean
  }>
) {
  try {
    const { establishmentId } = await requirePermission('manage_leaves')
    const supabase = await createClient()

    const { error } = await supabase
      .from('leave_types')
      .update(data)
      .eq('id', id)
      .eq('establishment_id', establishmentId)

    if (error) return { error: error.message }

    revalidateLeavePaths()

    logActivity({
      action: 'update',
      entityType: 'leave_type',
      entityId: id,
      details: data,
    })

    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ===========================================================================
// LEAVE BALANCE MANAGEMENT (admin)
// ===========================================================================

/**
 * Set (upsert) a leave balance for a member
 */
export async function setLeaveBalance(data: {
  member_id: string
  leave_type_id: string
  year: number
  initial_balance: number
  adjustment?: number
}) {
  try {
    const { establishmentId } = await requirePermission('manage_leaves')
    const adminClient = createAdminClient()

    const { data: balance, error } = await adminClient
      .from('leave_balances')
      .upsert(
        {
          establishment_id: establishmentId,
          member_id: data.member_id,
          leave_type_id: data.leave_type_id,
          year: data.year,
          initial_balance: data.initial_balance,
          adjustment: data.adjustment ?? 0,
        },
        { onConflict: 'establishment_id,member_id,leave_type_id,year' }
      )
      .select()
      .single()

    if (error) return { error: error.message }

    revalidateLeavePaths()

    logActivity({
      action: 'update',
      entityType: 'leave_balance',
      entityId: balance.id,
      details: data,
    })

    return { data: balance }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/**
 * Bulk set the same initial balance for multiple members
 */
export async function bulkSetLeaveBalances(data: {
  member_ids: string[]
  leave_type_id: string
  year: number
  initial_balance: number
}) {
  try {
    const { establishmentId } = await requirePermission('manage_leaves')
    const adminClient = createAdminClient()

    if (!data.member_ids.length) {
      return { error: 'Aucun membre selectionne' }
    }

    const rows = data.member_ids.map((memberId) => ({
      establishment_id: establishmentId,
      member_id: memberId,
      leave_type_id: data.leave_type_id,
      year: data.year,
      initial_balance: data.initial_balance,
      adjustment: 0,
    }))

    const { error } = await adminClient
      .from('leave_balances')
      .upsert(rows, { onConflict: 'establishment_id,member_id,leave_type_id,year' })

    if (error) return { error: error.message }

    revalidateLeavePaths()

    logActivity({
      action: 'update',
      entityType: 'leave_balance',
      entityId: 'bulk',
      details: {
        member_count: data.member_ids.length,
        leave_type_id: data.leave_type_id,
        year: data.year,
        initial_balance: data.initial_balance,
      },
    })

    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
