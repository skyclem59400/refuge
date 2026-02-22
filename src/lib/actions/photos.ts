'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireEstablishment, requirePermission } from '@/lib/establishment/permissions'

// ============================================
// Read actions (use createAdminClient)
// ============================================

export async function getAnimalPhotos(animalId: string) {
  try {
    await requireEstablishment()
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('animal_photos')
      .select('*')
      .eq('animal_id', animalId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true })

    if (error) {
      return { error: error.message }
    }

    return { data }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ============================================
// Write actions (use adminClient — permission checked via requirePermission)
// ============================================

export async function uploadAnimalPhoto(animalId: string, formData: FormData) {
  try {
    const { establishmentId } = await requirePermission('manage_animals')
    const adminClient = createAdminClient()

    // Extract file from FormData
    const file = formData.get('file') as File | null
    if (!file || !(file instanceof File)) {
      return { error: 'Aucun fichier fourni' }
    }

    // Validate: must be an image
    if (!file.type.startsWith('image/')) {
      return { error: 'Le fichier doit etre une image' }
    }

    // Validate: max 5MB
    if (file.size > 5 * 1024 * 1024) {
      return { error: 'L\'image ne doit pas depasser 5 Mo' }
    }

    // Generate storage path: {establishmentId}/{animalId}/{uuid}.{ext}
    const ext = file.name.split('.').pop() || 'jpg'
    const randomId = crypto.randomUUID()
    const path = `${establishmentId}/${animalId}/${randomId}.${ext}`

    // Upload to Supabase Storage bucket "animal-photos" (use adminClient to bypass storage policies)
    const { error: uploadError } = await adminClient.storage
      .from('animal-photos')
      .upload(path, file, { upsert: false })

    if (uploadError) {
      return { error: 'Erreur lors de l\'upload : ' + uploadError.message }
    }

    // Get public URL
    const { data: { publicUrl } } = adminClient.storage
      .from('animal-photos')
      .getPublicUrl(path)

    // Check if this is the first photo (to set as primary)
    const { data: existingPhotos, error: countError } = await adminClient
      .from('animal_photos')
      .select('id')
      .eq('animal_id', animalId)

    if (countError) {
      return { error: countError.message }
    }

    const isFirst = !existingPhotos || existingPhotos.length === 0

    // Insert into animal_photos table (use adminClient to bypass RLS — permission already checked)
    const { data: photo, error: insertError } = await adminClient
      .from('animal_photos')
      .insert({
        animal_id: animalId,
        url: publicUrl,
        is_primary: isFirst,
      })
      .select()
      .single()

    if (insertError) {
      // Attempt to clean up uploaded file on DB insert failure
      await adminClient.storage.from('animal-photos').remove([path])
      return { error: insertError.message }
    }

    revalidatePath(`/animals/${animalId}`)
    revalidatePath('/animals')
    return { data: photo }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function deleteAnimalPhoto(photoId: string) {
  try {
    await requirePermission('manage_animals')
    const adminClient = createAdminClient()

    // Fetch the photo record to get the URL and animal_id
    const { data: photo, error: fetchError } = await adminClient
      .from('animal_photos')
      .select('*')
      .eq('id', photoId)
      .single()

    if (fetchError || !photo) {
      return { error: 'Photo introuvable' }
    }

    // Extract storage path from URL (everything after "/animal-photos/")
    const urlParts = photo.url.split('/animal-photos/')
    if (urlParts.length > 1) {
      const storagePath = urlParts[1].split('?')[0] // Remove query params if any
      await adminClient.storage.from('animal-photos').remove([storagePath])
    }

    // Delete from DB (use adminClient to bypass RLS — permission already checked)
    const { error: deleteError } = await adminClient
      .from('animal_photos')
      .delete()
      .eq('id', photoId)

    if (deleteError) {
      return { error: deleteError.message }
    }

    revalidatePath(`/animals/${photo.animal_id}`)
    revalidatePath('/animals')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function setPrimaryAnimalPhoto(photoId: string, animalId: string) {
  try {
    await requirePermission('manage_animals')
    const adminClient = createAdminClient()

    // First, set all photos for this animal to is_primary: false
    const { error: resetError } = await adminClient
      .from('animal_photos')
      .update({ is_primary: false })
      .eq('animal_id', animalId)

    if (resetError) {
      return { error: resetError.message }
    }

    // Then set this photo to is_primary: true
    const { error: setError } = await adminClient
      .from('animal_photos')
      .update({ is_primary: true })
      .eq('id', photoId)

    if (setError) {
      return { error: setError.message }
    }

    revalidatePath(`/animals/${animalId}`)
    revalidatePath('/animals')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
