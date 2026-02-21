'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireEstablishment, requirePermission } from '@/lib/establishment/permissions'
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

// ============================================
// Write actions (use createClient)
// ============================================

export async function createHealthRecord(data: {
  animal_id: string
  type: HealthRecordType
  description: string
  veterinarian?: string | null
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
        date: new Date().toISOString(),
        description: data.description,
        veterinarian: data.veterinarian ?? null,
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
    return { data: record }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function deleteHealthRecord(id: string) {
  try {
    await requirePermission('manage_health')
    const supabase = await createClient()

    const { error } = await supabase
      .from('animal_health_records')
      .delete()
      .eq('id', id)

    if (error) {
      return { error: error.message }
    }

    revalidatePath('/health')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
