'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { getEstablishmentContext } from '@/lib/establishment/context'
import type {
  VolunteerApplication,
  VolunteerApplicationStatus,
  VolunteerSkill,
} from '@/lib/types/database'

// --- Labels (FR) ---

export const VOLUNTEER_STATUS_LABELS: Record<VolunteerApplicationStatus, string> = {
  pending: 'Nouvelle',
  qualified: 'Qualifiée',
  interview_scheduled: 'Entretien planifié',
  accepted: 'Acceptée',
  declined: 'Refusée',
  archived: 'Archivée',
}

export const VOLUNTEER_STATUS_CLASSES: Record<VolunteerApplicationStatus, string> = {
  pending: 'bg-blue-500/15 text-blue-600',
  qualified: 'bg-amber-500/15 text-amber-700',
  interview_scheduled: 'bg-violet-500/15 text-violet-700',
  accepted: 'bg-emerald-500/15 text-emerald-700',
  declined: 'bg-rose-500/15 text-rose-600',
  archived: 'bg-slate-500/15 text-slate-500',
}

export const VOLUNTEER_SKILL_LABELS: Record<VolunteerSkill, string> = {
  dog_walking: 'Promenade des chiens',
  animal_care: 'Soins animaux',
  public_reception: 'Accueil public',
  transport: 'Transport (permis B)',
  grooming: 'Toilettage',
  maintenance: 'Maintenance',
  communication: 'Communication / RS',
  events: 'Événements',
  admin: 'Administratif',
}

export const VOLUNTEER_DAY_LABELS: Record<string, string> = {
  mon: 'Lun',
  tue: 'Mar',
  wed: 'Mer',
  thu: 'Jeu',
  fri: 'Ven',
  sat: 'Sam',
  sun: 'Dim',
}

export const VOLUNTEER_SLOT_LABELS: Record<string, string> = {
  morning: 'Matin',
  afternoon: 'Après-midi',
  evening: 'Soir',
}

export const VOLUNTEER_FREQUENCY_LABELS: Record<string, string> = {
  weekly: 'Hebdomadaire',
  biweekly: 'Bi-mensuelle',
  monthly: 'Mensuelle',
  occasional: 'Occasionnelle',
}

export const VOLUNTEER_PHYSICAL_LABELS: Record<string, string> = {
  good: 'Bonne',
  limited: 'Limitée',
  restricted: 'Restreinte',
}

// --- Queries ---

interface ListFilters {
  status?: VolunteerApplicationStatus | null
  search?: string | null
  /** true = uniquement avec user_id, false = uniquement sans user_id, null = tous */
  hasAccount?: boolean | null
  limit?: number
}

export async function listVolunteerApplications(
  filters: ListFilters = {}
): Promise<{ data: VolunteerApplication[]; error?: string }> {
  const ctx = await getEstablishmentContext()
  if (!ctx) return { data: [], error: 'Non authentifié' }
  if (!ctx.permissions.canManageVolunteerApplications) {
    return { data: [], error: 'Accès refusé' }
  }

  const admin = createAdminClient()
  let q = admin
    .from('volunteer_applications')
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
      `first_name.ilike.${s},last_name.ilike.${s},email.ilike.${s},city.ilike.${s},phone.ilike.${s},ticket_number.ilike.${s}`
    )
  }

  const result = (await q) as {
    data: VolunteerApplication[] | null
    error: { message: string } | null
  }
  if (result.error) return { data: [], error: result.error.message }
  return { data: result.data || [] }
}

export async function getVolunteerApplication(
  id: string
): Promise<{ application: VolunteerApplication | null; error?: string }> {
  const ctx = await getEstablishmentContext()
  if (!ctx) return { application: null, error: 'Non authentifié' }
  if (!ctx.permissions.canManageVolunteerApplications) {
    return { application: null, error: 'Accès refusé' }
  }

  const admin = createAdminClient()
  const result = (await admin
    .from('volunteer_applications')
    .select('*')
    .eq('id', id)
    .eq('establishment_id', ctx.establishment.id)
    .maybeSingle()) as {
    data: VolunteerApplication | null
    error: { message: string } | null
  }

  if (result.error) return { application: null, error: result.error.message }
  return { application: result.data }
}

export interface VolunteerStats {
  total: number
  pending: number
  qualified: number
  accepted: number
  byStatus: Record<VolunteerApplicationStatus, number>
}

export async function getVolunteerApplicationStats(): Promise<VolunteerStats> {
  const empty: VolunteerStats = {
    total: 0,
    pending: 0,
    qualified: 0,
    accepted: 0,
    byStatus: {
      pending: 0,
      qualified: 0,
      interview_scheduled: 0,
      accepted: 0,
      declined: 0,
      archived: 0,
    },
  }

  const ctx = await getEstablishmentContext()
  if (!ctx || !ctx.permissions.canManageVolunteerApplications) return empty

  const admin = createAdminClient()
  const result = (await admin
    .from('volunteer_applications')
    .select('status')
    .eq('establishment_id', ctx.establishment.id)) as {
    data: { status: VolunteerApplicationStatus }[] | null
    error: { message: string } | null
  }

  const rows = result.data || []
  const stats: VolunteerStats = {
    total: rows.length,
    pending: 0,
    qualified: 0,
    accepted: 0,
    byStatus: {
      pending: 0,
      qualified: 0,
      interview_scheduled: 0,
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

export async function updateVolunteerApplicationStatus(
  id: string,
  status: VolunteerApplicationStatus,
  notes?: string | null
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getEstablishmentContext()
  if (!ctx) return { ok: false, error: 'Non authentifié' }
  if (!ctx.permissions.canManageVolunteerApplications) {
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
    .from('volunteer_applications')
    .update(patch as never)
    .eq('id', id)
    .eq('establishment_id', ctx.establishment.id)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/admin/candidatures-benevoles')
  revalidatePath(`/admin/candidatures-benevoles/${id}`)
  return { ok: true }
}
