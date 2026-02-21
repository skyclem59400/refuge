'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireEstablishment, requirePermission } from '@/lib/establishment/permissions'
import type { IcadDeclaration, IcadDeclarationType, IcadDeclarationStatus } from '@/lib/types/database'

export async function getAnimalDeclarations(animalId: string) {
  try {
    await requireEstablishment()
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('icad_declarations')
      .select('*')
      .eq('animal_id', animalId)
      .order('created_at', { ascending: false })

    if (error) return { error: error.message }
    return { data: data as IcadDeclaration[] }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function getPendingDeclarations() {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('icad_declarations')
      .select(`
        *,
        animals!inner (id, name, species, chip_number, establishment_id)
      `)
      .eq('animals.establishment_id', establishmentId)
      .in('status', ['pending', 'error'])
      .order('created_at', { ascending: true })

    if (error) return { error: error.message }
    return { data: data as (IcadDeclaration & { animals: { id: string; name: string; species: string; chip_number: string | null; establishment_id: string } })[] }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function getAllDeclarations(filters?: { status?: IcadDeclarationStatus }) {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    let query = supabase
      .from('icad_declarations')
      .select(`
        *,
        animals!inner (id, name, species, chip_number, establishment_id)
      `)
      .eq('animals.establishment_id', establishmentId)
      .order('created_at', { ascending: false })

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    const { data, error } = await query
    if (error) return { error: error.message }
    return { data: data as (IcadDeclaration & { animals: { id: string; name: string; species: string; chip_number: string | null; establishment_id: string } })[] }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function createDeclaration(data: {
  animal_id: string
  movement_id?: string | null
  declaration_type: IcadDeclarationType
  notes?: string | null
}) {
  try {
    await requirePermission('manage_movements')
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: declaration, error } = await supabase
      .from('icad_declarations')
      .insert({
        animal_id: data.animal_id,
        movement_id: data.movement_id || null,
        declaration_type: data.declaration_type,
        status: 'pending' as IcadDeclarationStatus,
        notes: data.notes || null,
        created_by: user?.id,
      })
      .select()
      .single()

    if (error) return { error: error.message }

    revalidatePath('/icad')
    return { data: declaration as IcadDeclaration }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function updateDeclarationStatus(
  id: string,
  status: IcadDeclarationStatus,
  extra?: { icad_reference?: string; error_message?: string; notes?: string }
) {
  try {
    await requirePermission('manage_movements')
    const supabase = await createClient()

    const updateData: Record<string, unknown> = { status }

    if (status === 'submitted') {
      updateData.submitted_at = new Date().toISOString()
    }
    if (status === 'confirmed') {
      updateData.confirmed_at = new Date().toISOString()
    }
    if (extra?.icad_reference) {
      updateData.icad_reference = extra.icad_reference
    }
    if (extra?.error_message) {
      updateData.error_message = extra.error_message
    }
    if (extra?.notes !== undefined) {
      updateData.notes = extra.notes
    }

    const { data: declaration, error } = await supabase
      .from('icad_declarations')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) return { error: error.message }

    // Also update the animal's icad_updated flag if confirmed
    if (status === 'confirmed' && declaration) {
      await supabase
        .from('animals')
        .update({ icad_updated: true })
        .eq('id', declaration.animal_id)
    }

    revalidatePath('/icad')
    return { data: declaration as IcadDeclaration }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function deleteDeclaration(id: string) {
  try {
    await requirePermission('manage_movements')
    const supabase = await createClient()

    const { error } = await supabase
      .from('icad_declarations')
      .delete()
      .eq('id', id)

    if (error) return { error: error.message }

    revalidatePath('/icad')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function getIcadStats() {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('icad_declarations')
      .select(`
        status,
        animals!inner (establishment_id)
      `)
      .eq('animals.establishment_id', establishmentId)

    if (error) return { error: error.message }

    const declarations = data || []
    const pending = declarations.filter(d => d.status === 'pending').length
    const submitted = declarations.filter(d => d.status === 'submitted').length
    const confirmed = declarations.filter(d => d.status === 'confirmed').length
    const errors = declarations.filter(d => d.status === 'error').length
    const total = declarations.length

    return {
      data: { pending, submitted, confirmed, errors, total }
    }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
