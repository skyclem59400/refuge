'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireEstablishment, requirePermission } from '@/lib/establishment/permissions'
import { logActivity } from '@/lib/actions/activity-log'
import type {
  Sponsorship,
  SponsorshipKind,
  SponsorshipStatus,
  SponsorshipEndedReason,
  SponsorshipWithAnimal,
  SponsorshipWithClient,
} from '@/lib/types/database'

export interface CreateSponsorshipInput {
  animal_id: string
  client_id: string
  kind: SponsorshipKind
  monthly_amount?: number | null
  started_at?: string
  public_alias?: string | null
  show_publicly?: boolean
  notes?: string | null
}

export async function createSponsorship(input: CreateSponsorshipInput) {
  try {
    const { establishmentId } = await requirePermission('manage_clients')
    const supabase = createAdminClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('sponsorships')
      .insert({
        establishment_id: establishmentId,
        animal_id: input.animal_id,
        client_id: input.client_id,
        kind: input.kind,
        status: 'active',
        monthly_amount: input.monthly_amount ?? null,
        started_at: input.started_at ?? new Date().toISOString().slice(0, 10),
        public_alias: input.public_alias ?? null,
        show_publicly: input.show_publicly ?? false,
        notes: input.notes ?? null,
        created_by: user?.id ?? null,
      })
      .select()
      .single()

    if (error) return { error: error.message }
    logActivity({ action: 'create', entityType: 'sponsorship', entityId: data.id, details: { ...input } })
    revalidatePath(`/animals/${input.animal_id}`)
    revalidatePath(`/clients/${input.client_id}`)
    return { data: data as Sponsorship }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export interface UpdateSponsorshipInput {
  kind?: SponsorshipKind
  status?: SponsorshipStatus
  monthly_amount?: number | null
  public_alias?: string | null
  show_publicly?: boolean
  notes?: string | null
}

export async function updateSponsorship(id: string, input: UpdateSponsorshipInput) {
  try {
    const { establishmentId } = await requirePermission('manage_clients')
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('sponsorships')
      .update(input)
      .eq('id', id)
      .eq('establishment_id', establishmentId)
      .select('animal_id, client_id')
      .single()

    if (error) return { error: error.message }
    logActivity({ action: 'update', entityType: 'sponsorship', entityId: id, details: { ...input } })
    revalidatePath(`/animals/${data.animal_id}`)
    revalidatePath(`/clients/${data.client_id}`)
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function endSponsorship(id: string, reason: SponsorshipEndedReason, endedAt?: string) {
  try {
    const { establishmentId } = await requirePermission('manage_clients')
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('sponsorships')
      .update({
        status: 'ended',
        ended_at: endedAt ?? new Date().toISOString().slice(0, 10),
        ended_reason: reason,
      })
      .eq('id', id)
      .eq('establishment_id', establishmentId)
      .select('animal_id, client_id')
      .single()

    if (error) return { error: error.message }
    logActivity({ action: 'update', entityType: 'sponsorship', entityId: id, details: { ended: true, reason } })
    revalidatePath(`/animals/${data.animal_id}`)
    revalidatePath(`/clients/${data.client_id}`)
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function deleteSponsorship(id: string) {
  try {
    const { establishmentId } = await requirePermission('manage_clients')
    const supabase = createAdminClient()
    const { data: sp } = await supabase
      .from('sponsorships')
      .select('animal_id, client_id')
      .eq('id', id)
      .eq('establishment_id', establishmentId)
      .single()

    const { error } = await supabase
      .from('sponsorships')
      .delete()
      .eq('id', id)
      .eq('establishment_id', establishmentId)

    if (error) return { error: error.message }
    logActivity({ action: 'delete', entityType: 'sponsorship', entityId: id })
    if (sp) {
      revalidatePath(`/animals/${sp.animal_id}`)
      revalidatePath(`/clients/${sp.client_id}`)
    }
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/**
 * Récupère les parrains d'un animal avec leur info client + total versé.
 */
export async function getSponsorshipsForAnimal(animalId: string): Promise<{ data?: SponsorshipWithClient[]; error?: string }> {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('sponsorships')
      .select('*, client:clients!client_id(id, kind, name, first_name, email, phone, city)')
      .eq('animal_id', animalId)
      .eq('establishment_id', establishmentId)
      .order('status', { ascending: true })
      .order('started_at', { ascending: false })

    if (error) return { error: error.message }
    const list = (data ?? []) as SponsorshipWithClient[]

    // Récupère les totaux versés en un seul appel
    const ids = list.map((s) => s.id)
    if (ids.length > 0) {
      const { data: donRows } = await supabase
        .from('donations')
        .select('sponsorship_id, amount')
        .in('sponsorship_id', ids)
      const totals: Record<string, number> = {}
      for (const d of (donRows ?? []) as { sponsorship_id: string; amount: number }[]) {
        totals[d.sponsorship_id] = (totals[d.sponsorship_id] ?? 0) + Number(d.amount)
      }
      for (const s of list) {
        s.total_donated = totals[s.id] ?? 0
      }
    }

    return { data: list }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/**
 * Récupère les filleuls d'un client (animaux qu'il parraine).
 */
export async function getSponsorshipsForClient(clientId: string): Promise<{ data?: SponsorshipWithAnimal[]; error?: string }> {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('sponsorships')
      .select('*, animal:animals!animal_id(id, name, species, status, photo_url)')
      .eq('client_id', clientId)
      .eq('establishment_id', establishmentId)
      .order('status', { ascending: true })
      .order('started_at', { ascending: false })

    if (error) return { error: error.message }
    return { data: (data ?? []) as SponsorshipWithAnimal[] }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/**
 * Cherche les parrainages "à recontacter" : ended récemment suite à sortie animal.
 * Utile pour l'équipe pour proposer un nouveau filleul aux parrains orphelins.
 */
export async function getSponsorshipsToRecontact(daysWindow = 30) {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - daysWindow)

    const { data, error } = await supabase
      .from('sponsorships')
      .select('*, animal:animals!animal_id(id, name, species), client:clients!client_id(id, kind, name, first_name, email, phone)')
      .eq('establishment_id', establishmentId)
      .eq('status', 'ended')
      .in('ended_reason', ['animal_adopted', 'animal_deceased', 'animal_transferred', 'animal_returned'])
      .gte('ended_at', cutoff.toISOString().slice(0, 10))
      .order('ended_at', { ascending: false })

    if (error) return { error: error.message }
    return { data: data ?? [] }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
