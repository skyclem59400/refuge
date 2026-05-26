'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/establishment/permissions'
import { logActivity } from '@/lib/actions/activity-log'
import type { CraAstreinte, CraAstreinteWithMember } from '@/lib/types/database'

/**
 * Server actions des astreintes hebdomadaires (lundi → lundi).
 *
 * Règles :
 *   - Une seule personne d'astreinte par semaine et par établissement (UNIQUE en DB).
 *   - Le forfait est calculé par le comptable, on ne stocke pas de montant.
 *   - La semaine d'astreinte est rattachée au CRA du mois contenant son lundi.
 *   - Le toggle suit la même règle que upsertCraEntry : permission manage_leaves.
 */

/** Retourne le lundi (00:00 UTC) de la semaine ISO contenant la date passée */
function mondayOf(dateISO: string): string {
  // dateISO est 'YYYY-MM-DD' — on évite les soucis de fuseau en travaillant en UTC
  const [y, m, d] = dateISO.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const dow = dt.getUTCDay() // 0=Dim, 1=Lun, ..., 6=Sam
  const offset = dow === 0 ? -6 : 1 - dow
  dt.setUTCDate(dt.getUTCDate() + offset)
  return dt.toISOString().slice(0, 10)
}

/**
 * Liste les astreintes d'un mois (toutes personnes confondues) pour la vue admin.
 * Une semaine compte si son lundi est dans le mois year/month.
 */
export async function listAstreintesForMonth(
  year: number,
  month: number
): Promise<{ data?: CraAstreinteWithMember[]; error?: string }> {
  try {
    const { establishmentId } = await requirePermission('manage_leaves')
    const admin = createAdminClient()

    const startISO = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = new Date(Date.UTC(year, month, 0))
    const endISO = endDate.toISOString().slice(0, 10)

    const { data, error } = await admin
      .from('cra_astreintes')
      .select('*')
      .eq('establishment_id', establishmentId)
      .gte('week_start_monday', startISO)
      .lte('week_start_monday', endISO)
      .order('week_start_monday')

    if (error) return { error: error.message }
    const list = (data || []) as CraAstreinte[]

    if (list.length === 0) return { data: [] }

    // Enrichissement noms
    const memberIds = Array.from(new Set(list.map((a) => a.member_id)))
    const { data: members } = await admin
      .from('establishment_members')
      .select('id, user_id, pseudo')
      .in('id', memberIds)

    const userIds = (members || []).map((m) => m.user_id).filter(Boolean) as string[]
    const namesByUserId = new Map<string, string>()
    if (userIds.length > 0) {
      const { data: usersInfo } = await admin.rpc('get_users_info', { user_ids: userIds })
      if (usersInfo && Array.isArray(usersInfo)) {
        for (const u of usersInfo) {
          if (u.full_name) namesByUserId.set(u.id, u.full_name)
        }
      }
    }

    const enriched: CraAstreinteWithMember[] = list.map((a) => {
      const m = (members || []).find((mm) => mm.id === a.member_id)
      return {
        ...a,
        member_name: m?.user_id ? namesByUserId.get(m.user_id) || null : null,
        member_pseudo: m?.pseudo || null,
      }
    })
    return { data: enriched }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/** Astreintes d'un membre sur un mois (pour le PDF / espace collab) */
export async function listMemberAstreintesForMonth(
  memberId: string,
  year: number,
  month: number
): Promise<{ data?: CraAstreinte[]; error?: string }> {
  try {
    const admin = createAdminClient()
    const startISO = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = new Date(Date.UTC(year, month, 0))
    const endISO = endDate.toISOString().slice(0, 10)

    const { data, error } = await admin
      .from('cra_astreintes')
      .select('*')
      .eq('member_id', memberId)
      .gte('week_start_monday', startISO)
      .lte('week_start_monday', endISO)
      .order('week_start_monday')

    if (error) return { error: error.message }
    return { data: (data || []) as CraAstreinte[] }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/**
 * Toggle l'astreinte d'un membre pour une semaine.
 * - Si une astreinte existe pour ce membre cette semaine → supprime
 * - Si une astreinte existe pour un AUTRE membre cette semaine → erreur (conflict)
 * - Sinon → crée
 *
 * Le `weekStartMonday` est normalisé via mondayOf() pour tolérer n'importe quelle date.
 */
export async function toggleAstreinteWeek(
  memberId: string,
  weekStartDate: string
): Promise<{ data?: { created: boolean; deleted: boolean }; error?: string }> {
  try {
    const { establishmentId } = await requirePermission('manage_leaves')
    const admin = createAdminClient()
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const weekMonday = mondayOf(weekStartDate)

    // Existe-t-il une astreinte pour cette semaine dans l'établissement ?
    const { data: existing } = await admin
      .from('cra_astreintes')
      .select('id, member_id')
      .eq('establishment_id', establishmentId)
      .eq('week_start_monday', weekMonday)
      .maybeSingle()

    if (existing) {
      if (existing.member_id !== memberId) {
        // Conflit : déjà attribuée à quelqu'un d'autre
        const { data: otherMember } = await admin
          .from('establishment_members')
          .select('pseudo, user_id')
          .eq('id', existing.member_id)
          .single()
        let otherName = otherMember?.pseudo || 'un autre collaborateur'
        if (otherMember?.user_id) {
          const { data: ui } = await admin.rpc('get_users_info', {
            user_ids: [otherMember.user_id],
          })
          if (ui && Array.isArray(ui) && ui[0]?.full_name) otherName = ui[0].full_name
        }
        return {
          error: `Semaine déjà attribuée à ${otherName}. Désactivez d'abord son astreinte.`,
        }
      }
      // Toggle off : supprime
      const { error } = await admin.from('cra_astreintes').delete().eq('id', existing.id)
      if (error) return { error: error.message }

      await logActivity({
        action: 'delete',
        entityType: 'cra_astreinte',
        entityId: existing.id,
        entityName: `Astreinte ${weekMonday}`,
        parentType: 'establishment_member',
        parentId: memberId,
        details: { week_start_monday: weekMonday },
      })

      return { data: { created: false, deleted: true } }
    }

    // Création
    const { data: created, error } = await admin
      .from('cra_astreintes')
      .insert({
        member_id: memberId,
        establishment_id: establishmentId,
        week_start_monday: weekMonday,
        created_by: user?.id || null,
      })
      .select('id')
      .single()
    if (error) return { error: error.message }

    await logActivity({
      action: 'create',
      entityType: 'cra_astreinte',
      entityId: created.id,
      entityName: `Astreinte ${weekMonday}`,
      parentType: 'establishment_member',
      parentId: memberId,
      details: { week_start_monday: weekMonday },
    })

    return { data: { created: true, deleted: false } }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
