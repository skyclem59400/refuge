'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { getEstablishmentContext } from '@/lib/establishment/context'
import type {
  FosterApplication,
  FosterApplicationStatus,
} from '@/lib/types/database'

// Les constantes UI (labels, classes CSS) vivent dans
// `./foster-applications-constants.ts` — un fichier 'use server' ne peut
// exporter que des async functions sous Next.js 16 / Turbopack.

// --- Queries ---

interface ListFilters {
  status?: FosterApplicationStatus | null
  search?: string | null
  /** true = uniquement avec user_id, false = sans, null = tous */
  hasAccount?: boolean | null
  limit?: number
}

export async function listFosterApplications(
  filters: ListFilters = {},
): Promise<{ data: FosterApplication[]; error?: string }> {
  const ctx = await getEstablishmentContext()
  if (!ctx) return { data: [], error: 'Non authentifié' }
  if (!ctx.permissions.canManageFosterApplications) {
    return { data: [], error: 'Accès refusé' }
  }

  const admin = createAdminClient()
  let q = admin
    .from('foster_applications')
    .select('*')
    .eq('establishment_id', ctx.establishment.id)
    .order('created_at', { ascending: false })
    .limit(filters.limit ?? 200)

  if (filters.status) q = q.eq('status', filters.status)
  if (filters.hasAccount === true) {
    q = q.not('user_id', 'is', null)
  } else if (filters.hasAccount === false) {
    q = q.is('user_id', null)
  }

  if (filters.search?.trim()) {
    const s = `%${filters.search.trim()}%`
    q = q.or(
      `first_name.ilike.${s},last_name.ilike.${s},email.ilike.${s},city.ilike.${s},phone.ilike.${s},ticket_number.ilike.${s}`,
    )
  }

  const result = (await q) as {
    data: FosterApplication[] | null
    error: { message: string } | null
  }
  if (result.error) return { data: [], error: result.error.message }
  return { data: result.data || [] }
}

export async function getFosterApplication(
  id: string,
): Promise<{ application: FosterApplication | null; error?: string }> {
  const ctx = await getEstablishmentContext()
  if (!ctx) return { application: null, error: 'Non authentifié' }
  if (!ctx.permissions.canManageFosterApplications) {
    return { application: null, error: 'Accès refusé' }
  }

  const admin = createAdminClient()
  const result = (await admin
    .from('foster_applications')
    .select('*')
    .eq('id', id)
    .eq('establishment_id', ctx.establishment.id)
    .maybeSingle()) as {
    data: FosterApplication | null
    error: { message: string } | null
  }

  if (result.error) return { application: null, error: result.error.message }
  return { application: result.data }
}

export interface FosterStats {
  total: number
  pending: number
  qualified: number
  accepted: number
  byStatus: Record<FosterApplicationStatus, number>
}

export async function getFosterApplicationStats(): Promise<FosterStats> {
  const empty: FosterStats = {
    total: 0,
    pending: 0,
    qualified: 0,
    accepted: 0,
    byStatus: {
      pending: 0,
      qualified: 0,
      interview_scheduled: 0,
      home_visit_scheduled: 0,
      accepted: 0,
      declined: 0,
      archived: 0,
    },
  }

  const ctx = await getEstablishmentContext()
  if (!ctx || !ctx.permissions.canManageFosterApplications) return empty

  const admin = createAdminClient()
  const result = (await admin
    .from('foster_applications')
    .select('status')
    .eq('establishment_id', ctx.establishment.id)) as {
    data: { status: FosterApplicationStatus }[] | null
    error: { message: string } | null
  }

  const rows = result.data || []
  const stats: FosterStats = {
    total: rows.length,
    pending: 0,
    qualified: 0,
    accepted: 0,
    byStatus: {
      pending: 0,
      qualified: 0,
      interview_scheduled: 0,
      home_visit_scheduled: 0,
      accepted: 0,
      declined: 0,
      archived: 0,
    },
  }

  for (const r of rows) {
    stats.byStatus[r.status] = (stats.byStatus[r.status] || 0) + 1
  }
  stats.pending = stats.byStatus.pending
  stats.qualified = stats.byStatus.qualified
  stats.accepted = stats.byStatus.accepted
  return stats
}

// --- Mutations ---

export async function updateFosterApplicationStatus(
  id: string,
  status: FosterApplicationStatus,
  notes?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getEstablishmentContext()
  if (!ctx) return { ok: false, error: 'Non authentifié' }
  if (!ctx.permissions.canManageFosterApplications) {
    return { ok: false, error: 'Accès refusé' }
  }

  const admin = createAdminClient()

  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }
  if (typeof notes === 'string') {
    patch.admin_notes = notes.trim() ? notes.trim() : null
  }
  if (status === 'qualified') {
    patch.qualified_at = new Date().toISOString()
    patch.qualified_by = ctx.membership.id
  }

  const { error } = await admin
    .from('foster_applications')
    .update(patch as never)
    .eq('id', id)
    .eq('establishment_id', ctx.establishment.id)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/admin/candidatures-fa')
  revalidatePath(`/admin/candidatures-fa/${id}`)
  return { ok: true }
}

export async function updateFosterApplicationNotes(
  id: string,
  notes: string,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getEstablishmentContext()
  if (!ctx) return { ok: false, error: 'Non authentifié' }
  if (!ctx.permissions.canManageFosterApplications) {
    return { ok: false, error: 'Accès refusé' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('foster_applications')
    .update({
      admin_notes: notes.trim() ? notes.trim() : null,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', id)
    .eq('establishment_id', ctx.establishment.id)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/admin/candidatures-fa')
  revalidatePath(`/admin/candidatures-fa/${id}`)
  return { ok: true }
}
