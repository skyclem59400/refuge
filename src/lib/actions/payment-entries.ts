'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireEstablishment, requirePermission } from '@/lib/establishment/permissions'
import { logActivity } from '@/lib/actions/activity-log'
import type {
  PaymentEntry,
  PaymentEntryWithRelations,
  PaymentEntryMethod,
  PaymentEntryType,
  PaymentEntryInstallment,
} from '@/lib/types/database'

interface ListFilters {
  year?: number
  type?: PaymentEntryType
  method?: PaymentEntryMethod
  limit?: number
}

export async function getPaymentEntries(filters?: ListFilters) {
  try {
    const { establishmentId } = await requireEstablishment()
    const admin = createAdminClient()

    let query = admin
      .from('payment_entries')
      .select(`
        *,
        related_animal:animals!related_animal_id(id, name),
        related_client:clients!related_client_id(id, name),
        related_document:documents!related_document_id(id, numero, type),
        related_donation:donations!related_donation_id(id, donor_name)
      `)
      .eq('establishment_id', establishmentId)

    if (filters?.year) {
      query = query
        .gte('payment_date', `${filters.year}-01-01`)
        .lte('payment_date', `${filters.year}-12-31`)
    }
    if (filters?.type) query = query.eq('payment_type', filters.type)
    if (filters?.method) query = query.eq('method', filters.method)
    if (filters?.limit) query = query.limit(filters.limit)

    const { data, error } = await query.order('payment_date', { ascending: false })

    if (error) return { error: error.message }
    return { data: (data as unknown as PaymentEntryWithRelations[]) || [] }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function getPaymentEntry(id: string) {
  try {
    const { establishmentId } = await requireEstablishment()
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('payment_entries')
      .select(`
        *,
        related_animal:animals!related_animal_id(id, name),
        related_client:clients!related_client_id(id, name),
        related_document:documents!related_document_id(id, numero, type),
        related_donation:donations!related_donation_id(id, donor_name)
      `)
      .eq('id', id)
      .eq('establishment_id', establishmentId)
      .single()

    if (error) return { error: error.message }
    return { data: data as unknown as PaymentEntryWithRelations }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

interface PaymentInput {
  amount: number
  payment_date: string
  method: PaymentEntryMethod
  payment_type: PaymentEntryType
  installment: PaymentEntryInstallment
  payer_name?: string | null
  payer_phone?: string | null
  payer_email?: string | null
  reference?: string | null
  related_document_id?: string | null
  related_donation_id?: string | null
  related_animal_id?: string | null
  related_client_id?: string | null
  notes?: string | null
}

export async function createPaymentEntry(input: PaymentInput) {
  try {
    const ctx = await requirePermission('manage_documents')
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('payment_entries')
      .insert({
        establishment_id: ctx.establishmentId,
        amount: input.amount,
        payment_date: input.payment_date,
        method: input.method,
        payment_type: input.payment_type,
        installment: input.installment,
        payer_name: input.payer_name?.trim() || null,
        payer_phone: input.payer_phone?.trim() || null,
        payer_email: input.payer_email?.trim() || null,
        reference: input.reference?.trim() || null,
        related_document_id: input.related_document_id || null,
        related_donation_id: input.related_donation_id || null,
        related_animal_id: input.related_animal_id || null,
        related_client_id: input.related_client_id || null,
        notes: input.notes?.trim() || null,
        created_by: ctx.userId,
      })
      .select()
      .single()

    if (error) return { error: error.message }

    revalidatePath('/reglements')
    revalidatePath('/dashboard')
    logActivity({
      action: 'create',
      entityType: 'payment_entry',
      entityId: (data as PaymentEntry).id,
      entityName: `${input.amount}€ - ${input.payment_type}`,
    })
    return { data: data as PaymentEntry }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function updatePaymentEntry(id: string, input: Partial<PaymentInput>) {
  try {
    const { establishmentId } = await requirePermission('manage_documents')
    const supabase = await createClient()

    const update: Record<string, unknown> = {}
    if (input.amount !== undefined) update.amount = input.amount
    if (input.payment_date !== undefined) update.payment_date = input.payment_date
    if (input.method !== undefined) update.method = input.method
    if (input.payment_type !== undefined) update.payment_type = input.payment_type
    if (input.installment !== undefined) update.installment = input.installment
    if (input.payer_name !== undefined) update.payer_name = input.payer_name?.trim() || null
    if (input.payer_phone !== undefined) update.payer_phone = input.payer_phone?.trim() || null
    if (input.payer_email !== undefined) update.payer_email = input.payer_email?.trim() || null
    if (input.reference !== undefined) update.reference = input.reference?.trim() || null
    if (input.related_document_id !== undefined) update.related_document_id = input.related_document_id
    if (input.related_donation_id !== undefined) update.related_donation_id = input.related_donation_id
    if (input.related_animal_id !== undefined) update.related_animal_id = input.related_animal_id
    if (input.related_client_id !== undefined) update.related_client_id = input.related_client_id
    if (input.notes !== undefined) update.notes = input.notes?.trim() || null

    const { error } = await supabase
      .from('payment_entries')
      .update(update)
      .eq('id', id)
      .eq('establishment_id', establishmentId)

    if (error) return { error: error.message }

    revalidatePath('/reglements')
    revalidatePath(`/reglements/${id}`)
    logActivity({ action: 'update', entityType: 'payment_entry', entityId: id })
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function deletePaymentEntry(id: string) {
  try {
    const { establishmentId } = await requirePermission('manage_documents')
    const supabase = await createClient()

    const { error } = await supabase
      .from('payment_entries')
      .delete()
      .eq('id', id)
      .eq('establishment_id', establishmentId)

    if (error) return { error: error.message }

    revalidatePath('/reglements')
    logActivity({ action: 'delete', entityType: 'payment_entry', entityId: id })
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function getPaymentStats(year?: number) {
  try {
    const { establishmentId } = await requireEstablishment()
    const admin = createAdminClient()

    const yearToUse = year || new Date().getFullYear()
    const { data, error } = await admin
      .from('payment_entries')
      .select('amount, method, payment_type')
      .eq('establishment_id', establishmentId)
      .gte('payment_date', `${yearToUse}-01-01`)
      .lte('payment_date', `${yearToUse}-12-31`)

    if (error) return { error: error.message }

    const rows = (data as { amount: number; method: string; payment_type: string }[]) || []
    const total = rows.reduce((s, r) => s + Number(r.amount), 0)
    const byMethod: Record<string, number> = {}
    const byType: Record<string, number> = {}
    for (const r of rows) {
      byMethod[r.method] = (byMethod[r.method] || 0) + Number(r.amount)
      byType[r.payment_type] = (byType[r.payment_type] || 0) + Number(r.amount)
    }
    return { data: { total, byMethod, byType, count: rows.length } }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
