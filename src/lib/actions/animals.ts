'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireEstablishment, requirePermission } from '@/lib/establishment/permissions'
import type {
  AnimalSpecies,
  AnimalSex,
  AnimalStatus,
  AnimalOrigin,
  MovementType,
  IcadStatus,
} from '@/lib/types/database'

// ============================================
// Read actions (use createAdminClient)
// ============================================

export async function getAnimals(filters?: {
  status?: AnimalStatus
  species?: AnimalSpecies
  search?: string
}) {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    let query = supabase
      .from('animals')
      .select('*, animal_photos(id, url, is_primary)')
      .eq('establishment_id', establishmentId)

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    if (filters?.species) {
      query = query.eq('species', filters.species)
    }

    if (filters?.search) {
      const search = `%${filters.search}%`
      query = query.or(`name.ilike.${search},chip_number.ilike.${search},medal_number.ilike.${search}`)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      return { error: error.message }
    }

    return { data }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function getAnimal(id: string) {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('animals')
      .select('*, animal_photos(*), boxes(name, species_type)')
      .eq('id', id)
      .eq('establishment_id', establishmentId)
      .single()

    if (error || !data) {
      return { error: 'Animal introuvable' }
    }

    return { data }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function getPoundAnimals() {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('animals')
      .select('*, animal_photos(id, url, is_primary), boxes(name, species_type)')
      .eq('establishment_id', establishmentId)
      .eq('status', 'pound')
      .order('pound_entry_date', { ascending: true })

    if (error) {
      return { error: error.message }
    }

    return { data }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function getShelterAnimals() {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('animals')
      .select('*, animal_photos(id, url, is_primary), boxes(name, species_type)')
      .eq('establishment_id', establishmentId)
      .eq('status', 'shelter')
      .order('shelter_entry_date', { ascending: false })

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

export async function createAnimal(data: {
  name: string
  name_secondary?: string | null
  species: AnimalSpecies
  breed?: string | null
  breed_cross?: string | null
  sex: AnimalSex
  birth_date?: string | null
  birth_place?: string | null
  color?: string | null
  weight?: number | null
  sterilized?: boolean
  chip_number?: string | null
  tattoo_number?: string | null
  tattoo_position?: string | null
  medal_number?: string | null
  loof_number?: string | null
  passport_number?: string | null
  icad_updated?: boolean
  status: AnimalStatus
  behavior_score?: number | null
  description?: string | null
  capture_location?: string | null
  capture_circumstances?: string | null
  origin_type: AnimalOrigin
  box_id?: string | null
}) {
  try {
    const { establishmentId, userId } = await requirePermission('manage_animals')
    const supabase = await createClient()

    const now = new Date().toISOString()

    // Auto-generate medal number
    const admin = createAdminClient()
    const { data: nextMedal } = await admin.rpc('get_next_medal_number', {
      est_id: establishmentId,
    })
    const medalNumber = nextMedal ? String(nextMedal) : data.medal_number

    const animalData = {
      ...data,
      medal_number: medalNumber,
      establishment_id: establishmentId,
      pound_entry_date: data.status === 'pound' ? now : null,
    }

    const { data: animal, error } = await supabase
      .from('animals')
      .insert(animalData)
      .select()
      .single()

    if (error) {
      return { error: error.message }
    }

    // Create initial movement record
    const originNotes: Record<AnimalOrigin, string> = {
      found: 'Animal trouve - entree en fourriere',
      abandoned: 'Animal abandonne - entree en fourriere',
      transferred_in: 'Transfert entrant - entree en fourriere',
      surrender: 'Cession par le proprietaire - entree en fourriere',
    }

    const { error: movementError } = await supabase
      .from('animal_movements')
      .insert({
        animal_id: animal.id,
        type: 'pound_entry' as MovementType,
        date: now,
        notes: originNotes[data.origin_type],
        icad_status: 'pending' as IcadStatus,
        created_by: userId,
      })

    if (movementError) {
      // Animal was created but movement failed - log but don't fail
      console.error('Failed to create initial movement:', movementError.message)
    }

    revalidatePath('/animals')
    revalidatePath('/pound')
    revalidatePath('/dashboard')
    return { data: animal }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function updateAnimal(id: string, data: {
  name?: string
  name_secondary?: string | null
  species?: AnimalSpecies
  breed?: string | null
  breed_cross?: string | null
  sex?: AnimalSex
  birth_date?: string | null
  birth_place?: string | null
  color?: string | null
  weight?: number | null
  sterilized?: boolean
  chip_number?: string | null
  tattoo_number?: string | null
  tattoo_position?: string | null
  medal_number?: string | null
  loof_number?: string | null
  passport_number?: string | null
  icad_updated?: boolean
  behavior_score?: number | null
  description?: string | null
  capture_location?: string | null
  capture_circumstances?: string | null
  origin_type?: AnimalOrigin
  box_id?: string | null
}) {
  try {
    const { establishmentId } = await requirePermission('manage_animals')
    const supabase = await createClient()

    const { error } = await supabase
      .from('animals')
      .update(data)
      .eq('id', id)
      .eq('establishment_id', establishmentId)

    if (error) {
      return { error: error.message }
    }

    revalidatePath('/animals')
    revalidatePath(`/animals/${id}`)
    revalidatePath('/pound')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function deleteAnimal(id: string) {
  try {
    const { establishmentId } = await requirePermission('manage_animals')
    const supabase = await createClient()

    const { error } = await supabase
      .from('animals')
      .delete()
      .eq('id', id)
      .eq('establishment_id', establishmentId)

    if (error) {
      if (error.message.includes('violates foreign key') || error.code === '23503') {
        return { error: 'Impossible de supprimer cet animal car il a des donnees associees' }
      }
      return { error: error.message }
    }

    revalidatePath('/animals')
    revalidatePath('/pound')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function recordMovement(animalId: string, data: {
  type: MovementType
  date: string
  notes?: string | null
  person_name?: string | null
  person_contact?: string | null
  destination?: string | null
  icad_status?: IcadStatus
}) {
  try {
    const { establishmentId, userId } = await requirePermission('manage_movements')
    const supabase = await createClient()

    // Verify animal belongs to this establishment
    const { data: animal, error: fetchError } = await supabase
      .from('animals')
      .select('id, status')
      .eq('id', animalId)
      .eq('establishment_id', establishmentId)
      .single()

    if (fetchError || !animal) {
      return { error: 'Animal introuvable' }
    }

    // Create the movement record
    const { data: movement, error: movementError } = await supabase
      .from('animal_movements')
      .insert({
        animal_id: animalId,
        type: data.type,
        date: data.date,
        notes: data.notes ?? null,
        person_name: data.person_name ?? null,
        person_contact: data.person_contact ?? null,
        destination: data.destination ?? null,
        icad_status: data.icad_status ?? 'pending',
        created_by: userId,
      })
      .select()
      .single()

    if (movementError) {
      return { error: movementError.message }
    }

    // Map movement type to animal status
    const statusMap: Record<string, AnimalStatus> = {
      shelter_transfer: 'shelter',
      adoption: 'adopted',
      return_to_owner: 'returned',
      transfer_out: 'transferred',
      death: 'deceased',
      euthanasia: 'euthanized',
    }

    const newStatus = statusMap[data.type]
    if (newStatus) {
      const updateData: Record<string, string | null> = { status: newStatus }

      // Set shelter_entry_date for shelter transfer
      if (data.type === 'shelter_transfer') {
        updateData.shelter_entry_date = data.date
      }

      // Set exit_date for exit movements
      const exitTypes: MovementType[] = ['adoption', 'return_to_owner', 'transfer_out', 'death', 'euthanasia']
      if (exitTypes.includes(data.type)) {
        updateData.exit_date = data.date
      }

      const { error: updateError } = await supabase
        .from('animals')
        .update(updateData)
        .eq('id', animalId)
        .eq('establishment_id', establishmentId)

      if (updateError) {
        return { error: updateError.message }
      }
    }

    revalidatePath('/animals')
    revalidatePath(`/animals/${animalId}`)
    revalidatePath('/pound')
    revalidatePath('/dashboard')
    return { data: movement }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
