'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/establishment/permissions'
import { logActivity } from '@/lib/actions/activity-log'

export type ToneVariant = 'tu-prenom' | 'vous-prenom' | 'vous-nom' | 'institutionnel'
export type CollectivityType = 'commune' | 'epci' | 'departement' | 'region' | 'etat' | 'autre'

export interface Elu {
  id: string
  establishment_id: string
  civility: 'Monsieur' | 'Madame' | null
  first_name: string
  last_name: string
  role: string
  collectivity_name: string | null
  collectivity_type: CollectivityType | null
  email: string | null
  phone: string | null
  postal_address: string | null
  tone_variant: ToneVariant
  engaged: boolean
  notes: string | null
  tags: string[]
  last_contact_at: string | null
  created_at: string
  updated_at: string
}

export async function listElus() {
  try {
    const { establishmentId } = await requirePermission('manage_establishment')
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('elus')
      .select('*')
      .eq('establishment_id', establishmentId)
      .order('last_name')
    if (error) return { error: error.message }
    return { data: (data as Elu[]) || [] }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function getEluById(id: string) {
  try {
    const { establishmentId } = await requirePermission('manage_establishment')
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('elus')
      .select('*')
      .eq('id', id)
      .eq('establishment_id', establishmentId)
      .single()
    if (error) return { error: error.message }
    return { data: data as Elu }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export interface EluInput {
  id?: string
  civility?: 'Monsieur' | 'Madame' | null
  first_name: string
  last_name: string
  role: string
  collectivity_name?: string | null
  collectivity_type?: CollectivityType | null
  email?: string | null
  phone?: string | null
  postal_address?: string | null
  tone_variant: ToneVariant
  engaged: boolean
  notes?: string | null
  tags?: string[]
}

export async function upsertElu(input: EluInput) {
  try {
    const { establishmentId } = await requirePermission('manage_establishment')
    const supabase = await createClient()
    const payload = { ...input, establishment_id: establishmentId }
    const { data, error } = input.id
      ? await supabase.from('elus').update(payload).eq('id', input.id).eq('establishment_id', establishmentId).select().single()
      : await supabase.from('elus').insert(payload).select().single()
    if (error) return { error: error.message }
    logActivity({
      action: input.id ? 'update' : 'create',
      entityType: 'elu',
      entityId: data.id,
      entityName: `${input.first_name} ${input.last_name}`,
      details: { role: input.role, collectivity: input.collectivity_name },
    })
    revalidatePath('/astreinte/elus')
    return { data: data as Elu }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function deleteElu(id: string) {
  try {
    const { establishmentId } = await requirePermission('manage_establishment')
    const supabase = await createClient()
    const { data: existing } = await createAdminClient()
      .from('elus').select('first_name, last_name').eq('id', id).eq('establishment_id', establishmentId).single()
    const { error } = await supabase.from('elus').delete().eq('id', id).eq('establishment_id', establishmentId)
    if (error) return { error: error.message }
    if (existing) {
      logActivity({
        action: 'delete',
        entityType: 'elu',
        entityId: id,
        entityName: `${existing.first_name} ${existing.last_name}`,
      })
    }
    revalidatePath('/astreinte/elus')
    return { data: { ok: true } }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/**
 * Construit la salutation à utiliser pour cet élu selon son tone_variant.
 * Réutilisable côté client (mailto:) ou serveur (envoi auto futur).
 */
export function buildGreeting(elu: Pick<Elu, 'tone_variant' | 'first_name' | 'last_name' | 'civility'>): string {
  switch (elu.tone_variant) {
    case 'tu-prenom':
      return `Bonjour ${elu.first_name},`
    case 'vous-prenom':
      return `Bonjour ${elu.first_name},`
    case 'vous-nom':
      return `${elu.civility || 'Monsieur'} ${elu.last_name},`
    case 'institutionnel':
    default:
      return 'Madame, Monsieur,'
  }
}

/**
 * Met à jour `last_contact_at` (appelé après envoi mail ou appel logué).
 */
export async function markEluContacted(id: string) {
  try {
    const { establishmentId } = await requirePermission('manage_establishment')
    const supabase = await createClient()
    const { error } = await supabase
      .from('elus')
      .update({ last_contact_at: new Date().toISOString() })
      .eq('id', id)
      .eq('establishment_id', establishmentId)
    if (error) return { error: error.message }
    revalidatePath('/astreinte/elus')
    return { data: { ok: true } }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
