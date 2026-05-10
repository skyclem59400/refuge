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

    // Fetch boxes for this establishment
    const { data: boxes, error } = await supabase
      .from('boxes')
      .select('*, zone:box_zones(id, name, parent_id, parent:box_zones!parent_id(id, name))')
      .eq('establishment_id', establishmentId)
      .order('name')

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
          photo_url: animal.photo_url,
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

    const { data: box, error } = await supabase
      .from('boxes')
      .insert({
        name: data.name,
        species_type: data.species_type,
        capacity: data.capacity,
        status: data.status || 'available',
        establishment_id: establishmentId,
        zone_id: data.zone_id ?? null,
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
