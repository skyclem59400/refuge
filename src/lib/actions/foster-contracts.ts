'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireEstablishment, requirePermission } from '@/lib/establishment/permissions'
import { logActivity } from '@/lib/actions/activity-log'
import { trackChanges } from '@/lib/utils/activity'
import type { FosterContract, FosterContractStatus } from '@/lib/types/database'

// ============================================
// Read
// ============================================

export async function getFosterContracts(animalId?: string) {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    let query = supabase
      .from('foster_contracts')
      .select('*, animals!inner(id, name, species), foster:clients!foster_client_id(id, name, email, phone, address, city, postal_code)')
      .eq('establishment_id', establishmentId)

    if (animalId) {
      query = query.eq('animal_id', animalId)
    }

    const { data, error } = await query.order('start_date', { ascending: false })

    if (error) {
      return { error: error.message }
    }

    return { data: data ?? [] }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function getFosterContract(id: string) {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('foster_contracts')
      .select('*, animals!inner(id, name, species, breed, sex, birth_date, chip_number), foster:clients!foster_client_id(id, name, email, phone, address, city, postal_code)')
      .eq('id', id)
      .eq('establishment_id', establishmentId)
      .single()

    if (error || !data) {
      return { error: 'Contrat introuvable' }
    }

    return { data }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ============================================
// Write
// ============================================

interface FosterContractInput {
  animal_id: string
  foster_client_id: string
  start_date: string
  expected_end_date?: string | null
  status?: FosterContractStatus
  vet_costs_covered_by_shelter?: boolean
  food_provided_by_shelter?: boolean
  insurance_required?: boolean
  household_consent?: boolean
  other_animals_at_home?: string | null
  special_conditions?: string | null
  signed_at_location?: string | null
  signed_at?: string | null
  notes?: string | null
}

export async function createFosterContract(data: FosterContractInput) {
  try {
    const { establishmentId, userId } = await requirePermission('manage_animals')
    const supabase = await createClient()
    const admin = createAdminClient()

    // Generate contract number
    const { data: contractNumber, error: numberError } = await admin.rpc('get_next_foster_contract_number', {
      est_id: establishmentId,
    })

    if (numberError || !contractNumber) {
      return { error: 'Impossible de generer le numero de contrat' }
    }

    const { data: contract, error } = await supabase
      .from('foster_contracts')
      .insert({
        establishment_id: establishmentId,
        animal_id: data.animal_id,
        foster_client_id: data.foster_client_id,
        contract_number: contractNumber,
        start_date: data.start_date,
        expected_end_date: data.expected_end_date ?? null,
        status: data.status ?? 'draft',
        vet_costs_covered_by_shelter: data.vet_costs_covered_by_shelter ?? true,
        food_provided_by_shelter: data.food_provided_by_shelter ?? false,
        insurance_required: data.insurance_required ?? false,
        household_consent: data.household_consent ?? false,
        other_animals_at_home: data.other_animals_at_home ?? null,
        special_conditions: data.special_conditions ?? null,
        signed_at_location: data.signed_at_location ?? null,
        signed_at: data.signed_at ?? null,
        notes: data.notes ?? null,
        created_by: userId,
      })
      .select()
      .single()

    if (error) {
      return { error: error.message }
    }

    revalidatePath(`/animals/${data.animal_id}`)
    logActivity({
      action: 'create',
      entityType: 'foster_contract',
      entityId: contract.id,
      entityName: contract.contract_number,
      parentType: 'animal',
      parentId: data.animal_id,
    })
    return { data: contract as FosterContract }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function updateFosterContract(id: string, data: Partial<FosterContractInput> & { actual_end_date?: string | null }) {
  try {
    const { establishmentId } = await requirePermission('manage_animals')
    const supabase = await createClient()
    const admin = createAdminClient()

    const { data: current } = await admin
      .from('foster_contracts')
      .select('*')
      .eq('id', id)
      .eq('establishment_id', establishmentId)
      .single()

    if (!current) {
      return { error: 'Contrat introuvable' }
    }

    const { error } = await supabase
      .from('foster_contracts')
      .update(data)
      .eq('id', id)
      .eq('establishment_id', establishmentId)

    if (error) {
      return { error: error.message }
    }

    const changes = trackChanges(current, data)
    revalidatePath(`/animals/${current.animal_id}`)
    logActivity({
      action: 'update',
      entityType: 'foster_contract',
      entityId: id,
      entityName: current.contract_number,
      parentType: 'animal',
      parentId: current.animal_id,
      details: changes,
    })
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function deleteFosterContract(id: string) {
  try {
    const { establishmentId } = await requirePermission('manage_animals')
    const supabase = await createClient()
    const admin = createAdminClient()

    const { data: current } = await admin
      .from('foster_contracts')
      .select('animal_id, contract_number')
      .eq('id', id)
      .eq('establishment_id', establishmentId)
      .single()

    const { error } = await supabase
      .from('foster_contracts')
      .delete()
      .eq('id', id)
      .eq('establishment_id', establishmentId)

    if (error) {
      return { error: error.message }
    }

    if (current) {
      revalidatePath(`/animals/${current.animal_id}`)
      logActivity({
        action: 'delete',
        entityType: 'foster_contract',
        entityId: id,
        entityName: current.contract_number,
        parentType: 'animal',
        parentId: current.animal_id,
      })
    }
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
