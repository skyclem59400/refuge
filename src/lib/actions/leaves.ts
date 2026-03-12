'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireEstablishment, requirePermission } from '@/lib/establishment/permissions'
import { logActivity } from '@/lib/actions/activity-log'
import { createNotification, notifyAdminsWithPermission } from '@/lib/actions/notifications'
import type { LeaveRequestStatus } from '@/lib/types/database'

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
  reason?: string
}) {
  try {
    const { establishmentId, membership } = await requirePermission('view_own_leaves')
    const supabase = await createClient()

    if (!data.leave_type_id || !data.start_date || !data.end_date || !data.days_count) {
      return { error: 'Tous les champs obligatoires doivent etre remplis' }
    }

    if (data.start_date > data.end_date) {
      return { error: 'La date de debut doit etre avant la date de fin' }
    }

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
        days_count: data.days_count,
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
      body: `Une demande de conge du ${data.start_date} au ${data.end_date} a ete soumise.`,
      link: '/admin/conges',
    })

    return { data: request }
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
 * Approve a leave request (admin)
 */
export async function approveLeaveRequest(id: string, comment?: string) {
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

    // Update request status
    const { error } = await supabase
      .from('leave_requests')
      .update({
        status: 'approved' as LeaveRequestStatus,
        reviewed_by: membership.id,
        reviewed_at: new Date().toISOString(),
        admin_comment: comment || null,
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
      details: { status: 'approved', admin_comment: comment },
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
        type: 'leave_request_approved',
        title: 'Demande de conge approuvee',
        body: comment
          ? `Votre demande de conge a ete approuvee. Commentaire : ${comment}`
          : 'Votre demande de conge a ete approuvee.',
        link: '/espace-collaborateur/conges',
      })
    }

    return { success: true }
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

    // If it was approved and deducts balance, reverse the used days
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

    const { error } = await supabase
      .from('leave_requests')
      .delete()
      .eq('id', id)

    if (error) return { error: error.message }

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
