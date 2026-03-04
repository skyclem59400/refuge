'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireEstablishment, requirePermission } from '@/lib/establishment/permissions'
import { logActivity } from '@/lib/actions/activity-log'

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

    // Active dogs only (physically present)
    const { data: animals, error: animalsError } = await supabase
      .from('animals')
      .select('id, name, species, photo_url, status, box_id, animal_photos(id, url, is_primary)')
      .eq('establishment_id', establishmentId)
      .eq('species', 'dog')
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
        .select('id, animals!inner(establishment_id, species)', { count: 'exact', head: true })
        .eq('animals.establishment_id', establishmentId)
        .eq('animals.species', 'dog')
        .gte('started_at', todayStart),
      supabase
        .from('animal_outings')
        .select('id, animals!inner(establishment_id, species)', { count: 'exact', head: true })
        .eq('animals.establishment_id', establishmentId)
        .eq('animals.species', 'dog')
        .gte('started_at', weekStart),
      supabase
        .from('animals')
        .select('id', { count: 'exact', head: true })
        .eq('establishment_id', establishmentId)
        .eq('species', 'dog')
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
// getOutingLeaderboard — stats per person + per animal + weekly trend
// ---------------------------------------------------------------------------

export async function getOutingLeaderboard() {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    // All outings for dogs in this establishment (only currently active animals)
    const { data: allOutings, error } = await supabase
      .from('animal_outings')
      .select('walked_by, animal_id, duration_minutes, started_at, is_tig, animals!inner(id, name, species, photo_url, establishment_id, animal_photos(id, url, is_primary), status)')
      .eq('animals.establishment_id', establishmentId)
      .eq('animals.species', 'dog')
      .in('animals.status', ['pound', 'shelter', 'foster_family', 'boarding'])
      .order('started_at', { ascending: false })

    if (error) return { error: error.message }
    if (!allOutings || allOutings.length === 0) {
      return { data: { perPerson: [], perAnimal: [], dailyTrend: [], weeklyTrend: [], monthlyTrend: [], totalDuration: 0, totalOutings: 0, avgDuration: 0, tigTotal: 0 } }
    }

    // Separate regular outings from TIG outings for per-person stats
    const regularOutings = allOutings.filter((o) => !o.is_tig)
    const tigCount = allOutings.length - regularOutings.length

    // --- Per person (exclude TIG — those don't count in individual leaderboard) ---
    const personMap = new Map<string, { count: number; totalMinutes: number }>()
    for (const o of regularOutings) {
      const prev = personMap.get(o.walked_by) || { count: 0, totalMinutes: 0 }
      prev.count++
      prev.totalMinutes += o.duration_minutes || 0
      personMap.set(o.walked_by, prev)
    }
    const perPerson = Array.from(personMap.entries())
      .map(([userId, stats]) => ({
        userId,
        count: stats.count,
        totalMinutes: stats.totalMinutes,
        avgMinutes: stats.count > 0 ? Math.round(stats.totalMinutes / stats.count) : 0,
      }))
      .sort((a, b) => b.count - a.count || b.totalMinutes - a.totalMinutes)

    // --- Per animal ---
    type AnimalInfo = { id: string; name: string; species: string; photo_url: string | null; establishment_id: string; animal_photos: { id: string; url: string; is_primary: boolean }[] }
    const animalMap = new Map<string, { count: number; totalMinutes: number; animal: AnimalInfo }>()
    for (const o of allOutings) {
      const animal = (Array.isArray(o.animals) ? o.animals[0] : o.animals) as AnimalInfo
      const prev = animalMap.get(o.animal_id) || { count: 0, totalMinutes: 0, animal }
      prev.count++
      prev.totalMinutes += o.duration_minutes || 0
      animalMap.set(o.animal_id, prev)
    }
    const perAnimal = Array.from(animalMap.entries())
      .map(([animalId, stats]) => ({
        animalId,
        name: stats.animal.name,
        photo_url: stats.animal.photo_url,
        animal_photos: stats.animal.animal_photos,
        count: stats.count,
        totalMinutes: stats.totalMinutes,
      }))
      .sort((a, b) => b.count - a.count || b.totalMinutes - a.totalMinutes)

    // --- Trends (daily / weekly / monthly) ---
    const now = new Date()
    type TrendPoint = { label: string; count: number; totalMinutes: number }

    // Daily — last 14 days
    const dailyTrend: TrendPoint[] = []
    for (let i = 13; i >= 0; i--) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
      const nextDay = new Date(day)
      nextDay.setDate(nextDay.getDate() + 1)
      const dayOutings = allOutings.filter((o) => {
        const d = new Date(o.started_at)
        return d >= day && d < nextDay
      })
      dailyTrend.push({
        label: `${day.getDate().toString().padStart(2, '0')}/${(day.getMonth() + 1).toString().padStart(2, '0')}`,
        count: dayOutings.length,
        totalMinutes: dayOutings.reduce((sum, o) => sum + (o.duration_minutes || 0), 0),
      })
    }

    // Weekly — last 8 weeks
    const weeklyTrend: TrendPoint[] = []
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now)
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1 - i * 7)
      weekStart.setHours(0, 0, 0, 0)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 7)
      const weekOutings = allOutings.filter((o) => {
        const d = new Date(o.started_at)
        return d >= weekStart && d < weekEnd
      })
      weeklyTrend.push({
        label: `${weekStart.getDate().toString().padStart(2, '0')}/${(weekStart.getMonth() + 1).toString().padStart(2, '0')}`,
        count: weekOutings.length,
        totalMinutes: weekOutings.reduce((sum, o) => sum + (o.duration_minutes || 0), 0),
      })
    }

    // Monthly — last 6 months
    const monthNames = ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aout', 'Sep', 'Oct', 'Nov', 'Dec']
    const monthlyTrend: TrendPoint[] = []
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      const monthOutings = allOutings.filter((o) => {
        const d = new Date(o.started_at)
        return d >= monthStart && d < monthEnd
      })
      monthlyTrend.push({
        label: `${monthNames[monthStart.getMonth()]} ${monthStart.getFullYear().toString().slice(2)}`,
        count: monthOutings.length,
        totalMinutes: monthOutings.reduce((sum, o) => sum + (o.duration_minutes || 0), 0),
      })
    }

    // --- Global KPIs ---
    const totalOutings = allOutings.length
    const totalDuration = allOutings.reduce((sum, o) => sum + (o.duration_minutes || 0), 0)
    const avgDuration = totalOutings > 0 ? Math.round(totalDuration / totalOutings) : 0

    return {
      data: { perPerson, perAnimal, dailyTrend, weeklyTrend, monthlyTrend, totalDuration, totalOutings, avgDuration, tigTotal: tigCount },
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
  rating?: number | null
  rating_comment?: string | null
  is_tig?: boolean
  tig_walker_name?: string | null
}) {
  try {
    const { userId, groups } = await requirePermission('manage_outings')
    const supabase = await createClient()

    // TIG outings require manage_outing_assignments OR admin
    if (data.is_tig) {
      const isAdminOrManager = (groups || []).some(
        (g) => (g.is_system && g.name === 'Administrateur') || g.manage_outing_assignments
      )
      if (!isAdminOrManager) {
        return { error: 'Seuls les managers et administrateurs peuvent enregistrer des sorties TIG' }
      }
    }

    // Validate rating and comment (both required)
    if (data.rating == null) {
      return { error: 'Une notation de 1 a 10 est obligatoire' }
    }
    if (data.rating < 1 || data.rating > 10 || !Number.isInteger(data.rating)) {
      return { error: 'La note doit etre un entier entre 1 et 10' }
    }
    if (!data.rating_comment?.trim()) {
      return { error: 'Un commentaire est obligatoire pour toute sortie' }
    }

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
        rating: data.rating ?? null,
        rating_comment: data.rating_comment?.trim() || null,
        is_tig: data.is_tig ?? false,
        tig_walker_name: data.is_tig ? (data.tig_walker_name?.trim() || null) : null,
      })
      .select()
      .single()

    if (error) return { error: error.message }

    // Auto-link: if there's an assignment for this animal+user today, mark completed
    // (skip for TIG outings — TIG don't have assignments)
    if (!data.is_tig) {
      const todayDate = new Date().toISOString().split('T')[0]
      const adminForLink = createAdminClient()
      await adminForLink
        .from('outing_assignments')
        .update({ outing_id: outing.id })
        .eq('animal_id', data.animal_id)
        .eq('assigned_to', userId)
        .eq('date', todayDate)
        .is('outing_id', null)
    }

    revalidatePath('/sorties')
    revalidatePath(`/animals/${data.animal_id}`)
    revalidatePath('/dashboard')

    // Fetch animal name for the log
    const admin = createAdminClient()
    const { data: animalInfo } = await admin.from('animals').select('name').eq('id', data.animal_id).single()
    logActivity({
      action: 'create',
      entityType: 'outing',
      entityId: outing.id,
      entityName: animalInfo?.name || undefined,
      parentType: 'animal',
      parentId: data.animal_id,
      details: { duree: `${data.duration_minutes} min`, note: data.rating ?? undefined, tig: data.is_tig ?? false },
    })

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
    const { groups } = await requirePermission('manage_outings')
    const supabase = createAdminClient()

    // Only admins can delete outings
    const isAdmin = (groups || []).some(
      (g) => g.is_system && g.name === 'Administrateur'
    )
    if (!isAdmin) {
      return { error: 'Seul un administrateur peut supprimer une sortie. Contactez votre administrateur.' }
    }

    const { data: outing, error: fetchError } = await supabase
      .from('animal_outings')
      .select('id, animal_id, duration_minutes, animals(name)')
      .eq('id', id)
      .single()

    if (fetchError || !outing) return { error: 'Sortie introuvable' }

    const { error } = await supabase
      .from('animal_outings')
      .delete()
      .eq('id', id)

    if (error) return { error: error.message }

    logActivity({
      action: 'delete',
      entityType: 'outing',
      entityId: id,
      entityName: (outing.animals as any)?.name || undefined,
      parentType: 'animal',
      parentId: outing.animal_id,
    })

    revalidatePath('/sorties')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ---------------------------------------------------------------------------
// getAssignments — list assignments for a given date
// ---------------------------------------------------------------------------

export async function getAssignments(filters?: {
  date?: string
  assignedTo?: string
}) {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    const targetDate = filters?.date || new Date().toISOString().split('T')[0]

    // Fetch today's assignments + all past uncompleted assignments (outing_id IS NULL)
    let query = supabase
      .from('outing_assignments')
      .select('*, animals!inner(id, name, species, photo_url, establishment_id, animal_photos(id, url, is_primary))')
      .eq('establishment_id', establishmentId)
      .or(`date.eq.${targetDate},and(date.lt.${targetDate},outing_id.is.null)`)

    if (filters?.assignedTo) {
      query = query.eq('assigned_to', filters.assignedTo)
    }

    const { data, error } = await query.order('date', { ascending: true }).order('created_at')

    if (error) return { error: error.message }
    return { data }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ---------------------------------------------------------------------------
// createAssignment — manager assigns a dog to a person
// ---------------------------------------------------------------------------

export async function createAssignment(data: {
  animal_id: string
  assigned_to: string
  date?: string
  notes?: string | null
}) {
  try {
    const { userId, establishmentId } = await requirePermission('manage_outing_assignments')
    const supabase = createAdminClient()

    const targetDate = data.date || new Date().toISOString().split('T')[0]

    const { data: assignment, error } = await supabase
      .from('outing_assignments')
      .insert({
        establishment_id: establishmentId,
        animal_id: data.animal_id,
        assigned_to: data.assigned_to,
        assigned_by: userId,
        date: targetDate,
        notes: data.notes ?? null,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return { error: 'Ce chien est deja assigne a cette personne pour ce jour' }
      }
      return { error: error.message }
    }

    revalidatePath('/sorties')

    const { data: animalInfo } = await supabase.from('animals').select('name').eq('id', data.animal_id).single()
    logActivity({
      action: 'assign',
      entityType: 'outing_assignment',
      entityId: assignment.id,
      entityName: animalInfo?.name || undefined,
      parentType: 'animal',
      parentId: data.animal_id,
    })

    return { data: assignment }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ---------------------------------------------------------------------------
// deleteAssignment — manager removes an assignment
// ---------------------------------------------------------------------------

export async function deleteAssignment(id: string) {
  try {
    await requirePermission('manage_outing_assignments')
    const supabase = createAdminClient()

    const { data: assignment } = await supabase
      .from('outing_assignments')
      .select('animal_id, animals(name)')
      .eq('id', id)
      .single()

    const { error } = await supabase
      .from('outing_assignments')
      .delete()
      .eq('id', id)

    if (error) return { error: error.message }

    logActivity({
      action: 'delete',
      entityType: 'outing_assignment',
      entityId: id,
      entityName: (assignment?.animals as any)?.name || undefined,
      parentType: 'animal',
      parentId: assignment?.animal_id,
    })

    revalidatePath('/sorties')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ---------------------------------------------------------------------------
// getAssignmentStats — planned vs completed delta
// ---------------------------------------------------------------------------

export async function getAssignmentStats(filters?: {
  dateFrom?: string
  dateTo?: string
}) {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    const now = new Date()
    const dateFrom = filters?.dateFrom || new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13).toISOString().split('T')[0]
    const dateTo = filters?.dateTo || now.toISOString().split('T')[0]

    const { data: assignments, error } = await supabase
      .from('outing_assignments')
      .select('id, assigned_to, date, outing_id')
      .eq('establishment_id', establishmentId)
      .gte('date', dateFrom)
      .lte('date', dateTo)

    if (error) return { error: error.message }

    const perPersonMap = new Map<string, { assigned: number; completed: number }>()
    const perDayMap = new Map<string, { assigned: number; completed: number }>()

    for (const a of assignments || []) {
      const ps = perPersonMap.get(a.assigned_to) || { assigned: 0, completed: 0 }
      ps.assigned++
      if (a.outing_id) ps.completed++
      perPersonMap.set(a.assigned_to, ps)

      const ds = perDayMap.get(a.date) || { assigned: 0, completed: 0 }
      ds.assigned++
      if (a.outing_id) ds.completed++
      perDayMap.set(a.date, ds)
    }

    return {
      data: {
        perPerson: Array.from(perPersonMap.entries()).map(([userId, s]) => ({
          userId,
          assigned: s.assigned,
          completed: s.completed,
          completionRate: s.assigned > 0 ? Math.round((s.completed / s.assigned) * 100) : 0,
        })),
        perDay: Array.from(perDayMap.entries())
          .map(([date, s]) => ({ date, assigned: s.assigned, completed: s.completed }))
          .sort((a, b) => b.date.localeCompare(a.date)),
        totalAssigned: (assignments || []).length,
        totalCompleted: (assignments || []).filter(a => a.outing_id).length,
      },
    }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
