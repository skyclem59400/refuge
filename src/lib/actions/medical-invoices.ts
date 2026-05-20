'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/establishment/permissions'
import { logActivity } from '@/lib/actions/activity-log'

const BUCKET = 'medical-invoices'
const MAX_SIZE_BYTES = 20 * 1024 * 1024 // 20 MB
const SIGNED_URL_TTL_SECONDS = 60 * 60 // 60 minutes

const ALLOWED_MIMES: readonly string[] = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/heic',
  'image/tiff',
]

interface HealthRecordInvoiceRow {
  id: string
  animal_id: string
  invoice_storage_path: string | null
  invoice_file_name: string | null
  invoice_mime_type: string | null
  invoice_size_bytes: number | null
  invoice_uploaded_at: string | null
  animal: { id: string; establishment_id: string } | null
}

interface UploadedInvoice {
  health_record_id: string
  animal_id: string
  storage_path: string
  file_name: string
  mime_type: string | null
  size_bytes: number
  uploaded_at: string
  signed_url?: string
}

function safeFilename(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, '_')
  return cleaned.length > 120 ? cleaned.slice(0, 120) : cleaned
}

// ---------------------------------------------------------------------------
// uploadMedicalInvoice — multipart upload via FormData
// ---------------------------------------------------------------------------

export async function uploadMedicalInvoice(
  formData: FormData
): Promise<{ data?: UploadedInvoice; error?: string }> {
  try {
    const ctx = await requirePermission('manage_health')
    const admin = createAdminClient()

    const file = formData.get('file')
    const healthRecordId = formData.get('health_record_id')

    if (!(file instanceof File)) {
      return { error: 'Aucun fichier fourni' }
    }
    if (typeof healthRecordId !== 'string' || !healthRecordId) {
      return { error: 'health_record_id manquant' }
    }
    if (file.size === 0) {
      return { error: 'Fichier vide' }
    }
    if (file.size > MAX_SIZE_BYTES) {
      return { error: `Fichier trop volumineux (max ${MAX_SIZE_BYTES / (1024 * 1024)} Mo)` }
    }

    const mime = file.type || 'application/octet-stream'
    if (!ALLOWED_MIMES.includes(mime)) {
      return { error: `Type de fichier non autorise (${mime})` }
    }

    // Verify the health record belongs to current establishment via its animal
    const { data: record, error: fetchError } = await admin
      .from('animal_health_records')
      .select(
        `id, animal_id, invoice_storage_path, invoice_file_name, invoice_mime_type,
         invoice_size_bytes, invoice_uploaded_at,
         animal:animals!animal_id(id, establishment_id)`
      )
      .eq('id', healthRecordId)
      .single<HealthRecordInvoiceRow>()

    if (fetchError || !record) {
      return { error: 'Acte medical introuvable' }
    }
    if (!record.animal || record.animal.establishment_id !== ctx.establishmentId) {
      return { error: 'Acte medical introuvable' }
    }

    const fileName = safeFilename(file.name || 'facture')
    const path = `${ctx.establishmentId}/${record.animal_id}/${Date.now()}_${fileName}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: mime,
        upsert: false,
      })

    if (uploadError) {
      return { error: 'Upload echoue : ' + uploadError.message }
    }

    // If a previous invoice exists, clean it up
    const previousPath = record.invoice_storage_path
    if (previousPath && previousPath !== path) {
      await admin.storage.from(BUCKET).remove([previousPath])
    }

    const uploadedAt = new Date().toISOString()

    const { error: updateError } = await admin
      .from('animal_health_records')
      .update({
        invoice_storage_path: path,
        invoice_file_name: file.name,
        invoice_mime_type: mime,
        invoice_size_bytes: file.size,
        invoice_uploaded_at: uploadedAt,
      })
      .eq('id', healthRecordId)

    if (updateError) {
      // Cleanup the just-uploaded file on DB failure
      await admin.storage.from(BUCKET).remove([path])
      return { error: updateError.message }
    }

    void logActivity({
      action: 'create',
      entityType: 'medical_invoice',
      entityId: healthRecordId,
      entityName: file.name,
      parentType: 'animal',
      parentId: record.animal_id,
      details: { file_name: file.name, size_bytes: file.size, mime_type: mime },
    })

    revalidatePath(`/animals/${record.animal_id}`)

    const { data: signed } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)

    return {
      data: {
        health_record_id: healthRecordId,
        animal_id: record.animal_id,
        storage_path: path,
        file_name: file.name,
        mime_type: mime,
        size_bytes: file.size,
        uploaded_at: uploadedAt,
        signed_url: signed?.signedUrl,
      },
    }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ---------------------------------------------------------------------------
// deleteMedicalInvoice — remove the file and clear invoice_* columns
// ---------------------------------------------------------------------------

export async function deleteMedicalInvoice(
  healthRecordId: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const ctx = await requirePermission('manage_health')
    const admin = createAdminClient()

    const { data: record, error: fetchError } = await admin
      .from('animal_health_records')
      .select(
        `id, animal_id, invoice_storage_path, invoice_file_name, invoice_mime_type,
         invoice_size_bytes, invoice_uploaded_at,
         animal:animals!animal_id(id, establishment_id)`
      )
      .eq('id', healthRecordId)
      .single<HealthRecordInvoiceRow>()

    if (fetchError || !record) {
      return { error: 'Acte medical introuvable' }
    }
    if (!record.animal || record.animal.establishment_id !== ctx.establishmentId) {
      return { error: 'Acte medical introuvable' }
    }
    if (!record.invoice_storage_path) {
      return { error: 'Aucune facture associee a cet acte' }
    }

    const previousPath = record.invoice_storage_path
    const previousName = record.invoice_file_name

    await admin.storage.from(BUCKET).remove([previousPath])

    const { error: updateError } = await admin
      .from('animal_health_records')
      .update({
        invoice_storage_path: null,
        invoice_file_name: null,
        invoice_mime_type: null,
        invoice_size_bytes: null,
        invoice_uploaded_at: null,
      })
      .eq('id', healthRecordId)

    if (updateError) return { error: updateError.message }

    void logActivity({
      action: 'delete',
      entityType: 'medical_invoice',
      entityId: healthRecordId,
      entityName: previousName ?? undefined,
      parentType: 'animal',
      parentId: record.animal_id,
      details: { storage_path: previousPath, file_name: previousName },
    })

    revalidatePath(`/animals/${record.animal_id}`)
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ---------------------------------------------------------------------------
// getMedicalInvoiceSignedUrl — generate a fresh 1h signed URL
// ---------------------------------------------------------------------------

export async function getMedicalInvoiceSignedUrl(
  healthRecordId: string
): Promise<{ data?: { url: string; file_name: string | null; mime_type: string | null }; error?: string }> {
  try {
    const ctx = await requirePermission('manage_health')
    const admin = createAdminClient()

    const { data: record, error: fetchError } = await admin
      .from('animal_health_records')
      .select(
        `id, animal_id, invoice_storage_path, invoice_file_name, invoice_mime_type,
         invoice_size_bytes, invoice_uploaded_at,
         animal:animals!animal_id(id, establishment_id)`
      )
      .eq('id', healthRecordId)
      .single<HealthRecordInvoiceRow>()

    if (fetchError || !record) {
      return { error: 'Acte medical introuvable' }
    }
    if (!record.animal || record.animal.establishment_id !== ctx.establishmentId) {
      return { error: 'Acte medical introuvable' }
    }
    if (!record.invoice_storage_path) {
      return { error: 'Aucune facture associee a cet acte' }
    }

    const { data: signed, error: signError } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(record.invoice_storage_path, SIGNED_URL_TTL_SECONDS)

    if (signError || !signed?.signedUrl) {
      return { error: signError?.message || 'Impossible de generer l URL signee' }
    }

    return {
      data: {
        url: signed.signedUrl,
        file_name: record.invoice_file_name,
        mime_type: record.invoice_mime_type,
      },
    }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
