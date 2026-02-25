'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/establishment/permissions'
import type { ContactCategory } from '@/lib/types/database'

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
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function deleteClientAction(id: string) {
  try {
    const { establishmentId } = await requirePermission('manage_clients')
    const supabase = await createClient()
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

    revalidatePath('/clients')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
