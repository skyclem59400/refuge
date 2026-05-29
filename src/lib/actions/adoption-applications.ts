'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { getEstablishmentContext } from '@/lib/establishment/context'
import type {
  AdoptionInquiry,
  AdoptionInquiryStatus,
} from '@/lib/types/database'

interface ListFilters {
  status?: AdoptionInquiryStatus | null
  search?: string | null
  /** true = uniquement avec user_id, false = uniquement sans user_id, null = tous */
  hasAccount?: boolean | null
  limit?: number
}

export async function listAdoptionApplications(
  filters: ListFilters = {}
): Promise<{ data: AdoptionInquiry[]; error: string | null }> {
  const ctx = await getEstablishmentContext()
  if (!ctx) return { data: [], error: 'Non authentifié' }
  if (!ctx.permissions.canManageAdoptionApplications) {
    return { data: [], error: 'Accès interdit' }
  }

  const admin = createAdminClient()
  let query = admin
    .from('adoption_inquiries')
    .select('*')
    .eq('establishment_id', ctx.establishment.id)
    .eq('inquiry_type', 'pre_qualification')
    .order('created_at', { ascending: false })
    .limit(filters.limit ?? 100)

  if (filters.status) {
    query = query.eq('status', filters.status)
  }
  if (filters.hasAccount === true) {
    query = query.not('user_id', 'is', null)
  } else if (filters.hasAccount === false) {
    query = query.is('user_id', null)
  }
  if (filters.search?.trim()) {
    const s = `%${filters.search.trim()}%`
    query = query.or(
      `first_name.ilike.${s},last_name.ilike.${s},email.ilike.${s},city.ilike.${s},ticket_number.ilike.${s}`
    )
  }

  const result = (await query) as {
    data: AdoptionInquiry[] | null
    error: { message: string } | null
  }
  if (result.error) return { data: [], error: result.error.message }
  return { data: result.data ?? [], error: null }
}

export async function getAdoptionApplication(
  id: string
): Promise<{ data: AdoptionInquiry | null; error: string | null }> {
  const ctx = await getEstablishmentContext()
  if (!ctx) return { data: null, error: 'Non authentifié' }
  if (!ctx.permissions.canManageAdoptionApplications) {
    return { data: null, error: 'Accès interdit' }
  }

  const admin = createAdminClient()
  const result = (await admin
    .from('adoption_inquiries')
    .select('*')
    .eq('id', id)
    .eq('establishment_id', ctx.establishment.id)
    .eq('inquiry_type', 'pre_qualification')
    .single()) as {
    data: AdoptionInquiry | null
    error: { message: string } | null
  }

  if (result.error) return { data: null, error: result.error.message }
  return { data: result.data, error: null }
}

export interface AdoptionApplicationStats {
  total: number
  pending: number
  qualified: number
  interview_scheduled: number
  accepted: number
  declined: number
  archived: number
}

export async function getAdoptionApplicationStats(): Promise<AdoptionApplicationStats> {
  const empty: AdoptionApplicationStats = {
    total: 0,
    pending: 0,
    qualified: 0,
    interview_scheduled: 0,
    accepted: 0,
    declined: 0,
    archived: 0,
  }

  const ctx = await getEstablishmentContext()
  if (!ctx) return empty
  if (!ctx.permissions.canManageAdoptionApplications) return empty

  const admin = createAdminClient()
  const result = (await admin
    .from('adoption_inquiries')
    .select('status')
    .eq('establishment_id', ctx.establishment.id)
    .eq('inquiry_type', 'pre_qualification')) as {
    data: { status: AdoptionInquiryStatus }[] | null
    error: unknown
  }

  const rows = result.data ?? []
  const stats: AdoptionApplicationStats = { ...empty, total: rows.length }
  for (const row of rows) {
    if (row.status in stats) {
      stats[row.status] = (stats[row.status] ?? 0) + 1
    }
  }
  return stats
}

export async function updateAdoptionApplicationStatus(
  id: string,
  status: AdoptionInquiryStatus,
  notes?: string | null
): Promise<{ error: string | null }> {
  const ctx = await getEstablishmentContext()
  if (!ctx) return { error: 'Non authentifié' }
  if (!ctx.permissions.canManageAdoptionApplications) {
    return { error: 'Accès interdit' }
  }

  const admin = createAdminClient()
  const payload: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }
  if (notes !== undefined) {
    payload.team_notes = notes?.trim() ? notes.trim() : null
  }

  const { error } = (await admin
    .from('adoption_inquiries')
    .update(payload as never)
    .eq('id', id)
    .eq('establishment_id', ctx.establishment.id)) as {
    error: { message: string } | null
  }

  if (error) return { error: error.message }

  revalidatePath('/admin/candidatures-adoption')
  revalidatePath(`/admin/candidatures-adoption/${id}`)
  return { error: null }
}
