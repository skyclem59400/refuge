'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireEstablishment, requirePermission } from '@/lib/establishment/permissions'
import { logActivity } from '@/lib/actions/activity-log'
import type {
  HealthProtocol,
  HealthProtocolStep,
  HealthProtocolWithSteps,
  HealthRecordType,
  ProtocolApplicableSpecies,
} from '@/lib/types/database'

// ============================================
// Read
// ============================================

export async function getHealthProtocols(filters?: { activeOnly?: boolean; species?: 'cat' | 'dog' }) {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    let query = supabase
      .from('health_protocols')
      .select('*, steps:health_protocol_steps(*)')
      .eq('establishment_id', establishmentId)

    if (filters?.activeOnly) {
      query = query.eq('is_active', true)
    }

    if (filters?.species) {
      query = query.in('applicable_species', [filters.species, 'both'])
    }

    const { data, error } = await query.order('name', { ascending: true })

    if (error) {
      return { error: error.message }
    }

    // Sort steps by step_order client-side
    const sorted = (data || []).map((p) => ({
      ...p,
      steps: (p.steps || []).sort((a: HealthProtocolStep, b: HealthProtocolStep) => a.step_order - b.step_order),
    }))

    return { data: sorted as HealthProtocolWithSteps[] }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function getHealthProtocol(id: string) {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('health_protocols')
      .select('*, steps:health_protocol_steps(*)')
      .eq('id', id)
      .eq('establishment_id', establishmentId)
      .single()

    if (error || !data) {
      return { error: 'Protocole introuvable' }
    }

    const sorted = {
      ...data,
      steps: (data.steps || []).sort((a: HealthProtocolStep, b: HealthProtocolStep) => a.step_order - b.step_order),
    }

    return { data: sorted as HealthProtocolWithSteps }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ============================================
// Write
// ============================================

interface ProtocolStepInput {
  label: string
  health_record_type: HealthRecordType
  offset_days: number
  recurrence_days: number | null
  description: string | null
}

interface ProtocolInput {
  name: string
  description?: string | null
  applicable_species: ProtocolApplicableSpecies
  is_active?: boolean
  steps: ProtocolStepInput[]
}

export async function createHealthProtocol(input: ProtocolInput) {
  try {
    const { establishmentId, userId } = await requirePermission('manage_health')
    const supabase = await createClient()

    if (input.steps.length === 0) {
      return { error: 'Un protocole doit comporter au moins une etape' }
    }

    const { data: protocol, error } = await supabase
      .from('health_protocols')
      .insert({
        establishment_id: establishmentId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        applicable_species: input.applicable_species,
        is_active: input.is_active ?? true,
        created_by: userId,
      })
      .select()
      .single()

    if (error || !protocol) {
      return { error: error?.message || 'Erreur creation protocole' }
    }

    const stepsPayload = input.steps.map((step, index) => ({
      protocol_id: protocol.id,
      step_order: index + 1,
      label: step.label.trim(),
      health_record_type: step.health_record_type,
      offset_days: step.offset_days,
      recurrence_days: step.recurrence_days,
      description: step.description?.trim() || null,
    }))

    const { error: stepsError } = await supabase
      .from('health_protocol_steps')
      .insert(stepsPayload)

    if (stepsError) {
      // Rollback
      await supabase.from('health_protocols').delete().eq('id', protocol.id)
      return { error: stepsError.message }
    }

    revalidatePath('/health/protocols')
    logActivity({ action: 'create', entityType: 'health_protocol', entityId: protocol.id, entityName: protocol.name })
    return { data: protocol as HealthProtocol }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function updateHealthProtocol(id: string, input: ProtocolInput) {
  try {
    const { establishmentId } = await requirePermission('manage_health')
    const supabase = await createClient()

    if (input.steps.length === 0) {
      return { error: 'Un protocole doit comporter au moins une etape' }
    }

    const { error: protocolError } = await supabase
      .from('health_protocols')
      .update({
        name: input.name.trim(),
        description: input.description?.trim() || null,
        applicable_species: input.applicable_species,
        is_active: input.is_active ?? true,
      })
      .eq('id', id)
      .eq('establishment_id', establishmentId)

    if (protocolError) {
      return { error: protocolError.message }
    }

    // Replace steps wholesale
    const { error: deleteError } = await supabase
      .from('health_protocol_steps')
      .delete()
      .eq('protocol_id', id)

    if (deleteError) {
      return { error: deleteError.message }
    }

    const stepsPayload = input.steps.map((step, index) => ({
      protocol_id: id,
      step_order: index + 1,
      label: step.label.trim(),
      health_record_type: step.health_record_type,
      offset_days: step.offset_days,
      recurrence_days: step.recurrence_days,
      description: step.description?.trim() || null,
    }))

    const { error: insertError } = await supabase
      .from('health_protocol_steps')
      .insert(stepsPayload)

    if (insertError) {
      return { error: insertError.message }
    }

    revalidatePath('/health/protocols')
    logActivity({ action: 'update', entityType: 'health_protocol', entityId: id, entityName: input.name })
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function deleteHealthProtocol(id: string) {
  try {
    const { establishmentId } = await requirePermission('manage_health')
    const supabase = await createClient()

    const { data: existing } = await supabase
      .from('health_protocols')
      .select('name')
      .eq('id', id)
      .eq('establishment_id', establishmentId)
      .single()

    const { error } = await supabase
      .from('health_protocols')
      .delete()
      .eq('id', id)
      .eq('establishment_id', establishmentId)

    if (error) {
      if (error.message.includes('violates foreign key') || error.code === '23503') {
        return { error: 'Impossible de supprimer ce protocole car il a deja ete applique a des animaux. Desactivez-le plutot.' }
      }
      return { error: error.message }
    }

    revalidatePath('/health/protocols')
    logActivity({ action: 'delete', entityType: 'health_protocol', entityId: id, entityName: existing?.name })
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ============================================
// Apply protocol to animal
// ============================================

export async function applyProtocolToAnimal(params: {
  animalId: string
  protocolId: string
  startDate: string
}) {
  try {
    const { establishmentId, userId } = await requirePermission('manage_health')
    const supabase = await createClient()
    const admin = createAdminClient()

    // Verify animal belongs to establishment
    const { data: animal, error: animalError } = await admin
      .from('animals')
      .select('id, name')
      .eq('id', params.animalId)
      .eq('establishment_id', establishmentId)
      .single()

    if (animalError || !animal) {
      return { error: 'Animal introuvable' }
    }

    // Verify protocol belongs to establishment
    const { data: protocol, error: protocolError } = await admin
      .from('health_protocols')
      .select('id, name')
      .eq('id', params.protocolId)
      .eq('establishment_id', establishmentId)
      .single()

    if (protocolError || !protocol) {
      return { error: 'Protocole introuvable' }
    }

    // Use RPC to apply the protocol (creates instance + records in transaction)
    const { data: instanceId, error: rpcError } = await supabase.rpc('apply_protocol_to_animal', {
      p_animal_id: params.animalId,
      p_protocol_id: params.protocolId,
      p_start_date: params.startDate,
      p_user_id: userId,
    })

    if (rpcError) {
      return { error: rpcError.message }
    }

    revalidatePath(`/animals/${params.animalId}`)
    revalidatePath('/health')
    logActivity({
      action: 'create',
      entityType: 'protocol_instance',
      entityId: instanceId as string,
      entityName: protocol.name,
      parentType: 'animal',
      parentId: params.animalId,
    })
    return { data: { instanceId } }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
