'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireEstablishment, requirePermission } from '@/lib/establishment/permissions'
import { logActivity } from '@/lib/actions/activity-log'
import { trackChanges } from '@/lib/utils/activity'
import type {
  AbandonmentContract,
  AbandonmentContractStatus,
  AbandonmentMotif,
} from '@/lib/types/database'

// ============================================
// Read
// ============================================

export async function getAbandonmentContracts(animalId?: string) {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    let query = supabase
      .from('abandonment_contracts')
      .select(`*,
        animals!inner(id, name, species),
        cedant:clients!cedant_client_id(id, kind, name, first_name, email, phone, city)`)
      .eq('establishment_id', establishmentId)

    if (animalId) {
      query = query.eq('animal_id', animalId)
    }

    const { data, error } = await query.order('signature_date', { ascending: false })

    if (error) return { error: error.message }
    return { data: data ?? [] }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function getAbandonmentContract(id: string) {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('abandonment_contracts')
      .select(`*,
        animals!inner(id, name, species, breed, sex, birth_date, chip_number, color, sterilized),
        cedant:clients!cedant_client_id(id, kind, name, first_name, email, phone, address, postal_code, city)`)
      .eq('id', id)
      .eq('establishment_id', establishmentId)
      .single()

    if (error || !data) return { error: 'Contrat d\'abandon introuvable' }
    return { data }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ============================================
// Write
// ============================================

interface AbandonmentContractInput {
  animal_id: string
  cedant_client_id: string
  signature_date: string
  expected_handover_date?: string | null
  motif: AbandonmentMotif
  motif_details?: string | null
  amount?: number
  note?: string | null
  cedant_id_card_number?: string | null
  cedant_passport_number?: string | null
  signed_at_location?: string | null
  signed_at?: string | null
  status?: AbandonmentContractStatus
  notes?: string | null
}

export async function createAbandonmentContract(data: AbandonmentContractInput) {
  try {
    const { establishmentId, userId } = await requirePermission('manage_movements')
    const supabase = await createClient()
    const admin = createAdminClient()

    const { data: contractNumber, error: numberError } = await admin.rpc(
      'get_next_abandonment_contract_number',
      { est_id: establishmentId },
    )

    if (numberError || !contractNumber) {
      return { error: 'Impossible de générer le numéro de contrat d\'abandon' }
    }

    const { data: contract, error } = await supabase
      .from('abandonment_contracts')
      .insert({
        establishment_id: establishmentId,
        contract_number: contractNumber,
        animal_id: data.animal_id,
        cedant_client_id: data.cedant_client_id,
        signature_date: data.signature_date,
        expected_handover_date: data.expected_handover_date ?? null,
        motif: data.motif,
        motif_details: data.motif_details ?? null,
        amount: data.amount ?? 0,
        note: data.note ?? null,
        cedant_id_card_number: data.cedant_id_card_number ?? null,
        cedant_passport_number: data.cedant_passport_number ?? null,
        signed_at_location: data.signed_at_location ?? null,
        signed_at: data.signed_at ?? null,
        status: data.status ?? 'draft',
        notes: data.notes ?? null,
        created_by: userId,
      })
      .select()
      .single()

    if (error) return { error: error.message }

    revalidatePath(`/animals/${data.animal_id}`)
    revalidatePath('/abandonments')
    logActivity({
      action: 'create',
      entityType: 'abandonment_contract',
      entityId: contract.id,
      entityName: contract.contract_number,
      parentType: 'animal',
      parentId: data.animal_id,
    })
    return { data: contract as AbandonmentContract }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function updateAbandonmentContract(
  id: string,
  data: Partial<AbandonmentContractInput>,
) {
  try {
    const { establishmentId } = await requirePermission('manage_movements')
    const supabase = await createClient()
    const admin = createAdminClient()

    const { data: current } = await admin
      .from('abandonment_contracts')
      .select('*')
      .eq('id', id)
      .eq('establishment_id', establishmentId)
      .single()

    if (!current) return { error: 'Contrat introuvable' }

    const { error } = await supabase
      .from('abandonment_contracts')
      .update(data)
      .eq('id', id)
      .eq('establishment_id', establishmentId)

    if (error) return { error: error.message }

    const changes = trackChanges(current, data)
    revalidatePath(`/animals/${current.animal_id}`)
    revalidatePath('/abandonments')
    logActivity({
      action: 'update',
      entityType: 'abandonment_contract',
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

export async function deleteAbandonmentContract(id: string) {
  try {
    const { establishmentId } = await requirePermission('manage_movements')
    const supabase = await createClient()
    const admin = createAdminClient()

    const { data: current } = await admin
      .from('abandonment_contracts')
      .select('animal_id, contract_number, signature_status')
      .eq('id', id)
      .eq('establishment_id', establishmentId)
      .single()

    if (current?.signature_status === 'signed') {
      return { error: 'Impossible de supprimer un contrat signé. Utilisez le statut "Annulé".' }
    }

    const { error } = await supabase
      .from('abandonment_contracts')
      .delete()
      .eq('id', id)
      .eq('establishment_id', establishmentId)

    if (error) return { error: error.message }

    if (current) {
      revalidatePath(`/animals/${current.animal_id}`)
      revalidatePath('/abandonments')
      logActivity({
        action: 'delete',
        entityType: 'abandonment_contract',
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
