'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireEstablishment, requirePermission } from '@/lib/establishment/permissions'
import { logActivity } from '@/lib/actions/activity-log'

export interface BoxZone {
  id: string
  name: string
  parent_id: string | null
  description: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export async function listBoxZones(): Promise<{ data?: BoxZone[]; error?: string }> {
  try {
    const { establishmentId } = await requireEstablishment()
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('box_zones')
      .select('id, name, parent_id, description, sort_order, created_at, updated_at')
      .eq('establishment_id', establishmentId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
    if (error) return { error: error.message }
    return { data: (data ?? []) as BoxZone[] }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

interface CreateZoneInput {
  name: string
  parent_id?: string | null
  description?: string | null
}

export async function createBoxZone(input: CreateZoneInput) {
  try {
    const { establishmentId } = await requirePermission('manage_boxes')
    const supabase = await createClient()

    const trimmedName = input.name.trim()
    if (!trimmedName) return { error: 'Le nom est requis.' }

    const { data: zone, error } = await supabase
      .from('box_zones')
      .insert({
        establishment_id: establishmentId,
        name: trimmedName,
        parent_id: input.parent_id ?? null,
        description: input.description ?? null,
      })
      .select('id, name, parent_id')
      .single()

    if (error) return { error: error.message }

    logActivity({
      action: 'create',
      entityType: 'box_zone',
      entityId: zone.id,
      entityName: zone.name,
      details: { parent_id: zone.parent_id },
    })
    revalidatePath('/boxes')
    return { data: zone }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

interface UpdateZoneInput {
  name?: string
  description?: string | null
  parent_id?: string | null
  sort_order?: number
}

export async function updateBoxZone(id: string, input: UpdateZoneInput) {
  try {
    const { establishmentId } = await requirePermission('manage_boxes')
    const supabase = await createClient()

    const updates: Record<string, unknown> = {}
    if (typeof input.name === 'string') {
      const trimmed = input.name.trim()
      if (!trimmed) return { error: 'Le nom est requis.' }
      updates.name = trimmed
    }
    if (input.description !== undefined) updates.description = input.description
    if (input.parent_id !== undefined) updates.parent_id = input.parent_id
    if (typeof input.sort_order === 'number') updates.sort_order = input.sort_order

    if (Object.keys(updates).length === 0) return { success: true }

    const { error } = await supabase
      .from('box_zones')
      .update(updates)
      .eq('id', id)
      .eq('establishment_id', establishmentId)
    if (error) return { error: error.message }

    logActivity({
      action: 'update',
      entityType: 'box_zone',
      entityId: id,
      entityName: typeof input.name === 'string' ? input.name : undefined,
      details: updates,
    })
    revalidatePath('/boxes')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function deleteBoxZone(id: string) {
  try {
    const { establishmentId } = await requirePermission('manage_boxes')
    const supabase = await createClient()
    const admin = createAdminClient()

    // Vérifie qu'aucun box n'est rattaché à cette zone
    const { data: linkedBoxes } = await admin
      .from('boxes')
      .select('id')
      .eq('zone_id', id)
      .eq('establishment_id', establishmentId)
      .limit(1)
    if (linkedBoxes && linkedBoxes.length > 0) {
      return { error: 'Impossible de supprimer : des box sont rattachés à cette zone.' }
    }

    const { data: info } = await admin
      .from('box_zones')
      .select('name')
      .eq('id', id)
      .single()

    const { error } = await supabase
      .from('box_zones')
      .delete()
      .eq('id', id)
      .eq('establishment_id', establishmentId)
    if (error) return { error: error.message }

    logActivity({
      action: 'delete',
      entityType: 'box_zone',
      entityId: id,
      entityName: info?.name,
    })
    revalidatePath('/boxes')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
