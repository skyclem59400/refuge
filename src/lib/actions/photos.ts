'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireEstablishment, requirePermission } from '@/lib/establishment/permissions'
import { logActivity } from '@/lib/actions/activity-log'

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

/**
 * Register an animal photo whose binary has already been uploaded
 * to Supabase Storage from the browser. This action only handles
 * the DB row + permissions check — no large body crosses the wire.
 *
 * The legacy formData-based upload is kept below for the few callers
 * that haven't been migrated, but new code should use this.
 */
export async function registerAnimalPhoto(params: {
  animalId: string
  storagePath: string
  publicUrl: string
}) {
  try {
    const { establishmentId } = await requirePermission('manage_animals')
    const adminClient = createAdminClient()

    // Sanity check: path must start with the user's establishment id
    if (!params.storagePath.startsWith(`${establishmentId}/`)) {
      return { error: "Chemin de stockage invalide pour cet etablissement" }
    }

    const { data: existingPhotos, error: countError } = await adminClient
      .from('animal_photos')
      .select('id')
      .eq('animal_id', params.animalId)

    if (countError) {
      return { error: countError.message }
    }

    const isFirst = !existingPhotos || existingPhotos.length === 0

    const { data: photo, error: insertError } = await adminClient
      .from('animal_photos')
      .insert({
        animal_id: params.animalId,
        url: params.publicUrl,
        is_primary: isFirst,
      })
      .select()
      .single()

    if (insertError) {
      // Best-effort cleanup of the orphan storage object
      await adminClient.storage.from('animal-photos').remove([params.storagePath])
      return { error: insertError.message }
    }

    await logActivity({
      action: 'create',
      entityType: 'photo',
      entityId: photo.id,
      entityName: `Photo de l'animal`,
      parentType: 'animal',
      parentId: params.animalId,
      details: { is_primary: isFirst },
    })

    revalidatePath(`/animals/${params.animalId}`)
    revalidatePath('/animals')
    return { data: photo }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

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

    // Validate: max 10MB
    if (file.size > 10 * 1024 * 1024) {
      return { error: 'L\'image ne doit pas depasser 10 Mo' }
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

    // Règle : tant qu'il existe au moins une photo, EXACTEMENT UNE doit être
    // primary. Donc on auto-marque la nouvelle comme primary si AUCUNE des
    // photos existantes ne l'est. Avant (length===0) on ratait le cas où
    // l'animal avait déjà des photos mais aucune marquée (cas Sally
    // post-migration Hunimalis) → photo_url vitrine restait null → animal
    // filtré du site public alors qu'Optimus affichait bien une vignette.
    const { data: existingPhotos, error: countError } = await adminClient
      .from('animal_photos')
      .select('id, is_primary')
      .eq('animal_id', animalId)

    if (countError) {
      return { error: countError.message }
    }

    const shouldBePrimary =
      !existingPhotos ||
      existingPhotos.length === 0 ||
      !existingPhotos.some((p) => p.is_primary)

    // Insert into animal_photos table (use adminClient to bypass RLS — permission already checked)
    const { data: photo, error: insertError } = await adminClient
      .from('animal_photos')
      .insert({
        animal_id: animalId,
        url: publicUrl,
        is_primary: shouldBePrimary,
      })
      .select()
      .single()

    if (insertError) {
      // Attempt to clean up uploaded file on DB insert failure
      await adminClient.storage.from('animal-photos').remove([path])
      return { error: insertError.message }
    }

    // Sync animals.photo_url quand on devient la nouvelle primary — sinon
    // la vitrine publique ne voit pas l'animal (filtre photo_url NOT NULL).
    if (shouldBePrimary) {
      const { error: syncErr } = await adminClient
        .from('animals')
        .update({ photo_url: publicUrl })
        .eq('id', animalId)
      if (syncErr) {
        console.error('[uploadAnimalPhoto] failed to sync animals.photo_url', syncErr)
      }
    }

    await logActivity({
      action: 'create',
      entityType: 'photo',
      entityId: photo.id,
      entityName: `Photo de l'animal`,
      parentType: 'animal',
      parentId: animalId,
      details: { is_primary: shouldBePrimary, file_name: file.name },
    })

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

    // Si on vient de supprimer LA photo principale : promouvoir la plus
    // ancienne photo restante au rôle de principale, et sync animals.photo_url.
    // Si plus aucune photo : remettre animals.photo_url à null. C'est ce qui
    // garantit l'invariant "exactement une primary tant qu'il existe ≥1 photo".
    if (photo.is_primary) {
      const { data: remaining } = await adminClient
        .from('animal_photos')
        .select('id, url, created_at')
        .eq('animal_id', photo.animal_id)
        .order('created_at', { ascending: true })
        .limit(1)

      const next = remaining?.[0]
      if (next) {
        await adminClient
          .from('animal_photos')
          .update({ is_primary: true })
          .eq('id', next.id)
        await adminClient
          .from('animals')
          .update({ photo_url: next.url })
          .eq('id', photo.animal_id)
      } else {
        await adminClient
          .from('animals')
          .update({ photo_url: null })
          .eq('id', photo.animal_id)
      }
    }

    await logActivity({
      action: 'delete',
      entityType: 'photo',
      entityId: photoId,
      entityName: `Photo de l'animal`,
      parentType: 'animal',
      parentId: photo.animal_id,
      details: { url: photo.url, was_primary: photo.is_primary },
    })

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

    // 1. Récupère l'URL de la nouvelle photo principale — on en a besoin
    //    pour synchroniser animals.photo_url (la vitrine publique du site
    //    SDA lit photo_url directement pour la liste /animaux).
    const { data: photo, error: fetchError } = await adminClient
      .from('animal_photos')
      .select('url, animal_id')
      .eq('id', photoId)
      .maybeSingle()

    if (fetchError) return { error: fetchError.message }
    if (!photo) return { error: 'Photo introuvable' }
    if (photo.animal_id !== animalId) {
      return { error: "Cette photo n'appartient pas à cet animal" }
    }

    // 2. Reset toutes les photos de l'animal à is_primary = false
    const { error: resetError } = await adminClient
      .from('animal_photos')
      .update({ is_primary: false })
      .eq('animal_id', animalId)

    if (resetError) return { error: resetError.message }

    // 3. Set la photo cible à is_primary = true
    const { error: setError } = await adminClient
      .from('animal_photos')
      .update({ is_primary: true })
      .eq('id', photoId)

    if (setError) return { error: setError.message }

    // 4. Sync animals.photo_url — c'est ce qui rend la photo visible sur la
    //    liste publique /animaux du site SDA (la fiche détail, elle, lit
    //    déjà animal_photos.is_primary correctement).
    const { error: animalUpdateError } = await adminClient
      .from('animals')
      .update({ photo_url: photo.url })
      .eq('id', animalId)

    if (animalUpdateError) {
      console.error('[setPrimaryAnimalPhoto] failed to sync animals.photo_url', animalUpdateError)
      // On ne renvoie pas une erreur bloquante : is_primary est déjà set
      // côté animal_photos. Mais on log pour visibilité.
    }

    await logActivity({
      action: 'update',
      entityType: 'photo',
      entityId: photoId,
      entityName: `Photo principale`,
      parentType: 'animal',
      parentId: animalId,
      details: { is_primary: { old: false, new: true } },
    })

    revalidatePath(`/animals/${animalId}`)
    revalidatePath('/animals')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
