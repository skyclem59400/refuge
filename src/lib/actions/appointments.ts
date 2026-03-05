'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/establishment/permissions'
import { logActivity } from '@/lib/actions/activity-log'
import type { Appointment, AppointmentType, AppointmentStatus } from '@/lib/types/database'

// ===========================================================================
// READ OPERATIONS (use createAdminClient)
// ===========================================================================

/**
 * Get appointments for a date range
 */
export async function getAppointments(filters?: {
  dateFrom?: string
  dateTo?: string
  type?: AppointmentType
  status?: AppointmentStatus
  animalId?: string
}) {
  try {
    const { establishmentId } = await requirePermission('manage_planning')
    const supabase = createAdminClient()

    const today = new Date().toISOString().split('T')[0]
    const dateFrom = filters?.dateFrom || today
    const dateTo = filters?.dateTo || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    let query = supabase
      .from('appointments')
      .select('*')
      .eq('establishment_id', establishmentId)
      .gte('date', dateFrom)
      .lte('date', dateTo)

    if (filters?.type) {
      query = query.eq('type', filters.type)
    }

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    if (filters?.animalId) {
      query = query.eq('animal_id', filters.animalId)
    }

    const { data, error } = await query.order('date', { ascending: true }).order('start_time', { ascending: true })

    if (error) return { error: error.message }
    return { data }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/**
 * Get a single appointment by ID
 */
export async function getAppointmentById(id: string) {
  try {
    const { establishmentId } = await requirePermission('manage_planning')
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', id)
      .eq('establishment_id', establishmentId)
      .single()

    if (error || !data) {
      return { error: 'Rendez-vous non trouve' }
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
 * Create an appointment
 */
export async function createAppointment(data: {
  type: AppointmentType
  animal_id?: string | null
  assigned_user_id?: string | null
  client_name?: string | null
  client_phone?: string | null
  client_email?: string | null
  date: string
  start_time: string
  end_time: string
  notes?: string | null
  status?: AppointmentStatus
}) {
  try {
    const { userId, establishmentId } = await requirePermission('manage_planning')
    const supabase = await createClient()

    // Validation
    if (!data.type || !data.animal_id || !data.assigned_user_id || !data.date || !data.start_time || !data.end_time) {
      return { error: 'Tous les champs obligatoires doivent etre remplis (animal, collaborateur, date, horaires)' }
    }

    // For adoption, client name is required
    if (data.type === 'adoption' && !data.client_name) {
      return { error: 'Le nom du client est obligatoire pour les rendez-vous d\'adoption' }
    }

    // Validate time range
    if (data.start_time >= data.end_time) {
      return { error: "L'heure de debut doit etre avant l'heure de fin" }
    }

    const { data: appointment, error } = await supabase
      .from('appointments')
      .insert({
        establishment_id: establishmentId,
        type: data.type,
        animal_id: data.animal_id,
        assigned_user_id: data.assigned_user_id,
        client_name: data.client_name || null,
        client_phone: data.client_phone || null,
        client_email: data.client_email || null,
        date: data.date,
        start_time: data.start_time,
        end_time: data.end_time,
        notes: data.notes || null,
        status: data.status || 'scheduled',
        created_by: userId,
      })
      .select()
      .single()

    if (error) {
      return { error: error.message }
    }

    revalidatePath('/planning')
    logActivity({
      action: 'create',
      entityType: 'appointment',
      entityId: appointment.id,
    })

    return { data: appointment }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/**
 * Update an appointment
 */
export async function updateAppointment(
  id: string,
  data: {
    type?: AppointmentType
    animal_id?: string | null
    client_name?: string
    client_phone?: string | null
    client_email?: string | null
    date?: string
    start_time?: string
    end_time?: string
    notes?: string | null
    status?: AppointmentStatus
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
      .from('appointments')
      .update(data)
      .eq('id', id)
      .eq('establishment_id', establishmentId)

    if (error) return { error: error.message }

    revalidatePath('/planning')
    logActivity({
      action: 'update',
      entityType: 'appointment',
      entityId: id,
      details: data,
    })

    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/**
 * Update appointment status only
 */
export async function updateAppointmentStatus(id: string, status: AppointmentStatus) {
  try {
    const { establishmentId } = await requirePermission('manage_planning')
    const supabase = await createClient()

    const { error } = await supabase
      .from('appointments')
      .update({ status })
      .eq('id', id)
      .eq('establishment_id', establishmentId)

    if (error) return { error: error.message }

    revalidatePath('/planning')
    logActivity({
      action: 'update',
      entityType: 'appointment',
      entityId: id,
      details: { status },
    })

    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/**
 * Delete an appointment
 */
export async function deleteAppointment(id: string) {
  try {
    const { establishmentId } = await requirePermission('manage_planning')
    const supabase = createAdminClient()

    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('id', id)
      .eq('establishment_id', establishmentId)

    if (error) return { error: error.message }

    revalidatePath('/planning')
    logActivity({
      action: 'delete',
      entityType: 'appointment',
      entityId: id,
    })

    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
