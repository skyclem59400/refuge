'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireEstablishment, requirePermission } from '@/lib/establishment/permissions'
import { logActivity } from '@/lib/actions/activity-log'
import { createNotification } from '@/lib/actions/notifications'
import type { MemberDocument, MemberDocumentKind } from '@/lib/types/database'

/**
 * CRUD documents RH par collaborateur (contrats, avenants, attestations).
 * Pattern calqué sur payslips.ts, mais générique : un membre peut avoir
 * plusieurs documents de chaque type (ex: 1 CDI initial + 2 avenants).
 */

const BUCKET = 'employment-docs'

/** Liste les documents d'un membre (ou de tous les membres pour les RH) */
export async function getMemberDocuments(filters?: {
  memberId?: string
  kind?: MemberDocumentKind
}): Promise<{ data?: MemberDocument[]; error?: string }> {
  try {
    const { establishmentId, membership } = await requirePermission('view_own_leaves')
    const admin = createAdminClient()

    let canManageAll = false
    try {
      await requirePermission('manage_payslips')
      canManageAll = true
    } catch {
      // membre lambda : ne voit que ses propres docs
    }

    let q = admin
      .from('member_documents')
      .select('*')
      .eq('establishment_id', establishmentId)

    if (!canManageAll) {
      q = q.eq('member_id', membership.id)
    } else if (filters?.memberId) {
      q = q.eq('member_id', filters.memberId)
    }

    if (filters?.kind) {
      q = q.eq('kind', filters.kind)
    }

    const { data, error } = await q
      .order('signed_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (error) return { error: error.message }
    return { data: (data || []) as MemberDocument[] }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/** Upload un document pour un collaborateur (admin RH uniquement) */
export async function uploadMemberDocument(formData: FormData): Promise<{
  data?: MemberDocument
  error?: string
}> {
  try {
    const { establishmentId, userId } = await requirePermission('manage_payslips')
    const admin = createAdminClient()

    const file = formData.get('file') as File | null
    const memberId = formData.get('member_id') as string | null
    const kind = formData.get('kind') as MemberDocumentKind | null
    const label = (formData.get('label') as string) || null
    const signedDateRaw = (formData.get('signed_date') as string) || null

    if (!file || !(file instanceof File)) return { error: 'Aucun fichier fourni' }
    if (!memberId) return { error: 'Membre non spécifié' }
    if (!kind) return { error: 'Type de document non spécifié' }
    if (!['contract', 'amendment', 'certificate', 'other'].includes(kind)) {
      return { error: 'Type de document invalide' }
    }
    if (!label || label.trim().length === 0) {
      return { error: 'Libellé obligatoire (ex: "CDI initial", "Avenant n°2")' }
    }

    // Path unique : establishment / member / kind / timestamp-filename.ext
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filePath = `${establishmentId}/${memberId}/${kind}/${Date.now()}-${safeName}`

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(filePath, file, { upsert: false, contentType: file.type })

    if (uploadError) {
      return { error: "Erreur lors de l'upload : " + uploadError.message }
    }

    // URL signée non générée ici (le bucket est privé) — on stocke un placeholder
    // dans file_url car la colonne est NOT NULL ; le téléchargement passe par
    // getMemberDocumentSignedUrl().
    const { data: { publicUrl } } = admin.storage.from(BUCKET).getPublicUrl(filePath)

    const { data: row, error: insertError } = await admin
      .from('member_documents')
      .insert({
        establishment_id: establishmentId,
        member_id: memberId,
        kind,
        label: label.trim(),
        signed_date: signedDateRaw && signedDateRaw.length === 10 ? signedDateRaw : null,
        file_path: filePath,
        file_url: publicUrl,
        file_size: file.size,
        uploaded_by: userId,
      })
      .select()
      .single()

    if (insertError) {
      await admin.storage.from(BUCKET).remove([filePath])
      return { error: insertError.message }
    }

    // Notification au collaborateur concerné
    const { data: member } = await admin
      .from('establishment_members')
      .select('user_id')
      .eq('id', memberId)
      .single()

    if (member?.user_id) {
      void createNotification({
        userId: member.user_id,
        type: 'member_document_uploaded',
        title: 'Nouveau document RH',
        body: `Un document "${label.trim()}" a été ajouté à votre espace.`,
        link: '/espace-collaborateur/contrats',
      })
    }

    revalidatePath('/espace-collaborateur/contrats')
    revalidatePath('/admin/equipe')

    logActivity({
      action: 'create',
      entityType: 'member_document',
      entityId: row.id,
      entityName: label.trim(),
      details: { member_id: memberId, kind },
    })

    return { data: row as MemberDocument }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/** Supprime un document (admin RH uniquement) */
export async function deleteMemberDocument(id: string): Promise<{
  success?: boolean
  error?: string
}> {
  try {
    const { establishmentId } = await requirePermission('manage_payslips')
    const admin = createAdminClient()

    const { data: doc, error: fetchErr } = await admin
      .from('member_documents')
      .select('*')
      .eq('id', id)
      .eq('establishment_id', establishmentId)
      .single()
    if (fetchErr || !doc) return { error: 'Document introuvable' }

    await admin.storage.from(BUCKET).remove([doc.file_path])

    const { error: delErr } = await admin
      .from('member_documents')
      .delete()
      .eq('id', id)
      .eq('establishment_id', establishmentId)
    if (delErr) return { error: delErr.message }

    revalidatePath('/espace-collaborateur/contrats')
    revalidatePath('/admin/equipe')

    logActivity({
      action: 'delete',
      entityType: 'member_document',
      entityId: id,
      entityName: doc.label,
      details: { member_id: doc.member_id, kind: doc.kind },
    })

    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/** Génère un signed URL (1h) pour télécharger un document */
export async function getMemberDocumentSignedUrl(id: string): Promise<{
  data?: string
  error?: string
}> {
  try {
    const { establishmentId, membership } = await requireEstablishment()
    const admin = createAdminClient()

    const { data: doc, error: fetchErr } = await admin
      .from('member_documents')
      .select('*')
      .eq('id', id)
      .eq('establishment_id', establishmentId)
      .single()
    if (fetchErr || !doc) return { error: 'Document introuvable' }

    // Contrôle d'accès : soit le membre concerné, soit un admin RH
    let canManage = false
    try {
      await requirePermission('manage_payslips')
      canManage = true
    } catch {
      // pas admin
    }
    if (!canManage && doc.member_id !== membership.id) {
      return { error: 'Accès non autorisé' }
    }

    const { data: signed, error: signedErr } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(doc.file_path, 3600)
    if (signedErr || !signed) {
      return { error: 'Erreur lors de la génération du lien de téléchargement' }
    }
    return { data: signed.signedUrl }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
