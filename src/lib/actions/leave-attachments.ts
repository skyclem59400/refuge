'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/establishment/permissions'
import { logActivity } from '@/lib/actions/activity-log'
import type { LeaveAttachment, LeaveAttachmentKind } from '@/lib/types/database'

const BUCKET = 'leave-attachments'

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120)
}

/**
 * Upload a sick note / supporting document.
 * Path layout: <establishment_id>/<member_id>/<timestamp>_<filename>
 */
export async function uploadLeaveAttachment(formData: FormData): Promise<
  { data?: LeaveAttachment; error?: string }
> {
  try {
    const { establishmentId, membership } = await requirePermission('manage_leaves')
    const admin = createAdminClient()

    const file = formData.get('file') as File | null
    const memberId = formData.get('member_id') as string | null
    const leaveRequestId = (formData.get('leave_request_id') as string | null) || null
    const kind = ((formData.get('kind') as string | null) || 'sick_note') as LeaveAttachmentKind
    const notes = (formData.get('notes') as string | null) || null

    if (!file) return { error: 'Aucun fichier' }
    if (!memberId) return { error: 'Membre obligatoire' }
    if (file.size > 10 * 1024 * 1024) return { error: 'Fichier trop volumineux (10 Mo max)' }

    const cleanName = safeFileName(file.name)
    const storagePath = `${establishmentId}/${memberId}/${Date.now()}_${cleanName}`
    const arrayBuffer = await file.arrayBuffer()

    const { error: uploadErr } = await admin.storage
      .from(BUCKET)
      .upload(storagePath, arrayBuffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })

    if (uploadErr) return { error: `Upload echoue : ${uploadErr.message}` }

    const { data: row, error: insertErr } = await admin
      .from('leave_attachments')
      .insert({
        establishment_id: establishmentId,
        member_id: memberId,
        leave_request_id: leaveRequestId,
        kind,
        storage_path: storagePath,
        file_name: cleanName,
        mime_type: file.type || null,
        size_bytes: file.size,
        notes,
        uploaded_by: membership.id,
      })
      .select()
      .single()

    if (insertErr) {
      await admin.storage.from(BUCKET).remove([storagePath])
      return { error: insertErr.message }
    }

    revalidatePath('/admin/conges')
    revalidatePath('/espace-collaborateur/conges')

    logActivity({
      action: 'create',
      entityType: 'leave_attachment',
      entityId: row.id,
      details: { kind, file_name: cleanName },
    })

    return { data: row as LeaveAttachment }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function listLeaveAttachments(filters: {
  member_id?: string
  leave_request_id?: string
}): Promise<{ data?: LeaveAttachment[]; error?: string }> {
  try {
    const { establishmentId } = await requirePermission('view_own_leaves')
    const admin = createAdminClient()

    let q = admin
      .from('leave_attachments')
      .select('*')
      .eq('establishment_id', establishmentId)
      .order('created_at', { ascending: false })

    if (filters.member_id) q = q.eq('member_id', filters.member_id)
    if (filters.leave_request_id) q = q.eq('leave_request_id', filters.leave_request_id)

    const { data, error } = await q
    if (error) return { error: error.message }

    const enriched: LeaveAttachment[] = []
    for (const row of data || []) {
      const { data: signed } = await admin.storage
        .from(BUCKET)
        .createSignedUrl(row.storage_path, 60 * 30)
      enriched.push({ ...(row as LeaveAttachment), signed_url: signed?.signedUrl })
    }

    return { data: enriched }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function deleteLeaveAttachment(id: string): Promise<
  { success?: true; error?: string }
> {
  try {
    const { establishmentId } = await requirePermission('manage_leaves')
    const admin = createAdminClient()

    const { data: row, error: fetchErr } = await admin
      .from('leave_attachments')
      .select('*')
      .eq('id', id)
      .eq('establishment_id', establishmentId)
      .single()

    if (fetchErr || !row) return { error: 'Piece jointe introuvable' }

    await admin.storage.from(BUCKET).remove([row.storage_path])

    const { error: delErr } = await admin
      .from('leave_attachments')
      .delete()
      .eq('id', id)
      .eq('establishment_id', establishmentId)

    if (delErr) return { error: delErr.message }

    revalidatePath('/admin/conges')
    revalidatePath('/espace-collaborateur/conges')

    logActivity({
      action: 'delete',
      entityType: 'leave_attachment',
      entityId: id,
    })

    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
