'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { ClientType } from '@/lib/types/database'

export async function createClientAction(data: {
  name: string
  email?: string | null
  phone?: string | null
  address?: string | null
  postal_code?: string | null
  city?: string | null
  type?: ClientType | null
  notes?: string | null
}) {
  const supabase = await createClient()
  const { data: client, error } = await supabase
    .from('clients')
    .insert(data)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/clients')
  revalidatePath('/dashboard')
  return { data: client }
}

export async function updateClientAction(id: string, data: {
  name?: string
  email?: string | null
  phone?: string | null
  address?: string | null
  postal_code?: string | null
  city?: string | null
  type?: ClientType | null
  notes?: string | null
}) {
  const supabase = await createClient()
  const { error } = await supabase.from('clients').update(data).eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/clients')
  revalidatePath(`/clients/${id}`)
  return { success: true }
}

export async function deleteClientAction(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('clients').delete().eq('id', id)

  if (error) {
    if (error.message.includes('violates foreign key') || error.code === '23503') {
      return { error: 'Impossible de supprimer ce client car il a des documents associes' }
    }
    return { error: error.message }
  }

  revalidatePath('/clients')
  revalidatePath('/dashboard')
  return { success: true }
}
