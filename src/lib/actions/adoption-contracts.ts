'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireEstablishment, requirePermission } from '@/lib/establishment/permissions'
import { logActivity } from '@/lib/actions/activity-log'
import { trackChanges } from '@/lib/utils/activity'
import type { AdoptionContract, AdoptionContractStatus } from '@/lib/types/database'

// ============================================
// Read
// ============================================

export async function getAdoptionContracts(animalId?: string) {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    let query = supabase
      .from('adoption_contracts')
      .select('*, animals!inner(id, name, species), adopter:clients!adopter_client_id(id, name, email, phone, address, city, postal_code)')
      .eq('establishment_id', establishmentId)

    if (animalId) {
      query = query.eq('animal_id', animalId)
    }

    const { data, error } = await query.order('adoption_date', { ascending: false })

    if (error) return { error: error.message }
    return { data: data ?? [] }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function getAdoptionContract(id: string) {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('adoption_contracts')
      .select('*, animals!inner(id, name, species, breed, sex, birth_date, chip_number), adopter:clients!adopter_client_id(id, name, email, phone, address, city, postal_code)')
      .eq('id', id)
      .eq('establishment_id', establishmentId)
      .single()

    if (error || !data) return { error: 'Contrat introuvable' }
    return { data }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ============================================
// Write
// ============================================

interface AdoptionContractInput {
  animal_id: string
  adopter_client_id: string
  adoption_date: string
  adoption_fee?: number
  status?: AdoptionContractStatus
  sterilization_required?: boolean
  sterilization_deadline?: string | null
  sterilization_deposit?: number | null
  visit_right_clause?: boolean
  non_resale_clause?: boolean
  shelter_return_clause?: boolean
  household_acknowledgment?: boolean
  special_conditions?: string | null
  signed_at_location?: string | null
  signed_at?: string | null
  notes?: string | null
}

export async function createAdoptionContract(data: AdoptionContractInput) {
  try {
    const { establishmentId, userId } = await requirePermission('manage_animals')
    const supabase = await createClient()
    const admin = createAdminClient()

    const { data: contractNumber, error: numberError } = await admin.rpc('get_next_adoption_contract_number', {
      est_id: establishmentId,
    })

    if (numberError || !contractNumber) {
      return { error: 'Impossible de generer le numero de contrat' }
    }

    const { data: contract, error } = await supabase
      .from('adoption_contracts')
      .insert({
        establishment_id: establishmentId,
        animal_id: data.animal_id,
        adopter_client_id: data.adopter_client_id,
        contract_number: contractNumber,
        adoption_date: data.adoption_date,
        adoption_fee: data.adoption_fee ?? 0,
        status: data.status ?? 'draft',
        sterilization_required: data.sterilization_required ?? true,
        sterilization_deadline: data.sterilization_deadline ?? null,
        sterilization_deposit: data.sterilization_deposit ?? null,
        visit_right_clause: data.visit_right_clause ?? true,
        non_resale_clause: data.non_resale_clause ?? true,
        shelter_return_clause: data.shelter_return_clause ?? true,
        household_acknowledgment: data.household_acknowledgment ?? false,
        special_conditions: data.special_conditions ?? null,
        signed_at_location: data.signed_at_location ?? null,
        signed_at: data.signed_at ?? null,
        notes: data.notes ?? null,
        created_by: userId,
      })
      .select()
      .single()

    if (error) return { error: error.message }

    revalidatePath(`/animals/${data.animal_id}`)
    logActivity({
      action: 'create',
      entityType: 'adoption_contract',
      entityId: contract.id,
      entityName: contract.contract_number,
      parentType: 'animal',
      parentId: data.animal_id,
    })
    return { data: contract as AdoptionContract }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function updateAdoptionContract(id: string, data: Partial<AdoptionContractInput>) {
  try {
    const { establishmentId } = await requirePermission('manage_animals')
    const supabase = await createClient()
    const admin = createAdminClient()

    const { data: current } = await admin
      .from('adoption_contracts')
      .select('*')
      .eq('id', id)
      .eq('establishment_id', establishmentId)
      .single()

    if (!current) return { error: 'Contrat introuvable' }

    const { error } = await supabase
      .from('adoption_contracts')
      .update(data)
      .eq('id', id)
      .eq('establishment_id', establishmentId)

    if (error) return { error: error.message }

    const changes = trackChanges(current, data)
    revalidatePath(`/animals/${current.animal_id}`)
    logActivity({
      action: 'update',
      entityType: 'adoption_contract',
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

export async function deleteAdoptionContract(id: string) {
  try {
    const { establishmentId } = await requirePermission('manage_animals')
    const supabase = await createClient()
    const admin = createAdminClient()

    const { data: current } = await admin
      .from('adoption_contracts')
      .select('animal_id, contract_number')
      .eq('id', id)
      .eq('establishment_id', establishmentId)
      .single()

    const { error } = await supabase
      .from('adoption_contracts')
      .delete()
      .eq('id', id)
      .eq('establishment_id', establishmentId)

    if (error) return { error: error.message }

    if (current) {
      revalidatePath(`/animals/${current.animal_id}`)
      logActivity({
        action: 'delete',
        entityType: 'adoption_contract',
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
