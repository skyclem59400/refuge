'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireEstablishment, requirePermission } from '@/lib/establishment/permissions'
import { logActivity } from '@/lib/actions/activity-log'
import type { AnimalAttachment } from '@/lib/types/database'

export async function getAnimalAttachments(animalId: string) {
  try {
    const { establishmentId } = await requireEstablishment()
    const admin = createAdminClient()

    const { data, error } = await admin
      .from('animal_attachments')
      .select('*')
      .eq('animal_id', animalId)
      .eq('establishment_id', establishmentId)
      .order('created_at', { ascending: false })

    if (error) return { error: error.message }
    return { data: (data as AnimalAttachment[]) || [] }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

interface UploadInput {
  animalId: string
  filename: string
  mimeType: string | null
  sizeBytes: number | null
  label: string | null
  base64: string // base64 string (without prefix)
}

export async function uploadAnimalAttachment(input: UploadInput) {
  try {
    const ctx = await requirePermission('manage_animals')
    const admin = createAdminClient()

    // Verify animal belongs to current establishment
    const { data: animal } = await admin
      .from('animals')
      .select('id,name')
      .eq('id', input.animalId)
      .eq('establishment_id', ctx.establishmentId)
      .single()

    if (!animal) return { error: 'Animal introuvable' }

    const buffer = Buffer.from(input.base64, 'base64')
    const safeName = input.filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
    const path = `${ctx.establishmentId}/${input.animalId}/${Date.now()}_${safeName}`

    const { error: uploadError } = await admin.storage
      .from('animal-documents')
      .upload(path, buffer, {
        contentType: input.mimeType || 'application/octet-stream',
        upsert: false,
      })

    if (uploadError) return { error: 'Upload échoué : ' + uploadError.message }

    const { data: pub } = admin.storage.from('animal-documents').getPublicUrl(path)

    const { data: attachment, error: insertError } = await admin
      .from('animal_attachments')
      .insert({
        animal_id: input.animalId,
        establishment_id: ctx.establishmentId,
        filename: input.filename,
        file_path: path,
        file_url: pub.publicUrl,
        mime_type: input.mimeType,
        size_bytes: input.sizeBytes,
        label: input.label,
        uploaded_by: ctx.userId,
      })
      .select()
      .single()

    if (insertError) {
      // Try to cleanup the uploaded file if DB insert failed
      await admin.storage.from('animal-documents').remove([path])
      return { error: insertError.message }
    }

    revalidatePath(`/animals/${input.animalId}`)
    logActivity({
      action: 'create',
      entityType: 'animal_attachment',
      entityId: (attachment as AnimalAttachment).id,
      entityName: input.filename,
      parentType: 'animal',
      parentId: input.animalId,
    })
    return { data: attachment as AnimalAttachment }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function deleteAnimalAttachment(attachmentId: string) {
  try {
    const ctx = await requirePermission('manage_animals')
    const admin = createAdminClient()

    const { data: attachment } = await admin
      .from('animal_attachments')
      .select('*')
      .eq('id', attachmentId)
      .eq('establishment_id', ctx.establishmentId)
      .single()

    if (!attachment) return { error: 'Pièce jointe introuvable' }

    const att = attachment as AnimalAttachment
    await admin.storage.from('animal-documents').remove([att.file_path])

    const { error } = await admin
      .from('animal_attachments')
      .delete()
      .eq('id', attachmentId)

    if (error) return { error: error.message }

    revalidatePath(`/animals/${att.animal_id}`)
    logActivity({
      action: 'delete',
      entityType: 'animal_attachment',
      entityId: attachmentId,
      entityName: att.filename,
      parentType: 'animal',
      parentId: att.animal_id,
    })
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
