'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/establishment/permissions'
import { logActivity } from '@/lib/actions/activity-log'
import type { JudicialAttachment, JudicialAttachmentKind } from '@/lib/types/database'

const BUCKET = 'judicial-documents'
const MAX_SIZE_BYTES = 20 * 1024 * 1024 // 20 MB
const SIGNED_URL_TTL_SECONDS = 60 * 60 // 60 minutes

const VALID_KINDS: readonly JudicialAttachmentKind[] = [
  'seizure_pv',
  'requisition_order',
  'court_decision',
  'vet_report',
  'photo_evidence',
  'invoice',
  'other',
]

function isValidKind(value: string): value is JudicialAttachmentKind {
  return (VALID_KINDS as readonly string[]).includes(value)
}

function safeFilename(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, '_')
  return cleaned.length > 120 ? cleaned.slice(0, 120) : cleaned
}

// ---------------------------------------------------------------------------
// uploadJudicialAttachment — multipart upload via FormData
// ---------------------------------------------------------------------------

export async function uploadJudicialAttachment(
  formData: FormData
): Promise<{ data?: JudicialAttachment; error?: string }> {
  try {
    const ctx = await requirePermission('manage_animals')
    const admin = createAdminClient()

    const file = formData.get('file')
    const animalId = formData.get('animal_id')
    const kindRaw = formData.get('kind')
    const documentDateRaw = formData.get('document_date')
    const notesRaw = formData.get('notes')

    if (!(file instanceof File)) {
      return { error: 'Aucun fichier fourni' }
    }
    if (typeof animalId !== 'string' || !animalId) {
      return { error: 'animal_id manquant' }
    }
    if (file.size === 0) {
      return { error: 'Fichier vide' }
    }
    if (file.size > MAX_SIZE_BYTES) {
      return { error: `Fichier trop volumineux (max ${MAX_SIZE_BYTES / (1024 * 1024)} Mo)` }
    }

    const kindStr = typeof kindRaw === 'string' && kindRaw ? kindRaw : 'other'
    const kind: JudicialAttachmentKind = isValidKind(kindStr) ? kindStr : 'other'

    const documentDate =
      typeof documentDateRaw === 'string' && documentDateRaw.trim() !== ''
        ? documentDateRaw.trim()
        : null
    const notes =
      typeof notesRaw === 'string' && notesRaw.trim() !== '' ? notesRaw.trim() : null

    // Verify animal belongs to current establishment
    const { data: animal } = await admin
      .from('animals')
      .select('id')
      .eq('id', animalId)
      .eq('establishment_id', ctx.establishmentId)
      .single()

    if (!animal) return { error: 'Animal introuvable' }

    const fileName = safeFilename(file.name || 'document')
    const path = `${ctx.establishmentId}/${animalId}/${Date.now()}_${fileName}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })

    if (uploadError) {
      return { error: 'Upload échoué : ' + uploadError.message }
    }

    const { data: row, error: insertError } = await admin
      .from('judicial_attachments')
      .insert({
        establishment_id: ctx.establishmentId,
        animal_id: animalId,
        kind,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
        document_date: documentDate,
        notes,
        uploaded_by: ctx.userId,
      })
      .select()
      .single()

    if (insertError || !row) {
      // Cleanup the uploaded file if DB insert failed
      await admin.storage.from(BUCKET).remove([path])
      return { error: insertError?.message || 'Insertion échouée' }
    }

    const attachment = row as JudicialAttachment

    void logActivity({
      action: 'create',
      entityType: 'judicial_attachment',
      entityId: attachment.id,
      entityName: file.name,
      parentType: 'animal',
      parentId: animalId,
      details: { kind, file_name: file.name },
    })

    revalidatePath(`/animals/${animalId}`)

    // Enrich with signed URL for immediate access
    const { data: signed } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)

    return {
      data: {
        ...attachment,
        signed_url: signed?.signedUrl,
      },
    }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ---------------------------------------------------------------------------
// listJudicialAttachments — fetch with signed URLs
// ---------------------------------------------------------------------------

export async function listJudicialAttachments(
  animalId: string
): Promise<{ data?: JudicialAttachment[]; error?: string }> {
  try {
    const ctx = await requirePermission('manage_animals')
    const admin = createAdminClient()

    const { data, error } = await admin
      .from('judicial_attachments')
      .select('*')
      .eq('animal_id', animalId)
      .eq('establishment_id', ctx.establishmentId)
      .order('created_at', { ascending: false })

    if (error) return { error: error.message }

    const rows = (data as JudicialAttachment[]) || []

    const enriched = await Promise.all(
      rows.map(async (row) => {
        const { data: signed } = await admin.storage
          .from(BUCKET)
          .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS)
        return { ...row, signed_url: signed?.signedUrl }
      })
    )

    return { data: enriched }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ---------------------------------------------------------------------------
// deleteJudicialAttachment — remove file + row + revalidate
// ---------------------------------------------------------------------------

export async function deleteJudicialAttachment(
  id: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const ctx = await requirePermission('manage_animals')
    const admin = createAdminClient()

    const { data: row } = await admin
      .from('judicial_attachments')
      .select('*')
      .eq('id', id)
      .eq('establishment_id', ctx.establishmentId)
      .single()

    if (!row) return { error: 'Document introuvable' }

    const attachment = row as JudicialAttachment

    await admin.storage.from(BUCKET).remove([attachment.storage_path])

    const { error: deleteError } = await admin
      .from('judicial_attachments')
      .delete()
      .eq('id', id)

    if (deleteError) return { error: deleteError.message }

    void logActivity({
      action: 'delete',
      entityType: 'judicial_attachment',
      entityId: id,
      entityName: attachment.file_name ?? undefined,
      parentType: 'animal',
      parentId: attachment.animal_id,
      details: { kind: attachment.kind, file_name: attachment.file_name },
    })

    revalidatePath(`/animals/${attachment.animal_id}`)
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
