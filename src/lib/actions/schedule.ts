'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/establishment/permissions'
import { logActivity } from '@/lib/actions/activity-log'

// ===========================================================================
// READ OPERATIONS (use createAdminClient)
// ===========================================================================

/**
 * Get schedule entries for a date range
 */
export async function getSchedule(filters?: {
  dateFrom?: string
  dateTo?: string
  userId?: string
}) {
  try {
    const { establishmentId } = await requirePermission('manage_planning')
    const supabase = createAdminClient()

    const today = new Date().toISOString().split('T')[0]
    const dateFrom = filters?.dateFrom || today
    const dateTo = filters?.dateTo || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    let query = supabase
      .from('staff_schedule')
      .select('*')
      .eq('establishment_id', establishmentId)
      .gte('date', dateFrom)
      .lte('date', dateTo)

    if (filters?.userId) {
      query = query.eq('user_id', filters.userId)
    }

    const { data, error } = await query.order('date', { ascending: true }).order('start_time', { ascending: true })

    if (error) return { error: error.message }
    return { data }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/**
 * Get a single schedule entry by ID
 */
export async function getScheduleById(id: string) {
  try {
    const { establishmentId } = await requirePermission('manage_planning')
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('staff_schedule')
      .select('*')
      .eq('id', id)
      .eq('establishment_id', establishmentId)
      .single()

    if (error || !data) {
      return { error: 'Plannification non trouvee' }
    }
    return { data }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ===========================================================================
// WRITE OPERATIONS (use createClient)
// ===========================================================================

/**
 * Create a schedule entry
 */
export async function createSchedule(data: {
  user_id: string
  date: string
  start_time: string
  end_time: string
  notes?: string | null
}) {
  try {
    const { userId, establishmentId } = await requirePermission('manage_planning')
    const supabase = await createClient()

    // Validation
    if (!data.user_id || !data.date || !data.start_time || !data.end_time) {
      return { error: 'Tous les champs obligatoires doivent etre remplis' }
    }

    // Validate time range
    if (data.start_time >= data.end_time) {
      return { error: "L'heure de debut doit etre avant l'heure de fin" }
    }

    const { data: schedule, error } = await supabase
      .from('staff_schedule')
      .insert({
        establishment_id: establishmentId,
        user_id: data.user_id,
        date: data.date,
        start_time: data.start_time,
        end_time: data.end_time,
        notes: data.notes || null,
        created_by: userId,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return { error: 'Une planification existe deja pour cette personne a cette date et heure' }
      }
      return { error: error.message }
    }

    revalidatePath('/planning')
    logActivity({
      action: 'create',
      entityType: 'staff_schedule',
      entityId: schedule.id,
    })

    return { data: schedule }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/**
 * Update a schedule entry
 */
export async function updateSchedule(
  id: string,
  data: {
    date?: string
    start_time?: string
    end_time?: string
    notes?: string | null
  }
) {
  try {
    const { establishmentId } = await requirePermission('manage_planning')
    const supabase = await createClient()

    // Validate time range if both times are provided
    if (data.start_time && data.end_time && data.start_time >= data.end_time) {
      return { error: "L'heure de debut doit etre avant l'heure de fin" }
    }

    const { error } = await supabase
      .from('staff_schedule')
      .update(data)
      .eq('id', id)
      .eq('establishment_id', establishmentId)

    if (error) return { error: error.message }

    revalidatePath('/planning')
    logActivity({
      action: 'update',
      entityType: 'staff_schedule',
      entityId: id,
      details: data,
    })

    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/**
 * Delete a schedule entry
 */
export async function deleteSchedule(id: string) {
  try {
    const { establishmentId } = await requirePermission('manage_planning')
    const supabase = createAdminClient()

    const { error } = await supabase
      .from('staff_schedule')
      .delete()
      .eq('id', id)
      .eq('establishment_id', establishmentId)

    if (error) return { error: error.message }

    revalidatePath('/planning')
    logActivity({
      action: 'delete',
      entityType: 'staff_schedule',
      entityId: id,
    })

    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/**
 * Duplicate a week's schedule to the next week
 */
export async function duplicateWeek(weekStartDate: string) {
  try {
    const { userId, establishmentId } = await requirePermission('manage_planning')
    const supabase = await createClient()
    const adminClient = createAdminClient()

    // Calculate week range (Monday to Sunday)
    const startDate = new Date(weekStartDate)
    const endDate = new Date(startDate)
    endDate.setDate(startDate.getDate() + 6)

    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]

    // Get all schedules for the week
    const { data: schedules, error: fetchError } = await adminClient
      .from('staff_schedule')
      .select('*')
      .eq('establishment_id', establishmentId)
      .gte('date', startDateStr)
      .lte('date', endDateStr)

    if (fetchError || !schedules || schedules.length === 0) {
      return { error: 'Aucune planification trouvee pour cette semaine' }
    }

    // Create new schedules for next week (+7 days)
    const newSchedules = schedules.map((schedule) => {
      const newDate = new Date(schedule.date)
      newDate.setDate(newDate.getDate() + 7)
      return {
        establishment_id: establishmentId,
        user_id: schedule.user_id,
        date: newDate.toISOString().split('T')[0],
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        notes: schedule.notes,
        created_by: userId,
      }
    })

    const { data, error: insertError } = await supabase
      .from('staff_schedule')
      .insert(newSchedules)
      .select()

    if (insertError) {
      if (insertError.code === '23505') {
        return { error: 'Certaines planifications existent deja pour la semaine suivante' }
      }
      return { error: insertError.message }
    }

    revalidatePath('/planning')
    logActivity({
      action: 'create',
      entityType: 'staff_schedule',
      entityId: 'bulk',
      details: { duplicated_count: data?.length || 0, source_week: startDateStr },
    })

    return { success: true, count: data?.length || 0 }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
