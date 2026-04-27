'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireEstablishment, requirePermission } from '@/lib/establishment/permissions'
import { logActivity } from '@/lib/actions/activity-log'
import { trackChanges } from '@/lib/utils/activity'
import type { HealthRecordType } from '@/lib/types/database'

// ============================================
// Read actions (use createAdminClient)
// ============================================

export async function getHealthRecords(filters?: {
  animalId?: string
  type?: HealthRecordType
}) {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    // We need to join with animals to get the animal name and to scope by establishment
    let query = supabase
      .from('animal_health_records')
      .select('*, animals!inner(id, name, species, establishment_id)')
      .eq('animals.establishment_id', establishmentId)

    if (filters?.animalId) {
      query = query.eq('animal_id', filters.animalId)
    }

    if (filters?.type) {
      query = query.eq('type', filters.type)
    }

    const { data, error } = await query.order('date', { ascending: false })

    if (error) {
      return { error: error.message }
    }

    return { data }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function getUpcomingReminders() {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const sevenDaysLater = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
    const sevenDaysStr = sevenDaysLater.toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('animal_health_records')
      .select('*, animals!inner(id, name, species, establishment_id)')
      .eq('animals.establishment_id', establishmentId)
      .not('next_due_date', 'is', null)
      .lte('next_due_date', sevenDaysStr)
      .gte('next_due_date', todayStr)
      .order('next_due_date', { ascending: true })

    if (error) {
      return { error: error.message }
    }

    return { data }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function getOverdueReminders() {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('animal_health_records')
      .select('*, animals!inner(id, name, species, establishment_id)')
      .eq('animals.establishment_id', establishmentId)
      .not('next_due_date', 'is', null)
      .lt('next_due_date', todayStr)
      .order('next_due_date', { ascending: true })

    if (error) {
      return { error: error.message }
    }

    return { data }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ============================================
// Write actions (use createClient)
// ============================================

export async function createHealthRecord(data: {
  animal_id: string
  type: HealthRecordType
  date?: string
  description: string
  veterinarian?: string | null
  veterinarian_id?: string | null
  next_due_date?: string | null
  cost?: number | null
  notes?: string | null
}) {
  try {
    const { userId } = await requirePermission('manage_health')
    const supabase = await createClient()

    const { data: record, error } = await supabase
      .from('animal_health_records')
      .insert({
        animal_id: data.animal_id,
        type: data.type,
        date: data.date || new Date().toISOString().split('T')[0],
        description: data.description,
        veterinarian: data.veterinarian ?? null,
        veterinarian_id: data.veterinarian_id ?? null,
        next_due_date: data.next_due_date ?? null,
        cost: data.cost ?? null,
        notes: data.notes ?? null,
        created_by: userId,
      })
      .select()
      .single()

    if (error) {
      return { error: error.message }
    }

    revalidatePath('/health')
    revalidatePath(`/animals/${data.animal_id}`)
    logActivity({ action: 'create', entityType: 'health_record', entityId: record.id, entityName: data.type, parentType: 'animal', parentId: data.animal_id })
    return { data: record }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function updateHealthRecord(id: string, data: {
  type?: HealthRecordType
  date?: string
  description?: string
  veterinarian?: string | null
  veterinarian_id?: string | null
  next_due_date?: string | null
  cost?: number | null
  notes?: string | null
}) {
  try {
    await requirePermission('manage_health')
    const supabase = await createClient()
    const admin = createAdminClient()

    // Fetch current record for change tracking
    const { data: currentRecord } = await admin
      .from('animal_health_records')
      .select('*')
      .eq('id', id)
      .single()

    const { error } = await supabase
      .from('animal_health_records')
      .update(data)
      .eq('id', id)

    if (error) {
      return { error: error.message }
    }

    const changes = trackChanges(currentRecord, data)

    revalidatePath('/health')
    logActivity({
      action: 'update',
      entityType: 'health_record',
      entityId: id,
      parentType: 'animal',
      parentId: currentRecord?.animal_id,
      details: changes,
    })
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function deleteHealthRecord(id: string) {
  try {
    await requirePermission('manage_health')
    const supabase = await createClient()

    // Fetch the record to get animal_id for activity logging
    const { data: record } = await supabase
      .from('animal_health_records')
      .select('animal_id')
      .eq('id', id)
      .single()

    const { error } = await supabase
      .from('animal_health_records')
      .delete()
      .eq('id', id)

    if (error) {
      return { error: error.message }
    }

    revalidatePath('/health')
    logActivity({ action: 'delete', entityType: 'health_record', entityId: id, parentType: 'animal', parentId: record?.animal_id })
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
