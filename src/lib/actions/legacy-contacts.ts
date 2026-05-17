'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireEstablishment, requirePermission } from '@/lib/establishment/permissions'
import { logActivity } from '@/lib/actions/activity-log'
import type { ClientKind, ContactCategory } from '@/lib/types/database'

export interface LegacyContact {
  id: string
  source: string
  full_name: string
  address: string | null
  postal_code: string | null
  city: string | null
  phone: string | null
  phone_normalized: string | null
  converted_to_client_id: string | null
  converted_at: string | null
  imported_at: string
}

export interface SearchLegacyOptions {
  query?: string
  city?: string
  showConverted?: boolean
  page?: number
  pageSize?: number
}

export async function searchLegacyContacts(opts: SearchLegacyOptions = {}) {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    const page = Math.max(0, opts.page ?? 0)
    const pageSize = Math.min(200, Math.max(10, opts.pageSize ?? 50))
    const from = page * pageSize
    const to = from + pageSize - 1

    let q = supabase
      .from('legacy_contacts')
      .select('id, source, full_name, address, postal_code, city, phone, phone_normalized, converted_to_client_id, converted_at, imported_at', { count: 'exact' })
      .eq('establishment_id', establishmentId)

    const query = opts.query?.trim()
    if (query && query.length >= 2) {
      // Recherche : si chiffres → tel, sinon trigram sur nom OU ilike sur ville
      const digits = query.replace(/\D/g, '')
      if (digits.length >= 4) {
        q = q.ilike('phone_normalized', `%${digits}%`)
      } else {
        const normalized = query.toLowerCase()
        // PostgREST : OR trigram match (via %) OR ilike sur city
        q = q.or(`full_name_normalized.ilike.%${normalized}%,city.ilike.%${query}%`)
      }
    }

    if (opts.city && opts.city.trim()) {
      q = q.ilike('city', `%${opts.city.trim()}%`)
    }

    if (!opts.showConverted) {
      q = q.is('converted_to_client_id', null)
    }

    const { data, error, count } = await q
      .order('full_name', { ascending: true })
      .range(from, to)

    if (error) return { error: error.message }
    return { data: (data ?? []) as LegacyContact[], total: count ?? 0, page, pageSize }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function getLegacyContactsStats() {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()
    const [{ count: total }, { count: converted }] = await Promise.all([
      supabase
        .from('legacy_contacts')
        .select('id', { count: 'exact', head: true })
        .eq('establishment_id', establishmentId),
      supabase
        .from('legacy_contacts')
        .select('id', { count: 'exact', head: true })
        .eq('establishment_id', establishmentId)
        .not('converted_to_client_id', 'is', null),
    ])
    return { total: total ?? 0, converted: converted ?? 0 }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export interface ClientMatch {
  id: string
  name: string
  first_name: string | null
  phone: string | null
  city: string | null
  match_reason: 'phone' | 'name_city' | 'name'
}

/**
 * Cherche les clients existants qui ressemblent au contact legacy.
 * Match prioritaire : téléphone normalisé identique > nom+ville > nom seul.
 */
export async function findMatchingClientsForLegacy(legacyId: string) {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    const { data: legacyRaw, error: lErr } = await supabase
      .from('legacy_contacts')
      .select('full_name, phone_normalized, city')
      .eq('id', legacyId)
      .eq('establishment_id', establishmentId)
      .single()
    if (lErr || !legacyRaw) return { error: lErr?.message ?? 'Contact introuvable' }
    const legacy = legacyRaw as { full_name: string; phone_normalized: string | null; city: string | null }

    const matches: Record<string, ClientMatch> = {}

    // Match téléphone (exact)
    if (legacy.phone_normalized) {
      const digits = legacy.phone_normalized.replace(/\D/g, '')
      const { data: byPhone } = await supabase
        .from('clients')
        .select('id, name, first_name, phone, city')
        .eq('establishment_id', establishmentId)
        .not('phone', 'is', null)
        .or(`phone.ilike.%${digits}%`)
        .limit(5)
      for (const c of (byPhone ?? []) as ClientMatch[]) {
        matches[c.id] = { ...c, match_reason: 'phone' }
      }
    }

    // Match nom + ville
    const nameTokens = legacy.full_name.split(/\s+/).filter((t) => t.length >= 2)
    if (nameTokens.length > 0 && legacy.city) {
      const mainToken = nameTokens[0]
      const { data: byNameCity } = await supabase
        .from('clients')
        .select('id, name, first_name, phone, city')
        .eq('establishment_id', establishmentId)
        .ilike('name', `%${mainToken}%`)
        .ilike('city', `%${legacy.city}%`)
        .limit(5)
      for (const c of (byNameCity ?? []) as ClientMatch[]) {
        if (!matches[c.id]) matches[c.id] = { ...c, match_reason: 'name_city' }
      }
    }

    return { data: Object.values(matches) }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export interface ConvertOptions {
  // Si fourni : lie au client existant sans créer de nouveau client
  linkToClientId?: string
  // Sinon : crée un nouveau client avec ces données
  newClient?: {
    kind: ClientKind
    name: string
    first_name: string | null
    phone: string | null
    address: string | null
    postal_code: string | null
    city: string | null
    type: ContactCategory | null
    notes: string | null
  }
}

export async function convertLegacyToClient(legacyId: string, opts: ConvertOptions) {
  try {
    const { establishmentId } = await requirePermission('manage_clients')
    const supabase = createAdminClient()

    const { data: legacy, error: lErr } = await supabase
      .from('legacy_contacts')
      .select('id, full_name, converted_to_client_id, source')
      .eq('id', legacyId)
      .eq('establishment_id', establishmentId)
      .single()
    if (lErr || !legacy) return { error: lErr?.message ?? 'Contact introuvable' }

    if (legacy.converted_to_client_id) {
      return { error: 'Ce contact a déjà été converti.' }
    }

    let clientId: string

    if (opts.linkToClientId) {
      const { data: existing, error: eErr } = await supabase
        .from('clients')
        .select('id')
        .eq('id', opts.linkToClientId)
        .eq('establishment_id', establishmentId)
        .single()
      if (eErr || !existing) return { error: 'Client cible introuvable' }
      clientId = existing.id
    } else if (opts.newClient) {
      const payload = {
        ...opts.newClient,
        establishment_id: establishmentId,
        notes: opts.newClient.notes
          ? `${opts.newClient.notes}\n\n[Importé depuis ${legacy.source} — ${legacy.full_name}]`
          : `[Importé depuis ${legacy.source} — ${legacy.full_name}]`,
      }
      const { data: created, error: cErr } = await supabase
        .from('clients')
        .insert(payload)
        .select('id')
        .single()
      if (cErr || !created) return { error: cErr?.message ?? 'Création client échouée' }
      clientId = created.id
    } else {
      return { error: 'Spécifier linkToClientId ou newClient' }
    }

    // Marque le legacy comme converti (on garde la ligne)
    const { data: { user } } = await supabase.auth.getUser()
    const { error: uErr } = await supabase
      .from('legacy_contacts')
      .update({
        converted_to_client_id: clientId,
        converted_at: new Date().toISOString(),
        converted_by: user?.id ?? null,
      })
      .eq('id', legacyId)

    if (uErr) return { error: uErr.message }

    logActivity({
      action: opts.linkToClientId ? 'update' : 'create',
      entityType: 'client',
      entityId: clientId,
      entityName: legacy.full_name,
      details: { from_legacy: legacy.id, source: legacy.source, action: opts.linkToClientId ? 'liaison' : 'conversion' },
    })

    revalidatePath('/clients')
    return { data: { clientId } }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
