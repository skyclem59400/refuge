'use server'

// Vue admin des comptes du portail public sda-nord.com (potentiels
// adoptants, parrains, signaleurs, etc.) — alimentée par la table
// `portal_profiles` synchronisée depuis le projet sda-portail.
//
// Une seule action exposée : listPortalAccountsForAdmin().
// Tous les types vivent dans ./portal-accounts-admin-types.ts (règle
// 'use server' = export async functions uniquement).

import { createAdminClient } from '@/lib/supabase/server'
import { getEstablishmentContext } from '@/lib/establishment/context'
import type {
  PortalAccountRow,
  PortalAccountFilters,
} from './portal-accounts-admin-types'

interface RawProfile {
  user_id: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  address: string | null
  postal_code: string | null
  city: string | null
  consent_marketing: boolean
  created_at: string
  updated_at: string
}

export async function listPortalAccountsForAdmin(
  filters: PortalAccountFilters = {},
): Promise<{ data: PortalAccountRow[]; error?: string }> {
  const ctx = await getEstablishmentContext()
  if (!ctx) return { data: [], error: 'Non authentifié' }
  // Permission : un admin/manager qui peut gérer les clients peut voir les
  // comptes portail (potentiels adoptants).
  if (!ctx.permissions.canManageClients) {
    return { data: [], error: 'Accès refusé' }
  }

  const admin = createAdminClient()

  // 1. Tous les profils portail
  const { data: profiles, error: profilesErr } = (await admin
    .from('portal_profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(filters.limit ?? 500)) as {
    data: RawProfile[] | null
    error: { message: string } | null
  }

  if (profilesErr) return { data: [], error: profilesErr.message }
  const rows = profiles ?? []
  if (rows.length === 0) return { data: [] }

  const userIds = rows.map((r) => r.user_id)

  // 2. Emails depuis auth.users via RPC SECURITY DEFINER
  const emails = new Map<string, string>()
  try {
    const { data: usersInfo } = (await admin.rpc('get_users_info', {
      user_ids: userIds,
    })) as {
      data: { id: string; email: string }[] | null
    }
    for (const u of usersInfo ?? []) {
      if (u?.id && u?.email) emails.set(u.id, u.email)
    }
  } catch {
    // best-effort
  }

  // 3. Liens client (portal_user_id) dans cet établissement
  const clientLinks = new Map<string, { id: string; name: string }>()
  const { data: clientRows } = (await admin
    .from('clients')
    .select('id, first_name, name, portal_user_id')
    .eq('establishment_id', ctx.establishment.id)
    .in('portal_user_id', userIds)) as {
    data: { id: string; first_name: string | null; name: string | null; portal_user_id: string }[] | null
  }
  for (const c of clientRows ?? []) {
    const fullName = [c.first_name, c.name].filter(Boolean).join(' ').trim()
    clientLinks.set(c.portal_user_id, { id: c.id, name: fullName || '—' })
  }

  // 4. Compteurs de candidatures par user_id (3 tables : adoption_inquiries,
  //    volunteer_applications, foster_applications). On reste sur du COUNT
  //    en batch, pas du N+1.
  const [adoptionRes, volunteerRes, fosterRes] = await Promise.all([
    admin
      .from('adoption_inquiries')
      .select('user_id')
      .eq('establishment_id', ctx.establishment.id)
      .in('user_id', userIds),
    admin
      .from('volunteer_applications')
      .select('user_id')
      .eq('establishment_id', ctx.establishment.id)
      .in('user_id', userIds),
    admin
      .from('foster_applications')
      .select('user_id')
      .eq('establishment_id', ctx.establishment.id)
      .in('user_id', userIds),
  ])

  const countByUser = (
    res: { data: { user_id: string | null }[] | null } | unknown,
  ): Map<string, number> => {
    const m = new Map<string, number>()
    const data = (res as { data: { user_id: string | null }[] | null })?.data
    for (const r of data ?? []) {
      if (r.user_id) m.set(r.user_id, (m.get(r.user_id) ?? 0) + 1)
    }
    return m
  }
  const adoptionCounts = countByUser(adoptionRes)
  const volunteerCounts = countByUser(volunteerRes)
  const fosterCounts = countByUser(fosterRes)

  // 5. Assemblage + filtres
  let assembled: PortalAccountRow[] = rows.map((p) => ({
    user_id: p.user_id,
    email: emails.get(p.user_id) ?? null,
    first_name: p.first_name,
    last_name: p.last_name,
    phone: p.phone,
    city: p.city,
    postal_code: p.postal_code,
    consent_marketing: p.consent_marketing,
    created_at: p.created_at,
    linked_client: clientLinks.get(p.user_id) ?? null,
    counts: {
      adoption: adoptionCounts.get(p.user_id) ?? 0,
      volunteer: volunteerCounts.get(p.user_id) ?? 0,
      foster: fosterCounts.get(p.user_id) ?? 0,
    },
  }))

  // Filtre : seulement les comptes liés ou non
  if (filters.linkedOnly === true) {
    assembled = assembled.filter((r) => r.linked_client !== null)
  } else if (filters.linkedOnly === false) {
    assembled = assembled.filter((r) => r.linked_client === null)
  }

  // Filtre : recherche libre (nom, email, ville)
  if (filters.search?.trim()) {
    const s = filters.search.trim().toLowerCase()
    assembled = assembled.filter((r) => {
      const fields = [
        r.first_name,
        r.last_name,
        r.email,
        r.city,
        r.phone,
      ].filter(Boolean) as string[]
      return fields.some((f) => f.toLowerCase().includes(s))
    })
  }

  return { data: assembled }
}
