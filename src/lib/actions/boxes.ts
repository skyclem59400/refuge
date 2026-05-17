'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireEstablishment, requirePermission } from '@/lib/establishment/permissions'
import type { BoxSpecies, BoxStatus } from '@/lib/types/database'
import { logActivity } from '@/lib/actions/activity-log'

// ============================================
// Read actions (use createAdminClient)
// ============================================

export async function getBoxes() {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    // Fetch boxes for this establishment, trie par sort_order (drag-and-drop)
    // puis par name (fallback stable).
    const { data: boxes, error } = await supabase
      .from('boxes')
      .select('*, zone:box_zones(id, name, parent_id, parent:box_zones!parent_id(id, name))')
      .eq('establishment_id', establishmentId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    if (error) {
      return { error: error.message }
    }

    // Fetch animal counts per box
    const { data: animals, error: animalsError } = await supabase
      .from('animals')
      .select('id, name, box_id, species, sex, status, photo_url, birth_date, sterilized, adoptable, reserved')
      .eq('establishment_id', establishmentId)
      .not('box_id', 'is', null)

    if (animalsError) {
      return { error: animalsError.message }
    }

    // Recupere les photos primary depuis la table animal_photos (separee).
    // Beaucoup d'animaux ont photo_url=NULL mais une photo dans cette table.
    const animalIds = (animals || []).map((a: { id: string }) => a.id)
    const primaryPhotoByAnimal: Record<string, string> = {}
    if (animalIds.length > 0) {
      const { data: photos } = await supabase
        .from('animal_photos')
        .select('animal_id, url, is_primary')
        .in('animal_id', animalIds)
        .order('is_primary', { ascending: false })

      for (const p of photos || []) {
        const photo = p as { animal_id: string; url: string; is_primary: boolean }
        if (!primaryPhotoByAnimal[photo.animal_id] || photo.is_primary) {
          primaryPhotoByAnimal[photo.animal_id] = photo.url
        }
      }
    }

    // Group animals by box_id
    interface AnimalInBox {
      id: string
      name: string
      species: string
      sex: string | null
      status: string | null
      photo_url: string | null
      birth_date: string | null
      sterilized: boolean | null
      adoptable: boolean | null
      reserved: boolean | null
    }
    const animalsByBox: Record<string, AnimalInBox[]> = {}
    for (const animal of animals || []) {
      if (animal.box_id) {
        if (!animalsByBox[animal.box_id]) {
          animalsByBox[animal.box_id] = []
        }
        animalsByBox[animal.box_id].push({
          id: animal.id,
          name: animal.name,
          species: animal.species,
          sex: animal.sex,
          status: animal.status,
          // Priorite : animal_photos primary, fallback sur animals.photo_url
          photo_url: primaryPhotoByAnimal[animal.id] || animal.photo_url,
          birth_date: animal.birth_date,
          sterilized: animal.sterilized,
          adoptable: animal.adoptable,
          reserved: animal.reserved,
        })
      }
    }

    // Enrich boxes with animal data
    const enrichedBoxes = (boxes || []).map((box) => ({
      ...box,
      animals: animalsByBox[box.id] || [],
      animal_count: (animalsByBox[box.id] || []).length,
    }))

    return { data: enrichedBoxes }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ============================================
// Write actions (use createClient)
// ============================================

export async function createBox(data: {
  name: string
  species_type: BoxSpecies
  capacity: number
  status?: BoxStatus
  zone_id?: string | null
}) {
  try {
    const { establishmentId } = await requirePermission('manage_boxes')
    const supabase = await createClient()

    // Auto-calc sort_order : place le nouveau box à la fin de sa zone (+10).
    // Ça évite que tous les nouveaux box arrivent à 0 et se retrouvent en haut.
    let nextSortOrder = 10
    {
      const zoneFilter = data.zone_id
        ? { column: 'zone_id', value: data.zone_id }
        : null
      const q = supabase
        .from('boxes')
        .select('sort_order')
        .eq('establishment_id', establishmentId)
        .order('sort_order', { ascending: false })
        .limit(1)
      const maxQ = zoneFilter ? q.eq(zoneFilter.column, zoneFilter.value) : q.is('zone_id', null)
      const { data: maxRow } = await maxQ
      if (maxRow && maxRow[0] && typeof (maxRow[0] as { sort_order: number }).sort_order === 'number') {
        nextSortOrder = (maxRow[0] as { sort_order: number }).sort_order + 10
      }
    }

    const { data: box, error } = await supabase
      .from('boxes')
      .insert({
        name: data.name,
        species_type: data.species_type,
        capacity: data.capacity,
        status: data.status || 'available',
        establishment_id: establishmentId,
        zone_id: data.zone_id ?? null,
        sort_order: nextSortOrder,
      })
      .select()
      .single()

    if (error) {
      return { error: error.message }
    }

    revalidatePath('/boxes')
    logActivity({ action: 'create', entityType: 'box', entityId: box.id, entityName: data.name, details: { espece: data.species_type, capacite: data.capacity } })
    return { data: box }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function updateBox(id: string, data: {
  name?: string
  species_type?: BoxSpecies
  capacity?: number
  status?: BoxStatus
  zone_id?: string | null
}) {
  try {
    const { establishmentId } = await requirePermission('manage_boxes')
    const supabase = await createClient()

    const { error } = await supabase
      .from('boxes')
      .update(data)
      .eq('id', id)
      .eq('establishment_id', establishmentId)

    if (error) {
      return { error: error.message }
    }

    revalidatePath('/boxes')
    logActivity({ action: 'update', entityType: 'box', entityId: id, entityName: data.name, details: data })
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/**
 * Reordonne les box dans un groupe (zone/sous-zone) en mettant a jour leur
 * sort_order. orderedBoxIds est la liste des ids dans l'ordre desire.
 * Ne touche pas a l'appartenance a la zone, juste a l'ordre.
 */
export async function reorderBoxes(orderedBoxIds: string[]) {
  try {
    const { establishmentId } = await requirePermission('manage_boxes')
    const supabase = await createClient()

    if (orderedBoxIds.length === 0) return { success: true }

    // Update parallele : chaque box recoit sort_order = (index + 1) * 10
    // Les *10 laissent de la place pour des inserts intermediaires.
    const results = await Promise.all(
      orderedBoxIds.map((id, idx) =>
        supabase
          .from('boxes')
          .update({ sort_order: (idx + 1) * 10 })
          .eq('id', id)
          .eq('establishment_id', establishmentId)
      )
    )

    const firstError = results.find((r) => r.error)
    if (firstError?.error) return { error: firstError.error.message }

    revalidatePath('/boxes')
    return { success: true, reordered: orderedBoxIds.length }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function deleteBox(id: string) {
  try {
    const { establishmentId } = await requirePermission('manage_boxes')
    const supabase = await createClient()

    // Check that no animals are assigned to this box
    const admin = createAdminClient()
    const { data: assignedAnimals, error: checkError } = await admin
      .from('animals')
      .select('id')
      .eq('box_id', id)
      .eq('establishment_id', establishmentId)
      .limit(1)

    if (checkError) {
      return { error: checkError.message }
    }

    if (assignedAnimals && assignedAnimals.length > 0) {
      return { error: 'Impossible de supprimer ce box car des animaux y sont encore assignes' }
    }

    const { data: boxInfo } = await admin.from('boxes').select('name').eq('id', id).single()

    const { error } = await supabase
      .from('boxes')
      .delete()
      .eq('id', id)
      .eq('establishment_id', establishmentId)

    if (error) {
      return { error: error.message }
    }

    logActivity({ action: 'delete', entityType: 'box', entityId: id, entityName: boxInfo?.name })
    revalidatePath('/boxes')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
