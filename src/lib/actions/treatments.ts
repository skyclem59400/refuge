'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireEstablishment, requirePermission } from '@/lib/establishment/permissions'
import { logActivity } from '@/lib/actions/activity-log'
import { notifyAdminsWithPermission } from '@/lib/actions/notifications'
import type { AnimalTreatment, TreatmentFrequency } from '@/lib/types/database'

// ============================================
// Read actions (use createAdminClient)
// ============================================

export async function getTreatments(filters?: {
  animalId?: string
  active?: boolean
}) {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    let query = supabase
      .from('animal_treatments')
      .select('*, animals!inner(id, nom:name, species, establishment_id)')
      .eq('establishment_id', establishmentId)

    if (filters?.animalId) {
      query = query.eq('animal_id', filters.animalId)
    }

    if (filters?.active !== undefined) {
      query = query.eq('active', filters.active)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) return { error: error.message }
    return { data: data as (AnimalTreatment & { animals: { id: string; nom: string; species: string } })[] }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function getTodayTreatments() {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    const today = new Date().toISOString().split('T')[0]
    const dayOfWeek = new Date().getDay() // 0=Sunday, 1=Monday, ...

    // Fetch active treatments that cover today
    const { data: treatments, error: treatmentsError } = await supabase
      .from('animal_treatments')
      .select('*, animals!inner(id, nom:name, species, photo_url, establishment_id)')
      .eq('establishment_id', establishmentId)
      .eq('active', true)
      .lte('start_date', today)
      .or(`end_date.is.null,end_date.gte.${today}`)
      .order('name')

    if (treatmentsError) return { error: treatmentsError.message }
    if (!treatments || treatments.length === 0) return { data: [] }

    // Filter by frequency (weekly treatments only on matching day)
    const todayTreatments = treatments.filter((t) => {
      if (t.frequency === 'daily' || t.frequency === 'twice_daily' || t.frequency === 'custom') {
        return true
      }
      if (t.frequency === 'weekly') {
        const startDay = new Date(t.start_date).getDay()
        return startDay === dayOfWeek
      }
      return true
    })

    if (todayTreatments.length === 0) return { data: [] }

    // Fetch today's administrations for these treatments
    const treatmentIds = todayTreatments.map((t) => t.id)
    const { data: administrations } = await supabase
      .from('treatment_administrations')
      .select('*')
      .in('treatment_id', treatmentIds)
      .eq('date', today)

    const adminMap = new Map<string, typeof administrations>()
    for (const admin of administrations || []) {
      const key = admin.treatment_id
      if (!adminMap.has(key)) adminMap.set(key, [])
      adminMap.get(key)!.push(admin)
    }

    // Build result with administration status
    const result = todayTreatments.map((t) => {
      const admins = adminMap.get(t.id) || []
      const expectedSlots = t.times.length || 1
      const completedSlots = admins.length

      return {
        ...t,
        animal_name: t.animals.nom,
        animal_photo: t.animals.photo_url,
        animal_species: t.animals.species,
        administrations_today: admins,
        is_complete: completedSlots >= expectedSlots,
        completed_count: completedSlots,
        expected_count: expectedSlots,
      }
    })

    return { data: result }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ============================================
// Write actions
// ============================================

export async function createTreatment(data: {
  animal_id: string
  health_record_id?: string | null
  name: string
  description?: string
  frequency: TreatmentFrequency
  times?: string[]
  start_date?: string
  end_date?: string | null
  notes?: string
}) {
  try {
    const { userId, establishmentId } = await requirePermission('manage_health')
    const supabase = await createClient()

    if (!data.name.trim()) {
      return { error: 'Le nom du traitement est obligatoire' }
    }

    if (!data.animal_id) {
      return { error: 'L\'animal est obligatoire' }
    }

    const { data: treatment, error } = await supabase
      .from('animal_treatments')
      .insert({
        establishment_id: establishmentId,
        animal_id: data.animal_id,
        health_record_id: data.health_record_id || null,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        frequency: data.frequency,
        times: data.times || [],
        start_date: data.start_date || new Date().toISOString().split('T')[0],
        end_date: data.end_date || null,
        notes: data.notes?.trim() || null,
        created_by: userId,
      })
      .select('*, animals!inner(nom:name)')
      .single()

    if (error) return { error: error.message }

    // Notify admins & managers only
    const animalName = treatment.animals?.nom || 'Animal'
    notifyAdminsWithPermission({
      permission: 'manage_health',
      type: 'treatment_new',
      title: `Nouveau traitement : ${data.name.trim()}`,
      body: `${animalName} — ${data.description?.trim() || data.name.trim()}`,
      link: '/health',
      metadata: { treatment_id: treatment.id, animal_id: data.animal_id },
    }).catch(() => {}) // Fire-and-forget

    logActivity({
      action: 'create',
      entityType: 'treatment',
      entityId: treatment.id,
      entityName: data.name.trim(),
      parentType: 'animal',
      parentId: data.animal_id,
    })

    revalidatePath('/health')
    revalidatePath('/dashboard')
    return { data: treatment as AnimalTreatment }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function updateTreatment(id: string, data: Partial<{
  name: string
  description: string
  frequency: TreatmentFrequency
  times: string[]
  start_date: string
  end_date: string | null
  active: boolean
  notes: string
}>) {
  try {
    await requirePermission('manage_health')
    const supabase = await createClient()

    const { error } = await supabase
      .from('animal_treatments')
      .update(data)
      .eq('id', id)

    if (error) return { error: error.message }

    logActivity({
      action: 'update',
      entityType: 'treatment',
      entityId: id,
      entityName: data.name,
    })

    revalidatePath('/health')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function stopTreatment(id: string) {
  try {
    await requirePermission('manage_health')
    const supabase = await createClient()

    const today = new Date().toISOString().split('T')[0]
    const { error } = await supabase
      .from('animal_treatments')
      .update({ active: false, end_date: today })
      .eq('id', id)

    if (error) return { error: error.message }

    logActivity({
      action: 'update',
      entityType: 'treatment',
      entityId: id,
      details: { action: 'stop' },
    })

    revalidatePath('/health')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function deleteTreatment(id: string) {
  try {
    await requirePermission('manage_health')
    const supabase = await createClient()

    const { error } = await supabase
      .from('animal_treatments')
      .delete()
      .eq('id', id)

    if (error) return { error: error.message }

    logActivity({
      action: 'delete',
      entityType: 'treatment',
      entityId: id,
    })

    revalidatePath('/health')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ============================================
// Administration (any member)
// ============================================

export async function administerTreatment(data: {
  treatment_id: string
  time_slot?: string
  notes?: string
}) {
  try {
    const { userId } = await requireEstablishment()
    const supabase = await createClient()

    const today = new Date().toISOString().split('T')[0]

    const { data: administration, error } = await supabase
      .from('treatment_administrations')
      .insert({
        treatment_id: data.treatment_id,
        date: today,
        time_slot: data.time_slot || null,
        administered_by: userId,
        notes: data.notes?.trim() || null,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return { error: 'Ce traitement a deja ete valide pour ce créneau' }
      }
      return { error: error.message }
    }

    revalidatePath('/dashboard')
    return { data: administration }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function cancelAdministration(id: string) {
  try {
    await requirePermission('manage_health')
    const supabase = await createClient()

    const { error } = await supabase
      .from('treatment_administrations')
      .delete()
      .eq('id', id)

    if (error) return { error: error.message }

    revalidatePath('/dashboard')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
