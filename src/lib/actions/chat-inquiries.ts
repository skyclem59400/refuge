'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { revalidatePath } from 'next/cache'

export type ChatIntent =
  | 'adoption_general'
  | 'adoption_specific'
  | 'famille_accueil'
  | 'benevolat'
  | 'signalement'
  | 'info'

export type ChatStatus = 'active' | 'qualified' | 'abandoned' | 'resolved'

export interface ChatInquiryRow {
  id: string
  intent: ChatIntent
  status: ChatStatus
  source_page: string | null
  animal_id: string | null
  animal_name: string | null
  contact_first_name: string | null
  contact_last_name: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_city: string | null
  contact_postal_code: string | null
  profile_data: Record<string, unknown> | null
  tags: string[] | null
  summary: string | null
  started_at: string
  last_activity_at: string
  qualified_at: string | null
  resolved_at: string | null
  resolved_by: string | null
  resolved_notes: string | null
  message_count: number
  last_message_at: string | null
}

export interface ChatMessageRow {
  id: string
  session_id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  tool_calls: unknown
  tool_name: string | null
  input_tokens: number | null
  output_tokens: number | null
  created_at: string
}

interface ListInquiriesArgs {
  intent?: ChatIntent | null
  status?: ChatStatus | null
  search?: string | null
  limit?: number
}

export async function listInquiries({
  intent,
  status,
  search,
  limit = 100,
}: ListInquiriesArgs = {}): Promise<{ data: ChatInquiryRow[]; error?: string }> {
  const ctx = await getEstablishmentContext()
  if (!ctx) return { data: [], error: 'Non authentifié' }
  if (!ctx.permissions.isOwner) {
    return { data: [], error: 'Accès super admin uniquement' }
  }

  const admin = createAdminClient()

  let q = admin
    .from('chat_inquiries_view')
    .select('*')
    .order('last_activity_at', { ascending: false })
    .limit(limit)

  if (intent) q = q.eq('intent', intent)
  if (status) q = q.eq('status', status)
  if (search?.trim()) {
    const s = `%${search.trim()}%`
    q = q.or(`contact_email.ilike.${s},contact_first_name.ilike.${s},contact_last_name.ilike.${s},summary.ilike.${s}`)
  }

  const result = (await q) as { data: ChatInquiryRow[] | null; error: { message: string } | null }
  if (result.error) return { data: [], error: result.error.message }
  return { data: result.data || [] }
}

export async function getInquiry(id: string): Promise<{
  inquiry: ChatInquiryRow | null
  messages: ChatMessageRow[]
  error?: string
}> {
  const ctx = await getEstablishmentContext()
  if (!ctx) return { inquiry: null, messages: [], error: 'Non authentifié' }
  if (!ctx.permissions.isOwner) {
    return { inquiry: null, messages: [], error: 'Accès super admin uniquement' }
  }

  const admin = createAdminClient()

  const [inquiryRes, messagesRes] = await Promise.all([
    admin.from('chat_inquiries_view').select('*').eq('id', id).single(),
    admin
      .from('chat_messages')
      .select('*')
      .eq('session_id', id)
      .order('created_at', { ascending: true }),
  ])

  const inquiryResult = inquiryRes as { data: ChatInquiryRow | null; error: { message: string } | null }
  const messagesResult = messagesRes as { data: ChatMessageRow[] | null; error: { message: string } | null }

  if (inquiryResult.error) {
    return { inquiry: null, messages: [], error: inquiryResult.error.message }
  }

  return {
    inquiry: inquiryResult.data,
    messages: messagesResult.data || [],
  }
}

export async function markInquiryResolved(
  id: string,
  notes: string | null,
  resolvedBy: string
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getEstablishmentContext()
  if (!ctx?.permissions.isOwner) {
    return { ok: false, error: 'Accès super admin uniquement' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('chat_sessions' as never)
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      resolved_by: resolvedBy,
      resolved_notes: notes,
    } as never)
    .eq('id', id)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/contacts-entrants')
  revalidatePath(`/contacts-entrants/${id}`)
  return { ok: true }
}

export async function getInquiryStats(): Promise<{
  total: number
  qualified: number
  pending: number
  resolved: number
  byIntent: Record<ChatIntent, number>
}> {
  const admin = createAdminClient()

  const result = (await admin
    .from('chat_sessions')
    .select('status, intent')) as {
    data: { status: ChatStatus; intent: ChatIntent }[] | null
    error: unknown
  }

  const data = result.data || []
  const byIntent = {
    adoption_general: 0,
    adoption_specific: 0,
    famille_accueil: 0,
    benevolat: 0,
    signalement: 0,
    info: 0,
  } as Record<ChatIntent, number>

  let qualified = 0
  let pending = 0
  let resolved = 0
  for (const row of data) {
    byIntent[row.intent] = (byIntent[row.intent] || 0) + 1
    if (row.status === 'qualified') qualified++
    else if (row.status === 'active') pending++
    else if (row.status === 'resolved') resolved++
  }

  return {
    total: data.length,
    qualified,
    pending,
    resolved,
    byIntent,
  }
}
