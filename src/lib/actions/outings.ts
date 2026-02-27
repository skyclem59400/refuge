'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireEstablishment, requirePermission } from '@/lib/establishment/permissions'

// ---------------------------------------------------------------------------
// getOutings — list outings for the establishment
// ---------------------------------------------------------------------------

export async function getOutings(filters?: {
  animalId?: string
  dateFrom?: string
  dateTo?: string
  limit?: number
}) {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    let query = supabase
      .from('animal_outings')
      .select('*, animals!inner(id, name, species, photo_url, establishment_id, animal_photos(id, url, is_primary))')
      .eq('animals.establishment_id', establishmentId)

    if (filters?.animalId) {
      query = query.eq('animal_id', filters.animalId)
    }
    if (filters?.dateFrom) {
      query = query.gte('started_at', filters.dateFrom)
    }
    if (filters?.dateTo) {
      query = query.lte('started_at', filters.dateTo)
    }

    const { data, error } = await query
      .order('started_at', { ascending: false })
      .limit(filters?.limit ?? 50)

    if (error) return { error: error.message }
    return { data }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ---------------------------------------------------------------------------
// getAnimalOutingPriority — animals sorted by days since last outing
// ---------------------------------------------------------------------------

export async function getAnimalOutingPriority() {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    // Active animals (physically present)
    const { data: animals, error: animalsError } = await supabase
      .from('animals')
      .select('id, name, species, photo_url, status, box_id, animal_photos(id, url, is_primary)')
      .eq('establishment_id', establishmentId)
      .in('status', ['pound', 'shelter', 'foster_family', 'boarding'])
      .order('name')

    if (animalsError) return { error: animalsError.message }
    if (!animals || animals.length === 0) return { data: [] }

    // Most recent outing per animal
    const animalIds = animals.map((a) => a.id)
    const { data: outings, error: outingsError } = await supabase
      .from('animal_outings')
      .select('animal_id, started_at')
      .in('animal_id', animalIds)
      .order('started_at', { ascending: false })

    if (outingsError) return { error: outingsError.message }

    // Build map: animal_id -> last outing date
    const lastOutingMap = new Map<string, string>()
    for (const outing of outings || []) {
      if (!lastOutingMap.has(outing.animal_id)) {
        lastOutingMap.set(outing.animal_id, outing.started_at)
      }
    }

    // Compute days since last outing
    const now = new Date()
    const priorityList = animals.map((animal) => {
      const lastOuting = lastOutingMap.get(animal.id)
      let daysSinceLastOuting: number | null = null

      if (lastOuting) {
        const lastDate = new Date(lastOuting)
        daysSinceLastOuting = Math.floor(
          (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
        )
      }

      return {
        ...animal,
        last_outing_at: lastOuting || null,
        days_since_last_outing: daysSinceLastOuting,
      }
    })

    // Sort: never walked first, then most days since last outing
    priorityList.sort((a, b) => {
      if (a.days_since_last_outing === null && b.days_since_last_outing === null) return 0
      if (a.days_since_last_outing === null) return -1
      if (b.days_since_last_outing === null) return 1
      return b.days_since_last_outing - a.days_since_last_outing
    })

    return { data: priorityList }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ---------------------------------------------------------------------------
// getOutingStats — KPIs
// ---------------------------------------------------------------------------

export async function getOutingStats() {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay()
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 1).toISOString()

    const [todayResult, weekResult, activeResult] = await Promise.all([
      supabase
        .from('animal_outings')
        .select('id, animals!inner(establishment_id)', { count: 'exact', head: true })
        .eq('animals.establishment_id', establishmentId)
        .gte('started_at', todayStart),
      supabase
        .from('animal_outings')
        .select('id, animals!inner(establishment_id)', { count: 'exact', head: true })
        .eq('animals.establishment_id', establishmentId)
        .gte('started_at', weekStart),
      supabase
        .from('animals')
        .select('id', { count: 'exact', head: true })
        .eq('establishment_id', establishmentId)
        .in('status', ['pound', 'shelter', 'foster_family', 'boarding']),
    ])

    return {
      data: {
        outingsToday: todayResult.count || 0,
        outingsThisWeek: weekResult.count || 0,
        totalActiveAnimals: activeResult.count || 0,
      },
    }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ---------------------------------------------------------------------------
// createOuting — record a new outing
// ---------------------------------------------------------------------------

export async function createOuting(data: {
  animal_id: string
  duration_minutes: number
  notes?: string | null
}) {
  try {
    const { userId } = await requirePermission('manage_outings')
    const supabase = await createClient()

    const now = new Date()
    const startedAt = new Date(now.getTime() - data.duration_minutes * 60 * 1000)

    const { data: outing, error } = await supabase
      .from('animal_outings')
      .insert({
        animal_id: data.animal_id,
        walked_by: userId,
        started_at: startedAt.toISOString(),
        ended_at: now.toISOString(),
        duration_minutes: data.duration_minutes,
        notes: data.notes ?? null,
      })
      .select()
      .single()

    if (error) return { error: error.message }

    revalidatePath('/sorties')
    revalidatePath(`/animals/${data.animal_id}`)
    revalidatePath('/dashboard')
    return { data: outing }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ---------------------------------------------------------------------------
// deleteOuting — admin only
// ---------------------------------------------------------------------------

export async function deleteOuting(id: string) {
  try {
    await requirePermission('manage_animals')
    const supabase = await createClient()

    const { error } = await supabase
      .from('animal_outings')
      .delete()
      .eq('id', id)

    if (error) return { error: error.message }

    revalidatePath('/sorties')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
