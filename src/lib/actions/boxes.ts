'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireEstablishment, requirePermission } from '@/lib/establishment/permissions'
import type { BoxSpecies, BoxStatus } from '@/lib/types/database'

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
      .select('*')
      .eq('establishment_id', establishmentId)
      .order('name')

    if (error) {
      return { error: error.message }
    }

    // Fetch animal counts per box
    const { data: animals, error: animalsError } = await supabase
      .from('animals')
      .select('id, name, box_id, species')
      .eq('establishment_id', establishmentId)
      .not('box_id', 'is', null)

    if (animalsError) {
      return { error: animalsError.message }
    }

    // Group animals by box_id
    const animalsByBox: Record<string, { id: string; name: string; species: string }[]> = {}
    for (const animal of animals || []) {
      if (animal.box_id) {
        if (!animalsByBox[animal.box_id]) {
          animalsByBox[animal.box_id] = []
        }
        animalsByBox[animal.box_id].push({
          id: animal.id,
          name: animal.name,
          species: animal.species,
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
      })
      .select()
      .single()

    if (error) {
      return { error: error.message }
    }

    revalidatePath('/boxes')
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

    const { error } = await supabase
      .from('boxes')
      .delete()
      .eq('id', id)
      .eq('establishment_id', establishmentId)

    if (error) {
      return { error: error.message }
    }

    revalidatePath('/boxes')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
