'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireEstablishment, requirePermission } from '@/lib/establishment/permissions'
import type { AnimalSpecies, AnimalSex, AnimalOrigin, MovementType, IcadStatus } from '@/lib/types/database'

// ============================================
// Read actions
// ============================================

export async function getInterventions(filters?: {
  search?: string
}) {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    let query = supabase
      .from('pound_interventions')
      .select('*, animals(id, name, species, sex, animal_photos(url, is_primary))')
      .eq('establishment_id', establishmentId)

    if (filters?.search) {
      const search = `%${filters.search}%`
      query = query.or(`caller_name.ilike.${search},location_city.ilike.${search},location_street.ilike.${search}`)
    }

    const { data, error } = await query.order('intervention_date', { ascending: false })

    if (error) {
      return { error: error.message }
    }

    const interventions = data || []

    // Enrich with intervenant names via RPC
    if (interventions.length > 0) {
      const userIds = [...new Set(interventions.map((i: { intervened_by: string }) => i.intervened_by))]
      const authClient = await createClient()
      const { data: usersInfo } = await authClient.rpc('get_users_info', {
        user_ids: userIds,
      })

      if (usersInfo && Array.isArray(usersInfo)) {
        const userMap = new Map(
          usersInfo.map((u: { id: string; email: string; full_name: string | null }) => [u.id, u])
        )
        for (const intervention of interventions) {
          const info = userMap.get((intervention as { intervened_by: string }).intervened_by)
          if (info) {
            ;(intervention as Record<string, unknown>).intervenant_name = info.full_name || info.email
          }
        }
      }
    }

    return { data: interventions }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ============================================
// Write actions
// ============================================

export async function createIntervention(formData: FormData) {
  try {
    const { establishmentId, userId } = await requirePermission('manage_movements')
    const adminClient = createAdminClient()

    // Extract form fields
    const callerName = formData.get('caller_name') as string
    const callerPhone = (formData.get('caller_phone') as string) || null
    const callerEmail = (formData.get('caller_email') as string) || null
    const locationStreetNumber = (formData.get('location_street_number') as string) || null
    const locationStreet = formData.get('location_street') as string
    const locationCity = formData.get('location_city') as string
    const notes = (formData.get('notes') as string) || null
    const species = (formData.get('species') as AnimalSpecies) || 'dog'
    const sex = (formData.get('sex') as AnimalSex) || 'unknown'
    const breed = (formData.get('breed') as string) || null
    const originType = (formData.get('origin_type') as AnimalOrigin) || 'found'
    const animalName = (formData.get('animal_name') as string) || null
    const file = formData.get('photo') as File | null

    if (!callerName || !locationStreet || !locationCity) {
      return { error: 'Champs obligatoires manquants (appelant, rue, commune)' }
    }

    const now = new Date().toISOString()
    const dateLabel = new Date().toLocaleDateString('fr-FR')

    // 1. Auto-generate medal number
    const { data: nextMedal } = await adminClient.rpc('get_next_medal_number', {
      est_id: establishmentId,
    })

    // 2. Create the animal with minimal info
    const supabase = await createClient()
    const { data: animal, error: animalError } = await supabase
      .from('animals')
      .insert({
        establishment_id: establishmentId,
        name: animalName || `Intervention ${dateLabel}`,
        species,
        sex,
        breed,
        origin_type: originType,
        status: 'pound' as const,
        pound_entry_date: now,
        capture_location: [locationStreetNumber, locationStreet, locationCity].filter(Boolean).join(', '),
        medal_number: nextMedal ? String(nextMedal) : null,
      })
      .select()
      .single()

    if (animalError || !animal) {
      return { error: 'Erreur lors de la creation de l\'animal : ' + (animalError?.message || 'Inconnu') }
    }

    // 3. Upload photo if provided
    if (file && file instanceof File && file.size > 0) {
      if (!file.type.startsWith('image/')) {
        // Non-blocking: skip non-image files
        console.warn('[Intervention] File is not an image, skipping photo upload')
      } else if (file.size > 5 * 1024 * 1024) {
        console.warn('[Intervention] File too large, skipping photo upload')
      } else {
        const ext = file.name.split('.').pop() || 'jpg'
        const randomId = crypto.randomUUID()
        const path = `${establishmentId}/${animal.id}/${randomId}.${ext}`

        const { error: uploadError } = await adminClient.storage
          .from('animal-photos')
          .upload(path, file, { upsert: false })

        if (!uploadError) {
          const { data: { publicUrl } } = adminClient.storage
            .from('animal-photos')
            .getPublicUrl(path)

          await adminClient
            .from('animal_photos')
            .insert({
              animal_id: animal.id,
              url: publicUrl,
              is_primary: true,
            })
        } else {
          console.error('[Intervention] Photo upload failed:', uploadError.message)
        }
      }
    }

    // 4. Create pound_entry movement
    const originNotes: Record<string, string> = {
      found: 'Animal trouve - intervention fourriere',
      abandoned: 'Animal abandonne - intervention fourriere',
      transferred_in: 'Transfert entrant - intervention fourriere',
      surrender: 'Cession par le proprietaire - intervention fourriere',
      requisition: 'Requisition - intervention fourriere',
      divagation: 'Divagation - intervention fourriere',
    }

    await supabase
      .from('animal_movements')
      .insert({
        animal_id: animal.id,
        type: 'pound_entry' as MovementType,
        date: now,
        notes: originNotes[originType] || 'Intervention fourriere',
        icad_status: 'pending' as IcadStatus,
        created_by: userId,
      })

    // 5. Create the intervention record
    const { data: intervention, error: interventionError } = await supabase
      .from('pound_interventions')
      .insert({
        establishment_id: establishmentId,
        animal_id: animal.id,
        caller_name: callerName,
        caller_phone: callerPhone,
        caller_email: callerEmail,
        location_street_number: locationStreetNumber,
        location_street: locationStreet,
        location_city: locationCity,
        intervention_date: now,
        intervened_by: userId,
        notes,
        created_by: userId,
      })
      .select()
      .single()

    if (interventionError) {
      return { error: 'Erreur lors de la creation de l\'intervention : ' + interventionError.message }
    }

    revalidatePath('/pound')
    revalidatePath('/pound/interventions')
    revalidatePath('/animals')
    revalidatePath('/dashboard')

    return { data: intervention }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function deleteIntervention(id: string) {
  try {
    const { establishmentId } = await requirePermission('manage_movements')
    const supabase = await createClient()

    const { error } = await supabase
      .from('pound_interventions')
      .delete()
      .eq('id', id)
      .eq('establishment_id', establishmentId)

    if (error) {
      return { error: error.message }
    }

    revalidatePath('/pound')
    revalidatePath('/pound/interventions')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
