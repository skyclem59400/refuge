'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireEstablishment, requirePermission } from '@/lib/establishment/permissions'
import { logActivity } from '@/lib/actions/activity-log'
import type { Veterinarian, VeterinaryClinic, VeterinaryClinicWithVets } from '@/lib/types/database'

// ============================================
// Veterinary clinics
// ============================================

export async function getVeterinaryClinics(activeOnly = true) {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    let query = supabase
      .from('veterinary_clinics')
      .select('*, veterinarians(*)')
      .eq('establishment_id', establishmentId)

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query.order('name', { ascending: true })

    if (error) {
      return { error: error.message }
    }

    const sorted = (data || []).map((c) => ({
      ...c,
      veterinarians: (c.veterinarians || [])
        .filter((v: Veterinarian) => !activeOnly || v.is_active)
        .sort((a: Veterinarian, b: Veterinarian) => a.last_name.localeCompare(b.last_name)),
    }))

    return { data: sorted as VeterinaryClinicWithVets[] }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

interface ClinicInput {
  name: string
  address?: string | null
  postal_code?: string | null
  city?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
  siret?: string | null
  notes?: string | null
  is_default?: boolean
  is_active?: boolean
}

export async function createVeterinaryClinic(input: ClinicInput) {
  try {
    const { establishmentId } = await requirePermission('manage_establishment')
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('veterinary_clinics')
      .insert({
        establishment_id: establishmentId,
        name: input.name.trim(),
        address: input.address?.trim() || null,
        postal_code: input.postal_code?.trim() || null,
        city: input.city?.trim() || null,
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        website: input.website?.trim() || null,
        siret: input.siret?.trim() || null,
        notes: input.notes?.trim() || null,
        is_default: input.is_default ?? false,
        is_active: input.is_active ?? true,
      })
      .select()
      .single()

    if (error) {
      return { error: error.message }
    }

    revalidatePath('/etablissement/veterinaires')
    logActivity({ action: 'create', entityType: 'veterinary_clinic', entityId: data.id, entityName: data.name })
    return { data: data as VeterinaryClinic }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function updateVeterinaryClinic(id: string, input: Partial<ClinicInput>) {
  try {
    const { establishmentId } = await requirePermission('manage_establishment')
    const supabase = await createClient()

    const { error } = await supabase
      .from('veterinary_clinics')
      .update(input)
      .eq('id', id)
      .eq('establishment_id', establishmentId)

    if (error) {
      return { error: error.message }
    }

    revalidatePath('/etablissement/veterinaires')
    logActivity({ action: 'update', entityType: 'veterinary_clinic', entityId: id })
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function deleteVeterinaryClinic(id: string) {
  try {
    const { establishmentId } = await requirePermission('manage_establishment')
    const supabase = await createClient()

    const { error } = await supabase
      .from('veterinary_clinics')
      .delete()
      .eq('id', id)
      .eq('establishment_id', establishmentId)

    if (error) {
      if (error.message.includes('violates foreign key') || error.code === '23503') {
        return { error: 'Impossible de supprimer cette clinique car elle a des actes associes. Desactivez-la plutot.' }
      }
      return { error: error.message }
    }

    revalidatePath('/etablissement/veterinaires')
    logActivity({ action: 'delete', entityType: 'veterinary_clinic', entityId: id })
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}


// ============================================
// Veterinarians (practitioners)
// ============================================

interface VetInput {
  clinic_id: string
  first_name?: string | null
  last_name: string
  ordre_number?: string | null
  specialty?: string | null
  phone?: string | null
  email?: string | null
  is_referent?: boolean
  is_active?: boolean
  notes?: string | null
}

export async function createVeterinarian(input: VetInput) {
  try {
    const { establishmentId } = await requirePermission('manage_establishment')
    const supabase = await createClient()
    const admin = createAdminClient()

    // Verify clinic belongs to this establishment
    const { data: clinic } = await admin
      .from('veterinary_clinics')
      .select('id')
      .eq('id', input.clinic_id)
      .eq('establishment_id', establishmentId)
      .single()

    if (!clinic) {
      return { error: 'Clinique introuvable' }
    }

    const { data, error } = await supabase
      .from('veterinarians')
      .insert({
        clinic_id: input.clinic_id,
        first_name: input.first_name?.trim() || null,
        last_name: input.last_name.trim(),
        ordre_number: input.ordre_number?.trim() || null,
        specialty: input.specialty?.trim() || null,
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        is_referent: input.is_referent ?? false,
        is_active: input.is_active ?? true,
        notes: input.notes?.trim() || null,
      })
      .select()
      .single()

    if (error) {
      return { error: error.message }
    }

    revalidatePath('/etablissement/veterinaires')
    logActivity({ action: 'create', entityType: 'veterinarian', entityId: data.id, entityName: data.last_name })
    return { data: data as Veterinarian }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function updateVeterinarian(id: string, input: Partial<VetInput>) {
  try {
    await requirePermission('manage_establishment')
    const supabase = await createClient()

    const { error } = await supabase
      .from('veterinarians')
      .update(input)
      .eq('id', id)

    if (error) {
      return { error: error.message }
    }

    revalidatePath('/etablissement/veterinaires')
    logActivity({ action: 'update', entityType: 'veterinarian', entityId: id })
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function deleteVeterinarian(id: string) {
  try {
    await requirePermission('manage_establishment')
    const supabase = await createClient()

    const { error } = await supabase
      .from('veterinarians')
      .delete()
      .eq('id', id)

    if (error) {
      if (error.message.includes('violates foreign key') || error.code === '23503') {
        return { error: 'Impossible de supprimer ce vétérinaire car il a des actes associes. Desactivez-le plutot.' }
      }
      return { error: error.message }
    }

    revalidatePath('/etablissement/veterinaires')
    logActivity({ action: 'delete', entityType: 'veterinarian', entityId: id })
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
