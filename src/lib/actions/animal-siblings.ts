'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/establishment/permissions'
import { logActivity } from '@/lib/actions/activity-log'
import type { AnimalSpecies, AnimalSex, AnimalOrigin, AnimalStatus } from '@/lib/types/database'

/**
 * Crée une fratrie : plusieurs animaux partageant les mêmes infos
 * d'arrivée (espèce, race, origine, lieu de récupération, etc.).
 * Permet à Mary de saisir une portée de chiots/chatons en 1 form
 * au lieu de N saisies répétitives.
 *
 * Limite de batch : 20 animaux par création (un seul cas réaliste,
 * et permet de plafonner les écritures si erreur de saisie).
 */

const MAX_SIBLINGS_PER_BATCH = 20

export interface SiblingCommonData {
  species: AnimalSpecies
  breed?: string | null
  breed_cross?: string | null
  birth_date?: string | null
  origin_type: AnimalOrigin
  status: AnimalStatus
  capture_location?: string | null
  capture_circumstances?: string | null
  pickup_address_label?: string | null
  pickup_postcode?: string | null
  pickup_city?: string | null
  pickup_lat?: number | null
  pickup_lng?: number | null
  pickup_ban_id?: string | null
  box_id?: string | null
  judicial_procedure?: boolean
  judicial_case_number?: string | null
  judicial_jurisdiction?: string | null
  judicial_seizure_date?: string | null
  judicial_owner_name?: string | null
  judicial_notes?: string | null
}

export interface SiblingPerAnimalData {
  name: string
  sex: AnimalSex
  color?: string | null
  chip_number?: string | null
  tattoo_number?: string | null
  tattoo_position?: string | null
  weight?: number | null
}

/** Résultat global de la création — chaque animal a un status indépendant */
export interface SiblingCreationResult {
  created: Array<{
    name: string
    id: string
    medal_number: string | null
  }>
  failed: Array<{
    name: string
    error: string
  }>
}

export async function createAnimalSiblings(input: {
  common: SiblingCommonData
  animals: SiblingPerAnimalData[]
}): Promise<{ data?: SiblingCreationResult; error?: string }> {
  try {
    if (!input.animals || input.animals.length === 0) {
      return { error: 'Au moins un animal est requis dans la fratrie.' }
    }
    if (input.animals.length > MAX_SIBLINGS_PER_BATCH) {
      return { error: `Maximum ${MAX_SIBLINGS_PER_BATCH} animaux par fratrie.` }
    }

    // Validation : tous les noms sont remplis et uniques (pas 2 fois "Chiot 1" dans la même fratrie)
    const trimmedNames = input.animals.map((a) => a.name?.trim() || '')
    if (trimmedNames.some((n) => !n)) {
      return { error: 'Chaque animal doit avoir un nom.' }
    }
    const uniqNames = new Set(trimmedNames.map((n) => n.toLowerCase()))
    if (uniqNames.size !== trimmedNames.length) {
      return { error: 'Deux animaux de la fratrie ne peuvent pas porter le même nom.' }
    }

    const { establishmentId, userId } = await requirePermission('manage_animals')
    const supabase = await createClient()
    const admin = createAdminClient()

    const result: SiblingCreationResult = { created: [], failed: [] }

    for (const a of input.animals) {
      try {
        // Numéro de médaille : auto si pas fourni (pas exposé dans le form fratrie)
        const { data: nextMedal } = await admin.rpc('get_next_medal_number', {
          est_id: establishmentId,
        })
        const medalNumber = nextMedal ? String(nextMedal) : null

        const animalRow = {
          name: a.name.trim(),
          species: input.common.species,
          breed: input.common.breed || null,
          breed_cross: input.common.breed_cross || null,
          sex: a.sex,
          birth_date: input.common.birth_date || null,
          color: a.color?.trim() || null,
          weight: a.weight ?? null,
          chip_number: a.chip_number?.trim() || null,
          tattoo_number: a.tattoo_number?.trim() || null,
          tattoo_position: a.tattoo_position?.trim() || null,
          medal_number: medalNumber,
          status: input.common.status,
          origin_type: input.common.origin_type,
          capture_location: input.common.capture_location || null,
          capture_circumstances: input.common.capture_circumstances || null,
          pickup_address_label: input.common.pickup_address_label || null,
          pickup_postcode: input.common.pickup_postcode || null,
          pickup_city: input.common.pickup_city || null,
          pickup_lat: input.common.pickup_lat ?? null,
          pickup_lng: input.common.pickup_lng ?? null,
          pickup_ban_id: input.common.pickup_ban_id || null,
          box_id: input.common.box_id || null,
          judicial_procedure: input.common.judicial_procedure ?? false,
          judicial_case_number: input.common.judicial_case_number || null,
          judicial_jurisdiction: input.common.judicial_jurisdiction || null,
          judicial_seizure_date: input.common.judicial_seizure_date || null,
          judicial_owner_name: input.common.judicial_owner_name || null,
          judicial_notes: input.common.judicial_notes || null,
          establishment_id: establishmentId,
          created_by: userId,
        }

        const { data: created, error } = await supabase
          .from('animals')
          .insert(animalRow)
          .select('id, name, medal_number')
          .single()

        if (error || !created) {
          result.failed.push({ name: a.name, error: error?.message || 'inconnu' })
          continue
        }

        result.created.push({
          name: created.name,
          id: created.id,
          medal_number: created.medal_number,
        })
      } catch (e) {
        result.failed.push({ name: a.name, error: (e as Error).message })
      }
    }

    revalidatePath('/animals')
    revalidatePath('/pound')

    void logActivity({
      action: 'create',
      entityType: 'animal_sibling_batch',
      details: {
        common_species: input.common.species,
        common_origin: input.common.origin_type,
        created_count: result.created.length,
        failed_count: result.failed.length,
      },
    })

    return { data: result }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
