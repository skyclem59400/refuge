'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireEstablishment, requirePermission } from '@/lib/establishment/permissions'
import type { ContactCategory } from '@/lib/types/database'
import { logActivity } from '@/lib/actions/activity-log'

export async function searchClientsByCategory(category: ContactCategory, search?: string) {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    let query = supabase
      .from('clients')
      .select('id, name, email, phone, city')
      .eq('establishment_id', establishmentId)
      .eq('type', category)

    if (search && search.trim()) {
      const term = `%${search.trim()}%`
      query = query.or(`name.ilike.${term},email.ilike.${term},city.ilike.${term}`)
    }

    const { data, error } = await query.order('name', { ascending: true }).limit(20)

    if (error) {
      return { error: error.message }
    }

    return { data: data ?? [] }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/**
 * Search across ALL contacts of the establishment regardless of their category.
 * Useful for pickers that allow on-the-fly category conversion (e.g. promote
 * an existing client into a foster_family when linking a movement).
 * Each result includes its current `type` so the caller can display a badge
 * and decide whether to convert.
 */
export async function searchAllClients(search?: string) {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    let query = supabase
      .from('clients')
      .select('id, name, email, phone, city, type')
      .eq('establishment_id', establishmentId)

    if (search && search.trim()) {
      const term = `%${search.trim()}%`
      query = query.or(`name.ilike.${term},email.ilike.${term},city.ilike.${term}`)
    }

    const { data, error } = await query.order('name', { ascending: true }).limit(30)

    if (error) {
      return { error: error.message }
    }

    return { data: data ?? [] }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function createClientAction(data: {
  name: string
  email?: string | null
  phone?: string | null
  address?: string | null
  postal_code?: string | null
  city?: string | null
  type?: ContactCategory | null
  notes?: string | null
}) {
  try {
    const { establishmentId } = await requirePermission('manage_clients')
    const supabase = await createClient()
    const { data: client, error } = await supabase
      .from('clients')
      .insert({ ...data, establishment_id: establishmentId })
      .select()
      .single()

    if (error) {
      return { error: error.message }
    }

    revalidatePath('/clients')
    revalidatePath('/dashboard')
    logActivity({ action: 'create', entityType: 'client', entityId: client.id, entityName: data.name })
    return { data: client }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function updateClientAction(id: string, data: {
  name?: string
  email?: string | null
  phone?: string | null
  address?: string | null
  postal_code?: string | null
  city?: string | null
  type?: ContactCategory | null
  notes?: string | null
}) {
  try {
    const { establishmentId } = await requirePermission('manage_clients')
    const supabase = await createClient()
    const { error } = await supabase
      .from('clients')
      .update(data)
      .eq('id', id)
      .eq('establishment_id', establishmentId)

    if (error) {
      return { error: error.message }
    }

    revalidatePath('/clients')
    revalidatePath(`/clients/${id}`)
    logActivity({ action: 'update', entityType: 'client', entityId: id, entityName: data.name })
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function deleteClientAction(id: string) {
  try {
    const { establishmentId } = await requirePermission('manage_clients')
    const supabase = await createClient()

    const { data: clientInfo } = await supabase.from('clients').select('name').eq('id', id).eq('establishment_id', establishmentId).single()

    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id)
      .eq('establishment_id', establishmentId)

    if (error) {
      if (error.message.includes('violates foreign key') || error.code === '23503') {
        return { error: 'Impossible de supprimer ce client car il a des documents associes' }
      }
      return { error: error.message }
    }

    logActivity({ action: 'delete', entityType: 'client', entityId: id, entityName: clientInfo?.name })
    revalidatePath('/clients')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
