'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/establishment/permissions'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/actions/activity-log'
import type { SatisfactionSurvey, SatisfactionSurveyKind } from '@/lib/types/database'

/**
 * Actions de gestion des enquêtes de satisfaction NPS.
 *
 * - getSurveyByToken : page publique, lookup par token (pas d'auth requise)
 * - submitSurveyResponse : page publique, enregistre nps_score + verbatim
 * - listSurveys / getSurveyStats / resolveSurvey : dashboard admin
 */

/** Retourne une survey par son token public (pour la page de réponse) */
export async function getSurveyByToken(token: string): Promise<{
  data?: SatisfactionSurvey
  error?: string
}> {
  if (!token || token.length < 8) return { error: 'Lien invalide' }
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('satisfaction_surveys')
    .select('*')
    .eq('token', token)
    .maybeSingle()
  if (error) return { error: error.message }
  if (!data) return { error: 'Lien introuvable ou expiré' }
  return { data: data as SatisfactionSurvey }
}

/** Soumission publique du formulaire (auth = token, pas user) */
export async function submitSurveyResponse(params: {
  token: string
  npsScore: number
  verbatim: string
}): Promise<{ success?: true; error?: string }> {
  try {
    const { token, npsScore, verbatim } = params
    if (!token) return { error: 'Lien invalide' }
    if (typeof npsScore !== 'number' || npsScore < 0 || npsScore > 10 || !Number.isInteger(npsScore)) {
      return { error: 'Note invalide (attendu : entier entre 0 et 10)' }
    }
    const trimmedVerbatim = (verbatim || '').trim()

    const admin = createAdminClient()
    const { data: existing, error: fetchErr } = await admin
      .from('satisfaction_surveys')
      .select('id, completed_at')
      .eq('token', token)
      .single()
    if (fetchErr || !existing) return { error: 'Lien introuvable' }
    if (existing.completed_at) return { error: 'Cette enquête a déjà été remplie. Merci !' }

    const { error: updErr } = await admin
      .from('satisfaction_surveys')
      .update({
        nps_score: npsScore,
        verbatim: trimmedVerbatim || null,
        completed_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
    if (updErr) return { error: updErr.message }

    revalidatePath('/admin/satisfaction')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/** Liste paginée des surveys (dashboard admin) */
export async function listSurveys(filters?: {
  kind?: SatisfactionSurveyKind
  completed?: boolean
  unresolved?: boolean
  limit?: number
}): Promise<{ data?: SatisfactionSurvey[]; error?: string }> {
  try {
    const { establishmentId } = await requirePermission('manage_establishment')
    const admin = createAdminClient()

    let q = admin
      .from('satisfaction_surveys')
      .select('*')
      .eq('establishment_id', establishmentId)

    if (filters?.kind) q = q.eq('kind', filters.kind)
    if (filters?.completed === true) q = q.not('completed_at', 'is', null)
    if (filters?.completed === false) q = q.is('completed_at', null)
    if (filters?.unresolved === true) {
      q = q.not('completed_at', 'is', null).is('resolved_at', null)
    }

    q = q.order('completed_at', { ascending: false, nullsFirst: false })
      .order('scheduled_for', { ascending: false })
      .limit(filters?.limit || 200)

    const { data, error } = await q
    if (error) return { error: error.message }
    return { data: (data || []) as SatisfactionSurvey[] }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/** Statistiques globales pour le dashboard */
export async function getSurveyStats(filters?: {
  kind?: SatisfactionSurveyKind
  sinceDays?: number
}): Promise<{
  data?: {
    total_completed: number
    total_sent: number
    nps: number | null
    promoter_pct: number
    passive_pct: number
    detractor_pct: number
    avg_score: number | null
  }
  error?: string
}> {
  try {
    const { establishmentId } = await requirePermission('manage_establishment')
    const admin = createAdminClient()

    let q = admin
      .from('satisfaction_surveys')
      .select('nps_score, completed_at, sent_at')
      .eq('establishment_id', establishmentId)

    if (filters?.kind) q = q.eq('kind', filters.kind)
    if (filters?.sinceDays) {
      const since = new Date(Date.now() - filters.sinceDays * 86_400_000).toISOString()
      q = q.gte('created_at', since)
    }

    const { data, error } = await q
    if (error) return { error: error.message }

    const rows = (data || []) as Array<{ nps_score: number | null; completed_at: string | null; sent_at: string | null }>
    const sent = rows.filter((r) => r.sent_at !== null)
    const completed = rows.filter((r) => r.completed_at !== null && r.nps_score !== null)

    if (completed.length === 0) {
      return {
        data: {
          total_completed: 0,
          total_sent: sent.length,
          nps: null,
          promoter_pct: 0,
          passive_pct: 0,
          detractor_pct: 0,
          avg_score: null,
        },
      }
    }

    let promoters = 0, passives = 0, detractors = 0, sum = 0
    for (const r of completed) {
      const s = r.nps_score as number
      sum += s
      if (s >= 9) promoters += 1
      else if (s >= 7) passives += 1
      else detractors += 1
    }
    const n = completed.length
    const promoterPct = (promoters / n) * 100
    const passivePct = (passives / n) * 100
    const detractorPct = (detractors / n) * 100
    const nps = Math.round(promoterPct - detractorPct)
    const avg = sum / n

    return {
      data: {
        total_completed: n,
        total_sent: sent.length,
        nps,
        promoter_pct: Math.round(promoterPct * 10) / 10,
        passive_pct: Math.round(passivePct * 10) / 10,
        detractor_pct: Math.round(detractorPct * 10) / 10,
        avg_score: Math.round(avg * 10) / 10,
      },
    }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/** Marque une réponse comme "traitée" par l'admin */
export async function resolveSurvey(
  surveyId: string,
  notes?: string
): Promise<{ success?: true; error?: string }> {
  try {
    const { establishmentId } = await requirePermission('manage_establishment')
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const admin = createAdminClient()

    const { error } = await admin
      .from('satisfaction_surveys')
      .update({
        resolved_at: new Date().toISOString(),
        resolved_by: user?.id || null,
        resolution_notes: notes?.trim() || null,
      })
      .eq('id', surveyId)
      .eq('establishment_id', establishmentId)

    if (error) return { error: error.message }

    revalidatePath('/admin/satisfaction')
    logActivity({
      action: 'update',
      entityType: 'satisfaction_survey',
      entityId: surveyId,
      details: { resolved: true },
    })

    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/** Annule la résolution (re-ouvre le ticket) */
export async function unresolveSurvey(surveyId: string): Promise<{ success?: true; error?: string }> {
  try {
    const { establishmentId } = await requirePermission('manage_establishment')
    const admin = createAdminClient()
    const { error } = await admin
      .from('satisfaction_surveys')
      .update({ resolved_at: null, resolved_by: null, resolution_notes: null })
      .eq('id', surveyId)
      .eq('establishment_id', establishmentId)
    if (error) return { error: error.message }
    revalidatePath('/admin/satisfaction')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
