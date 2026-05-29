'use server'

// Server actions dédiées à la vue d'ensemble admin /admin/parrainages :
// liste globale (filtres) + KPI financiers (revenu mensuel, parrains, etc.).
//
// Les actions CRUD individuelles (créer, mettre à jour, terminer un
// parrainage) restent dans ./sponsorships.ts.
//
// IMPORTANT : ce fichier 'use server' ne peut exporter QUE des async
// functions sous Next.js 16 / Turbopack. Les types associés vivent dans
// ./sponsorships-admin-types.ts — ne pas y remettre d'export type.

import { createAdminClient } from '@/lib/supabase/server'
import { getEstablishmentContext } from '@/lib/establishment/context'
import type {
  SponsorshipStatus,
  SponsorshipKind,
} from '@/lib/types/database'
import type {
  SponsorshipWithBoth,
  SponsorshipStats,
} from './sponsorships-admin-types'

interface AdminListFilters {
  status?: SponsorshipStatus | null
  kind?: SponsorshipKind | null
  search?: string | null
  /** Inclut les parrainages terminés dans la sortie. Défaut : false. */
  includeEnded?: boolean
  limit?: number
}

/**
 * Liste tous les parrainages de l'établissement, avec animal + client joints
 * et le cumul des dons fléchés (calculé en un seul appel pour éviter N+1).
 */
export async function listSponsorshipsForAdmin(
  filters: AdminListFilters = {},
): Promise<{ data: SponsorshipWithBoth[]; error?: string }> {
  const ctx = await getEstablishmentContext()
  if (!ctx) return { data: [], error: 'Non authentifié' }
  if (!ctx.permissions.canManageDonations) {
    return { data: [], error: 'Accès refusé' }
  }

  const admin = createAdminClient()
  let q = admin
    .from('sponsorships')
    .select(
      '*, animal:animals!animal_id(id, name, species, status, photo_url), client:clients!client_id(id, kind, name, first_name, email, phone, city)',
    )
    .eq('establishment_id', ctx.establishment.id)
    .order('status', { ascending: true })
    .order('started_at', { ascending: false })
    .limit(filters.limit ?? 500)

  if (filters.status) {
    q = q.eq('status', filters.status)
  } else if (!filters.includeEnded) {
    q = q.in('status', ['active', 'pending'])
  }
  if (filters.kind) q = q.eq('kind', filters.kind)

  const { data, error } = await q
  if (error) return { data: [], error: error.message }
  const list = (data ?? []) as SponsorshipWithBoth[]

  // Filtre recherche côté JS (la jointure rend le ilike SQL pénible)
  let filtered = list
  if (filters.search?.trim()) {
    const s = filters.search.trim().toLowerCase()
    filtered = list.filter((row) => {
      const fields: string[] = []
      const c = row.client
      if (c) {
        fields.push(c.name || '', c.first_name || '', c.email || '', c.city || '')
      }
      if (row.animal) {
        fields.push(row.animal.name || '')
      }
      return fields.some((f) => f.toLowerCase().includes(s))
    })
  }

  // Cumul des dons fléchés (un seul appel)
  const ids = filtered.map((s) => s.id)
  if (ids.length > 0) {
    const { data: donRows } = await admin
      .from('donations')
      .select('sponsorship_id, amount')
      .in('sponsorship_id', ids)
    const totals: Record<string, number> = {}
    for (const d of (donRows ?? []) as { sponsorship_id: string; amount: number }[]) {
      totals[d.sponsorship_id] = (totals[d.sponsorship_id] ?? 0) + Number(d.amount)
    }
    for (const s of filtered) {
      s.total_donated = totals[s.id] ?? 0
    }
  }

  return { data: filtered }
}

export async function getSponsorshipsStats(): Promise<SponsorshipStats> {
  const empty: SponsorshipStats = {
    activeCount: 0,
    distinctActiveSponsors: 0,
    mrr: 0,
    ytdRevenue: 0,
    avgMonthlyPerSponsor: 0,
    totalPayments: 0,
    lifetimeRevenue: 0,
  }

  const ctx = await getEstablishmentContext()
  if (!ctx || !ctx.permissions.canManageDonations) return empty

  const admin = createAdminClient()
  const establishmentId = ctx.establishment.id

  // Parrainages actifs : montant + client_id
  const { data: actives } = await admin
    .from('sponsorships')
    .select('client_id, monthly_amount')
    .eq('establishment_id', establishmentId)
    .eq('status', 'active')

  const activeRows = (actives ?? []) as {
    client_id: string
    monthly_amount: number | null
  }[]
  const activeCount = activeRows.length
  const mrr = activeRows.reduce((sum, r) => sum + Number(r.monthly_amount ?? 0), 0)
  const distinctActiveSponsors = new Set(activeRows.map((r) => r.client_id)).size
  const avgMonthlyPerSponsor =
    distinctActiveSponsors > 0 ? mrr / distinctActiveSponsors : 0

  // Donations fléchées
  const yearStart = `${new Date().getFullYear()}-01-01`
  const { data: donations } = await admin
    .from('donations')
    .select('amount, date')
    .eq('establishment_id', establishmentId)
    .not('sponsorship_id', 'is', null)

  const donationRows = (donations ?? []) as { amount: number; date: string }[]
  const lifetimeRevenue = donationRows.reduce((s, d) => s + Number(d.amount), 0)
  const ytdRevenue = donationRows
    .filter((d) => d.date >= yearStart)
    .reduce((s, d) => s + Number(d.amount), 0)

  return {
    activeCount,
    distinctActiveSponsors,
    mrr,
    ytdRevenue,
    avgMonthlyPerSponsor,
    totalPayments: donationRows.length,
    lifetimeRevenue,
  }
}
