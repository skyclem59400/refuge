'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireEstablishment, requirePermission } from '@/lib/establishment/permissions'
import { logActivity } from '@/lib/actions/activity-log'
import { createNotification } from '@/lib/actions/notifications'
import type { Payslip } from '@/lib/types/database'

// ============================================
// Read actions
// ============================================

export async function getPayslips(filters?: { memberId?: string; year?: number }) {
  try {
    const { establishmentId, membership } = await requirePermission('view_own_leaves')
    const supabase = createAdminClient()

    // Check if user can see all payslips or only their own
    let canManageAll = false
    try {
      await requirePermission('manage_payslips')
      canManageAll = true
    } catch {
      // User can only see their own payslips
    }

    let query = supabase
      .from('payslips')
      .select('*')
      .eq('establishment_id', establishmentId)

    if (!canManageAll) {
      query = query.eq('member_id', membership.id)
    }

    if (filters?.memberId) {
      query = query.eq('member_id', filters.memberId)
    }

    if (filters?.year) {
      query = query.eq('year', filters.year)
    }

    const { data, error } = await query
      .order('year', { ascending: false })
      .order('month', { ascending: false })

    if (error) {
      return { error: error.message }
    }

    return { data: data as Payslip[] }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ============================================
// Write actions
// ============================================

export async function uploadPayslip(formData: FormData) {
  try {
    const { establishmentId, userId } = await requirePermission('manage_payslips')
    const adminClient = createAdminClient()

    // Extract fields from FormData
    const file = formData.get('file') as File | null
    const memberId = formData.get('member_id') as string | null
    const year = Number(formData.get('year'))
    const month = Number(formData.get('month'))
    const label = (formData.get('label') as string) || null

    if (!file || !(file instanceof File)) {
      return { error: 'Aucun fichier fourni' }
    }

    if (!memberId) {
      return { error: 'Membre non specifie' }
    }

    if (!year || !month || month < 1 || month > 12) {
      return { error: 'Annee ou mois invalide' }
    }

    // Upload file to Supabase Storage
    const filePath = `${establishmentId}/${memberId}/${year}-${String(month).padStart(2, '0')}.pdf`

    const { error: uploadError } = await adminClient.storage
      .from('payslips')
      .upload(filePath, file, { upsert: true })

    if (uploadError) {
      return { error: 'Erreur lors de l\'upload : ' + uploadError.message }
    }

    // Get public URL
    const { data: { publicUrl } } = adminClient.storage
      .from('payslips')
      .getPublicUrl(filePath)

    // Insert payslip record
    const { data: payslip, error: insertError } = await adminClient
      .from('payslips')
      .insert({
        establishment_id: establishmentId,
        member_id: memberId,
        year,
        month,
        label,
        file_path: filePath,
        file_url: publicUrl,
        file_size: file.size,
        uploaded_by: userId,
      })
      .select()
      .single()

    if (insertError) {
      // Clean up uploaded file on DB insert failure
      await adminClient.storage.from('payslips').remove([filePath])
      return { error: insertError.message }
    }

    // Notify the employee (resolve user_id from member_id)
    const { data: member } = await adminClient
      .from('establishment_members')
      .select('user_id')
      .eq('id', memberId)
      .single()

    if (member) {
      createNotification({
        userId: member.user_id,
        type: 'payslip_uploaded',
        title: 'Nouveau bulletin de paie',
        body: `Votre bulletin de paie de ${String(month).padStart(2, '0')}/${year} est disponible.`,
        link: '/espace-collaborateur/bulletins',
      })
    }

    revalidatePath('/espace-collaborateur/bulletins')
    revalidatePath('/admin/bulletins')

    logActivity({
      action: 'create',
      entityType: 'payslip',
      entityId: payslip.id,
      entityName: `Bulletin ${String(month).padStart(2, '0')}/${year}`,
      details: { member_id: memberId, year, month },
    })

    return { data: payslip as Payslip }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function deletePayslip(id: string) {
  try {
    const { establishmentId } = await requirePermission('manage_payslips')
    const adminClient = createAdminClient()

    // Fetch payslip to get file_path
    const { data: payslip, error: fetchError } = await adminClient
      .from('payslips')
      .select('*')
      .eq('id', id)
      .eq('establishment_id', establishmentId)
      .single()

    if (fetchError || !payslip) {
      return { error: 'Bulletin introuvable' }
    }

    // Delete file from Storage
    await adminClient.storage.from('payslips').remove([payslip.file_path])

    // Delete record from DB
    const { error: deleteError } = await adminClient
      .from('payslips')
      .delete()
      .eq('id', id)
      .eq('establishment_id', establishmentId)

    if (deleteError) {
      return { error: deleteError.message }
    }

    revalidatePath('/espace-collaborateur/bulletins')
    revalidatePath('/admin/bulletins')

    logActivity({
      action: 'delete',
      entityType: 'payslip',
      entityId: id,
      entityName: `Bulletin ${String(payslip.month).padStart(2, '0')}/${payslip.year}`,
      details: { member_id: payslip.member_id, year: payslip.year, month: payslip.month },
    })

    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ============================================
// Signed URL for download
// ============================================

export async function getPayslipSignedUrl(id: string) {
  try {
    const { establishmentId, membership } = await requireEstablishment()
    const adminClient = createAdminClient()

    // Fetch the payslip
    const { data: payslip, error: fetchError } = await adminClient
      .from('payslips')
      .select('*')
      .eq('id', id)
      .eq('establishment_id', establishmentId)
      .single()

    if (fetchError || !payslip) {
      return { error: 'Bulletin introuvable' }
    }

    // Verify access: either own payslip or has manage_payslips permission
    let canManage = false
    try {
      await requirePermission('manage_payslips')
      canManage = true
    } catch {
      // Not an admin
    }

    if (!canManage && payslip.member_id !== membership.id) {
      return { error: 'Acces non autorise' }
    }

    // Generate signed URL (1 hour expiry)
    const { data: signedUrlData, error: signedError } = await adminClient.storage
      .from('payslips')
      .createSignedUrl(payslip.file_path, 3600)

    if (signedError || !signedUrlData) {
      return { error: 'Erreur lors de la generation du lien de telechargement' }
    }

    return { data: signedUrlData.signedUrl }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
