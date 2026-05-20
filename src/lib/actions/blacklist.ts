'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireEstablishment, requirePermission } from '@/lib/establishment/permissions'
import { logActivity } from '@/lib/actions/activity-log'
import type {
  BlacklistMatch,
  BlacklistSource,
  Client,
} from '@/lib/types/database'

/**
 * Détecte les matches blacklist pour un candidat à l'adoption.
 * Utilisé côté inquiry publique (autobloc) et côté contrat back-office.
 */
export async function checkAdopterBlacklist(params: {
  establishment_id: string
  last_name: string
  first_name?: string | null
  email?: string | null
  phone?: string | null
  birth_date?: string | null
}): Promise<{ data: BlacklistMatch[] } | { error: string }> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('check_adopter_blacklist', {
      p_establishment_id: params.establishment_id,
      p_last_name: params.last_name,
      p_first_name: params.first_name ?? '',
      p_email: params.email ?? null,
      p_phone: params.phone ?? null,
      p_birth_date: params.birth_date ?? null,
    })
    if (error) return { error: error.message }
    return { data: (data ?? []) as BlacklistMatch[] }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ============================================================
// READ — Liste des contacts blacklistés
// ============================================================

export interface BlacklistedClientRow extends Client {
  blacklisted_animals: Array<{ id: string; name: string; medal_number: string | null }>
  blacklisted_by_name: string | null
  blacklist_removed_by_name: string | null
}

export async function getBlacklistedClients(filters?: {
  source?: BlacklistSource
  includeRemoved?: boolean
}): Promise<{ data: BlacklistedClientRow[] } | { error: string }> {
  try {
    const { establishmentId } = await requireEstablishment()
    const admin = createAdminClient()

    let query = admin
      .from('clients')
      .select('*')
      .eq('establishment_id', establishmentId)
      .eq('is_blacklisted', true)
      .order('blacklisted_at', { ascending: false })

    if (filters?.source) {
      query = query.eq('blacklist_source', filters.source)
    }

    if (!filters?.includeRemoved) {
      query = query.is('blacklist_removed_at', null)
    }

    const { data: clients, error } = await query
    if (error) return { error: error.message }

    const rows = (clients ?? []) as Client[]
    if (rows.length === 0) return { data: [] }

    // Animaux liés par judicial_owner_client_id
    const ids = rows.map((c) => c.id)
    const { data: animals } = await admin
      .from('animals')
      .select('id, name, medal_number, judicial_owner_client_id')
      .in('judicial_owner_client_id', ids)

    const animalsByClient = new Map<string, Array<{ id: string; name: string; medal_number: string | null }>>()
    for (const a of (animals ?? []) as Array<{ id: string; name: string; medal_number: string | null; judicial_owner_client_id: string }>) {
      const arr = animalsByClient.get(a.judicial_owner_client_id) ?? []
      arr.push({ id: a.id, name: a.name, medal_number: a.medal_number })
      animalsByClient.set(a.judicial_owner_client_id, arr)
    }

    // Noms des utilisateurs qui ont inscrit/retiré (auth.users.email via RPC existant)
    const userIds = Array.from(
      new Set(
        rows.flatMap((r) => [r.blacklisted_by, r.blacklist_removed_by]).filter((v): v is string => !!v),
      ),
    )
    const userNames = new Map<string, string>()
    if (userIds.length > 0) {
      const { data: info } = await admin.rpc('get_users_info', { user_ids: userIds })
      for (const u of (info ?? []) as Array<{ id: string; email: string | null; full_name: string | null }>) {
        userNames.set(u.id, u.full_name || u.email || u.id)
      }
    }

    const enriched: BlacklistedClientRow[] = rows.map((c) => ({
      ...c,
      blacklisted_animals: animalsByClient.get(c.id) ?? [],
      blacklisted_by_name: c.blacklisted_by ? userNames.get(c.blacklisted_by) ?? null : null,
      blacklist_removed_by_name: c.blacklist_removed_by ? userNames.get(c.blacklist_removed_by) ?? null : null,
    }))

    return { data: enriched }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ============================================================
// WRITE — Lier / créer un propriétaire judiciaire à un animal
// ============================================================

export interface NewBlacklistClientPayload {
  kind?: 'person' | 'organization'
  name: string
  first_name?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  postal_code?: string | null
  city?: string | null
  birth_date?: string | null
  birth_place?: string | null
  national_id?: string | null
}

/**
 * Lie un animal à son propriétaire judiciaire mis en cause :
 *  - soit en utilisant un client existant (`client_id`) — on l'inscrit sur la
 *    liste noire si pas déjà fait
 *  - soit en créant un nouveau client (`new_client_data`) — automatiquement
 *    inscrit sur la liste noire avec source `judicial_procedure`.
 * Met également à jour `animals.judicial_owner_name` (snapshot lisible).
 */
export async function upsertJudicialOwner(input: {
  animal_id: string
  client_id?: string | null
  new_client_data?: NewBlacklistClientPayload | null
  reason: string
}): Promise<{ data: { client_id: string } } | { error: string }> {
  try {
    if (!input.reason || input.reason.trim().length < 10) {
      return { error: 'Le motif d\'inscription est obligatoire (minimum 10 caractères).' }
    }
    if (!input.client_id && !input.new_client_data) {
      return { error: 'Aucun contact fourni (client_id ou new_client_data requis).' }
    }

    const { establishmentId, userId } = await requirePermission('manage_animals')
    const admin = createAdminClient()

    // Vérifier que l'animal appartient à l'établissement
    const { data: animal } = await admin
      .from('animals')
      .select('id, name, establishment_id, judicial_owner_client_id')
      .eq('id', input.animal_id)
      .eq('establishment_id', establishmentId)
      .single()

    if (!animal) return { error: 'Animal introuvable' }

    const nowIso = new Date().toISOString()
    const reason = input.reason.trim()

    let clientId: string
    let displayName: string

    if (input.client_id) {
      // Client existant : on flag (si pas déjà fait), on update le motif sans
      // écraser une raison plus détaillée.
      const { data: existing } = await admin
        .from('clients')
        .select('*')
        .eq('id', input.client_id)
        .eq('establishment_id', establishmentId)
        .single()

      if (!existing) return { error: 'Contact introuvable' }
      const c = existing as Client

      const updates: Partial<Client> = {}
      if (!c.is_blacklisted) {
        updates.is_blacklisted = true
        updates.blacklist_reason = reason
        updates.blacklist_source = 'judicial_procedure'
        updates.blacklisted_at = nowIso
        updates.blacklisted_by = userId
        updates.blacklist_removed_at = null
        updates.blacklist_removed_by = null
        updates.blacklist_removal_reason = null
      }

      if (Object.keys(updates).length > 0) {
        const { error: updErr } = await admin
          .from('clients')
          .update(updates)
          .eq('id', c.id)
          .eq('establishment_id', establishmentId)
        if (updErr) return { error: updErr.message }
      }

      clientId = c.id
      displayName = c.first_name ? `${c.name} ${c.first_name}` : c.name
    } else {
      // Création d'un nouveau client, automatiquement blacklisté
      const payload = input.new_client_data!
      const trimmedName = payload.name.trim()
      if (!trimmedName) return { error: 'Le nom du propriétaire est obligatoire' }

      const insertData = {
        establishment_id: establishmentId,
        kind: payload.kind ?? 'person',
        name: trimmedName,
        first_name: payload.first_name?.trim() || null,
        email: payload.email?.trim().toLowerCase() || null,
        phone: payload.phone?.trim() || null,
        address: payload.address?.trim() || null,
        postal_code: payload.postal_code?.trim() || null,
        city: payload.city?.trim() || null,
        birth_date: payload.birth_date || null,
        birth_place: payload.birth_place?.trim() || null,
        national_id: payload.national_id?.trim() || null,
        is_blacklisted: true,
        blacklist_reason: reason,
        blacklist_source: 'judicial_procedure' as BlacklistSource,
        blacklisted_at: nowIso,
        blacklisted_by: userId,
      }

      const { data: created, error: insErr } = await admin
        .from('clients')
        .insert(insertData)
        .select('id, name, first_name')
        .single()

      if (insErr || !created) {
        return { error: `Création du contact impossible : ${insErr?.message ?? 'inconnu'}` }
      }
      clientId = created.id
      displayName = created.first_name ? `${created.name} ${created.first_name}` : created.name
    }

    // Lier l'animal + snapshot lisible
    const { error: animalErr } = await admin
      .from('animals')
      .update({
        judicial_owner_client_id: clientId,
        judicial_owner_name: displayName,
      })
      .eq('id', input.animal_id)
      .eq('establishment_id', establishmentId)

    if (animalErr) return { error: animalErr.message }

    revalidatePath(`/animals/${input.animal_id}`)
    revalidatePath('/etablissement/liste-noire')
    revalidatePath(`/clients/${clientId}`)
    logActivity({
      action: 'update',
      entityType: 'animal',
      entityId: input.animal_id,
      entityName: animal.name,
      details: {
        judicial_owner_client_id: clientId,
        judicial_owner_name: displayName,
        blacklist_reason: reason,
      },
    })
    logActivity({
      action: 'update',
      entityType: 'client',
      entityId: clientId,
      entityName: displayName,
      details: {
        is_blacklisted: true,
        blacklist_source: 'judicial_procedure',
        linked_animal_id: input.animal_id,
      },
    })

    return { data: { client_id: clientId } }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/**
 * Détache l'animal de son propriétaire judiciaire (sans retirer le contact
 * de la liste noire). Utilisé en cas d'erreur de saisie.
 */
export async function detachJudicialOwner(animalId: string): Promise<{ success: true } | { error: string }> {
  try {
    const { establishmentId } = await requirePermission('manage_animals')
    const admin = createAdminClient()

    const { data: animal } = await admin
      .from('animals')
      .select('id, name, judicial_owner_client_id, judicial_owner_name')
      .eq('id', animalId)
      .eq('establishment_id', establishmentId)
      .single()

    if (!animal) return { error: 'Animal introuvable' }

    const { error } = await admin
      .from('animals')
      .update({ judicial_owner_client_id: null })
      .eq('id', animalId)
      .eq('establishment_id', establishmentId)

    if (error) return { error: error.message }

    revalidatePath(`/animals/${animalId}`)
    revalidatePath('/etablissement/liste-noire')
    logActivity({
      action: 'update',
      entityType: 'animal',
      entityId: animalId,
      entityName: animal.name,
      details: { judicial_owner_client_id: null, previous: animal.judicial_owner_client_id },
    })
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ============================================================
// WRITE — Inscription manuelle (depuis page liste noire)
// ============================================================

export async function addManualBlacklist(input: {
  client_id?: string | null
  new_client_data?: NewBlacklistClientPayload | null
  reason: string
  source?: BlacklistSource
}): Promise<{ data: { client_id: string } } | { error: string }> {
  try {
    if (!input.reason || input.reason.trim().length < 10) {
      return { error: 'Le motif d\'inscription est obligatoire (minimum 10 caractères).' }
    }
    const { establishmentId, userId } = await requirePermission('manage_establishment')
    const admin = createAdminClient()

    const source: BlacklistSource = input.source ?? 'manual'
    const nowIso = new Date().toISOString()
    const reason = input.reason.trim()

    let clientId: string
    let displayName: string

    if (input.client_id) {
      const { data: existing } = await admin
        .from('clients')
        .select('*')
        .eq('id', input.client_id)
        .eq('establishment_id', establishmentId)
        .single()

      if (!existing) return { error: 'Contact introuvable' }
      const c = existing as Client

      if (c.is_blacklisted && !c.blacklist_removed_at) {
        return { error: 'Ce contact est déjà inscrit sur la liste noire.' }
      }

      const { error } = await admin
        .from('clients')
        .update({
          is_blacklisted: true,
          blacklist_reason: reason,
          blacklist_source: source,
          blacklisted_at: nowIso,
          blacklisted_by: userId,
          blacklist_removed_at: null,
          blacklist_removed_by: null,
          blacklist_removal_reason: null,
        })
        .eq('id', c.id)
        .eq('establishment_id', establishmentId)
      if (error) return { error: error.message }

      clientId = c.id
      displayName = c.first_name ? `${c.name} ${c.first_name}` : c.name
    } else if (input.new_client_data) {
      const payload = input.new_client_data
      const trimmedName = payload.name.trim()
      if (!trimmedName) return { error: 'Le nom du contact est obligatoire' }

      const { data: created, error } = await admin
        .from('clients')
        .insert({
          establishment_id: establishmentId,
          kind: payload.kind ?? 'person',
          name: trimmedName,
          first_name: payload.first_name?.trim() || null,
          email: payload.email?.trim().toLowerCase() || null,
          phone: payload.phone?.trim() || null,
          address: payload.address?.trim() || null,
          postal_code: payload.postal_code?.trim() || null,
          city: payload.city?.trim() || null,
          birth_date: payload.birth_date || null,
          birth_place: payload.birth_place?.trim() || null,
          national_id: payload.national_id?.trim() || null,
          is_blacklisted: true,
          blacklist_reason: reason,
          blacklist_source: source,
          blacklisted_at: nowIso,
          blacklisted_by: userId,
        })
        .select('id, name, first_name')
        .single()

      if (error || !created) return { error: `Création impossible : ${error?.message ?? 'inconnu'}` }
      clientId = created.id
      displayName = created.first_name ? `${created.name} ${created.first_name}` : created.name
    } else {
      return { error: 'Contact existant ou nouvelle fiche requis.' }
    }

    revalidatePath('/etablissement/liste-noire')
    revalidatePath(`/clients/${clientId}`)
    logActivity({
      action: 'update',
      entityType: 'client',
      entityId: clientId,
      entityName: displayName,
      details: { is_blacklisted: true, blacklist_source: source, manual: true },
    })

    return { data: { client_id: clientId } }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ============================================================
// WRITE — Retrait de la liste noire (admin only)
// ============================================================

export async function removeFromBlacklist(input: {
  client_id: string
  reason: string
}): Promise<{ success: true } | { error: string }> {
  try {
    if (!input.reason || input.reason.trim().length < 10) {
      return { error: 'Le motif de retrait est obligatoire (minimum 10 caractères, audit critique).' }
    }
    const ctx = await requirePermission('manage_establishment')
    if (!ctx.groups?.some((g) => g.is_system && g.name === 'Administrateur')) {
      return { error: 'Retrait réservé aux administrateurs de l\'établissement.' }
    }

    const admin = createAdminClient()

    const { data: client } = await admin
      .from('clients')
      .select('id, name, first_name, is_blacklisted, blacklist_removed_at')
      .eq('id', input.client_id)
      .eq('establishment_id', ctx.establishmentId)
      .single()

    if (!client) return { error: 'Contact introuvable' }
    if (!client.is_blacklisted || client.blacklist_removed_at) {
      return { error: 'Ce contact n\'est pas (ou plus) sur la liste noire.' }
    }

    const nowIso = new Date().toISOString()
    const { error } = await admin
      .from('clients')
      .update({
        is_blacklisted: false,
        blacklist_removed_at: nowIso,
        blacklist_removed_by: ctx.userId,
        blacklist_removal_reason: input.reason.trim(),
      })
      .eq('id', input.client_id)
      .eq('establishment_id', ctx.establishmentId)

    if (error) return { error: error.message }

    const displayName = client.first_name ? `${client.name} ${client.first_name}` : client.name
    revalidatePath('/etablissement/liste-noire')
    revalidatePath(`/clients/${input.client_id}`)
    logActivity({
      action: 'update',
      entityType: 'client',
      entityId: input.client_id,
      entityName: displayName,
      details: {
        action: 'blacklist_removed',
        reason: input.reason.trim(),
        severity: 'critical',
      },
    })

    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ============================================================
// READ — Recherche client pour le picker JudicialOwnerPicker
// ============================================================

export async function searchClientsForBlacklistPicker(search: string): Promise<{
  data: Array<Pick<Client, 'id' | 'kind' | 'name' | 'first_name' | 'email' | 'phone' | 'city' | 'is_blacklisted'>>
} | { error: string }> {
  try {
    const { establishmentId } = await requireEstablishment()
    const admin = createAdminClient()

    const term = search.trim()
    let query = admin
      .from('clients')
      .select('id, kind, name, first_name, email, phone, city, is_blacklisted')
      .eq('establishment_id', establishmentId)

    if (term.length > 0) {
      const like = `%${term}%`
      query = query.or(`name.ilike.${like},first_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
    }

    const { data, error } = await query.order('name', { ascending: true }).limit(20)
    if (error) return { error: error.message }
    return { data: (data ?? []) as Array<Pick<Client, 'id' | 'kind' | 'name' | 'first_name' | 'email' | 'phone' | 'city' | 'is_blacklisted'>> }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
