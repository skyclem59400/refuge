'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/establishment/permissions'
import { logActivity } from '@/lib/actions/activity-log'

export async function listConventionsForAdmin() {
  const { establishmentId } = await requirePermission('manage_establishment')
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('convention_contracts')
    .select('*')
    .eq('establishment_id', establishmentId)
    .order('newly_added', { ascending: false })
    .order('status', { ascending: true })
    .order('contract_number', { ascending: true })

  if (error) return { error: error.message }
  return { data: data || [] }
}

export async function getConventionById(id: string) {
  const { establishmentId } = await requirePermission('manage_establishment')
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('convention_contracts')
    .select('*')
    .eq('id', id)
    .eq('establishment_id', establishmentId)
    .single()

  if (error) return { error: error.message }
  return { data }
}

export async function markConventionAsSigned(input: {
  id: string
  signedDate: string
  method: 'paper' | 'electronic'
}) {
  const { establishmentId, userId } = await requirePermission('manage_establishment')
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('convention_contracts')
    .select('id, contract_number, duration_years, scope_name')
    .eq('id', input.id)
    .eq('establishment_id', establishmentId)
    .single()

  if (!existing) return { error: 'Convention introuvable' }

  const startDate = new Date(input.signedDate)
  const endDate = new Date(startDate)
  endDate.setFullYear(endDate.getFullYear() + (existing.duration_years || 3))

  const { error } = await supabase
    .from('convention_contracts')
    .update({
      status: 'signed',
      signed_date: input.signedDate,
      signature_method: input.method,
      signature_status: 'signed',
      start_date: input.signedDate,
      end_date: endDate.toISOString().slice(0, 10),
    })
    .eq('id', input.id)
    .eq('establishment_id', establishmentId)

  if (error) return { error: error.message }

  logActivity({
    action: 'update',
    entityType: 'convention_contract',
    entityId: input.id,
    entityName: existing.contract_number,
    details: { marked_signed: true, signed_date: input.signedDate, method: input.method, scope: existing.scope_name },
  })

  revalidatePath('/admin/conventions')
  revalidatePath(`/admin/conventions/${input.id}`)
  return { data: { ok: true } }
}

export async function markConventionAsSent(id: string) {
  const { establishmentId } = await requirePermission('manage_establishment')
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('convention_contracts')
    .select('id, contract_number, scope_name')
    .eq('id', id)
    .eq('establishment_id', establishmentId)
    .single()

  if (!existing) return { error: 'Convention introuvable' }

  const { error } = await supabase
    .from('convention_contracts')
    .update({
      status: 'sent',
      signature_sent_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('establishment_id', establishmentId)

  if (error) return { error: error.message }

  logActivity({
    action: 'update',
    entityType: 'convention_contract',
    entityId: id,
    entityName: existing.contract_number,
    details: { marked_sent: true, scope: existing.scope_name },
  })

  revalidatePath('/admin/conventions')
  revalidatePath(`/admin/conventions/${id}`)
  return { data: { ok: true } }
}

export async function cancelConvention(id: string, reason: string) {
  const { establishmentId } = await requirePermission('manage_establishment')
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('convention_contracts')
    .select('id, contract_number, scope_name, notes')
    .eq('id', id)
    .eq('establishment_id', establishmentId)
    .single()

  if (!existing) return { error: 'Convention introuvable' }

  const newNotes = existing.notes
    ? `${existing.notes}\n\n[Annulation ${new Date().toISOString().slice(0, 10)}] ${reason}`
    : `[Annulation ${new Date().toISOString().slice(0, 10)}] ${reason}`

  const { error } = await supabase
    .from('convention_contracts')
    .update({
      status: 'cancelled',
      notes: newNotes,
    })
    .eq('id', id)
    .eq('establishment_id', establishmentId)

  if (error) return { error: error.message }

  logActivity({
    action: 'update',
    entityType: 'convention_contract',
    entityId: id,
    entityName: existing.contract_number,
    details: { cancelled: true, reason, scope: existing.scope_name },
  })

  revalidatePath('/admin/conventions')
  revalidatePath(`/admin/conventions/${id}`)
  return { data: { ok: true } }
}

export async function clearNewlyAddedFlag(id: string) {
  const { establishmentId } = await requirePermission('manage_establishment')
  const supabase = await createClient()

  const { error } = await supabase
    .from('convention_contracts')
    .update({ newly_added: false })
    .eq('id', id)
    .eq('establishment_id', establishmentId)

  if (error) return { error: error.message }
  revalidatePath('/admin/conventions')
  return { data: { ok: true } }
}
