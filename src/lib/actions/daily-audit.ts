'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { detectAnimalInconsistencies, type AnimalInconsistency } from '@/lib/audit/animal-consistency'

/**
 * Audit quotidien — agrege l'activite de la veille (J-1) pour generer
 * un rapport PDF a destination de la direction SDA.
 *
 * Source de verite : multiples tables (activity_logs, animal_health_records,
 * animal_outings, animal_movements, cra_monthly_status, animals, etc.).
 *
 * Periode auditee :
 *   - "Hier" (J-1) pour les actions ponctuelles (saisies)
 *   - "Maintenant" pour les etats (rappels en retard, procedures incompletes)
 *   - "Mois courant" + "Mois precedent" pour le CRA
 *
 * Ne renvoie pas d'erreur, retourne plutot des sections vides si donnees
 * manquantes (l'audit doit toujours produire un PDF).
 */

interface AuditContributor {
  userId: string
  name: string
  actions: number
}

interface AuditCriticalItem {
  level: 'critical' | 'warning'
  category: string
  label: string
  detail?: string
}

interface AuditHealthRow {
  animalName: string
  type: string
  description: string
  byName: string | null
  cost: number | null
}

interface AuditOverdueReminder {
  animalName: string
  type: string
  dueDate: string
  daysLate: number
}

interface AuditOutingRow {
  animalName: string
  walkedBy: string
  durationMinutes: number | null
  rating: number | null
}

interface AuditCraGap {
  memberName: string
  monthLabel: string
  status: string
  missingDays?: number
}

interface AuditAnimalGap {
  animalName: string
  status: string
  missing: string[]
}

interface AuditJudicialGap {
  animalName: string
  missing: string[]
  hearingDate: string | null
  daysToHearing: number | null
}

export interface AuditSuspiciousChange {
  byName: string | null
  action: string
  entityType: string
  entityName: string | null
  reason: string
  oldValue: string
  newValue: string
  at: string
}

export interface DailyAuditSection {
  establishmentId: string
  establishmentName: string
  /** Date auditee (J-1) au format YYYY-MM-DD */
  auditDate: string
  /** Date du run au format ISO */
  generatedAt: string

  // Critiques (haut du rapport, rouge)
  critical: AuditCriticalItem[]

  // Engagement
  topContributors: AuditContributor[]
  inactiveMembers: { name: string }[]
  totalActionsYesterday: number

  // Soins
  healthSaved: AuditHealthRow[]
  overdueReminders: AuditOverdueReminder[]

  // Sorties
  outingsSaved: AuditOutingRow[]
  outingsWithoutRating: AuditOutingRow[]

  // CRA
  craGaps: AuditCraGap[]

  // Dossiers animaux
  animalsToReview: AuditAnimalGap[]

  // Procedures judiciaires
  judicialIncomplete: AuditJudicialGap[]

  // Changements suspects detectes dans les activity_logs hier
  suspiciousChanges: AuditSuspiciousChange[]

  // Incoherences detectees sur les fiches animales
  animalInconsistencies: AnimalInconsistency[]

  // Score
  scoreOutOf100: number
}

const TYPE_LABELS: Record<string, string> = {
  vaccination: 'Vaccination',
  sterilization: 'Stérilisation',
  antiparasitic: 'Antiparasitaire',
  consultation: 'Consultation',
  surgery: 'Chirurgie',
  medication: 'Médication',
  behavioral_assessment: 'Bilan comportemental',
  identification: 'Identification',
  radio: 'Radiographie',
  blood_test: 'Analyses sanguines',
  cession: 'Cession',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon (Mary saisit)',
  submitted: 'Soumis collab',
  validated_by_member: 'Validé collab',
  change_requested: 'Modification demandée',
  validated_by_admin: 'Validé admin',
  sent: 'Envoyé',
}

const MONTH_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

function yesterdayBoundsParis(reference: Date = new Date()): { startISO: string; endISO: string; isoDate: string } {
  // On considere "hier" en heure Paris. Pour rester simple, on prend 00:00:00 UTC.
  const ref = new Date(reference)
  ref.setUTCHours(0, 0, 0, 0)
  const start = new Date(ref)
  start.setUTCDate(start.getUTCDate() - 1)
  const end = new Date(ref)
  return {
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    isoDate: start.toISOString().slice(0, 10),
  }
}

function daysBetween(isoA: string, isoB: string): number {
  const a = new Date(isoA).getTime()
  const b = new Date(isoB).getTime()
  return Math.round((b - a) / (1000 * 60 * 60 * 24))
}

export async function computeDailyAuditForEstablishment(
  establishmentId: string,
  establishmentName: string,
): Promise<DailyAuditSection> {
  const admin = createAdminClient()
  const { startISO, endISO, isoDate } = yesterdayBoundsParis()
  const today = new Date().toISOString().slice(0, 10)

  // 1. Activity logs hier (engagement + detection d'incoherences)
  const { data: activityRaw } = await admin
    .from('activity_logs')
    .select('user_id, action, entity_type, entity_id, entity_name, details, created_at')
    .eq('establishment_id', establishmentId)
    .gte('created_at', startISO)
    .lt('created_at', endISO)

  const activityList = (activityRaw || []) as Array<{
    user_id: string | null
    action: string
    entity_type: string
    entity_id: string | null
    entity_name: string | null
    details: Record<string, unknown> | null
    created_at: string
  }>
  const totalActionsYesterday = activityList.length

  const actionsByUser = new Map<string, number>()
  for (const a of activityList) {
    if (a.user_id) {
      actionsByUser.set(a.user_id, (actionsByUser.get(a.user_id) || 0) + 1)
    }
  }

  // 2. Membres actifs de l'etablissement (pour resoudre noms + detecter inactifs)
  const { data: membersRaw } = await admin
    .from('establishment_members')
    .select('id, user_id, pseudo, contract_type, availability_status')
    .eq('establishment_id', establishmentId)

  const members = (membersRaw || []) as Array<{
    id: string
    user_id: string | null
    pseudo: string | null
    contract_type: string
    availability_status: string
  }>

  // Resoudre les noms via get_users_info
  const userIds = members.map((m) => m.user_id).filter((v): v is string => !!v)
  const namesMap = new Map<string, string>()
  if (userIds.length > 0) {
    const { data: usersInfo } = await admin.rpc('get_users_info', { user_ids: userIds })
    for (const u of (usersInfo || []) as Array<{ id: string; full_name: string | null; email: string | null }>) {
      namesMap.set(u.id, u.full_name || u.email || u.id.slice(0, 8))
    }
  }

  function memberDisplayName(userId: string | null, pseudo: string | null): string {
    if (userId && namesMap.has(userId)) return namesMap.get(userId)!
    return pseudo || 'Inconnu'
  }

  const topContributors: AuditContributor[] = Array.from(actionsByUser.entries())
    .map(([uid, n]) => ({
      userId: uid,
      name: namesMap.get(uid) || uid.slice(0, 8),
      actions: n,
    }))
    .sort((a, b) => b.actions - a.actions)
    .slice(0, 5)

  const inactiveMembers = members
    .filter((m) => m.availability_status === 'active' && m.contract_type === 'salarie')
    .filter((m) => !m.user_id || !actionsByUser.has(m.user_id))
    .map((m) => ({ name: memberDisplayName(m.user_id, m.pseudo) }))

  // 3. Soins saisis hier
  const { data: healthSavedRaw } = await admin
    .from('animal_health_records')
    .select('animal_id, type, description, cost, created_by, animals(name)')
    .eq('establishment_id', establishmentId)
    .gte('created_at', startISO)
    .lt('created_at', endISO)
    .limit(200)

  const healthSaved: AuditHealthRow[] = ((healthSavedRaw || []) as unknown as Array<{
    animals: { name: string } | null
    type: string
    description: string | null
    cost: number | null
    created_by: string | null
  }>).map((h) => ({
    animalName: h.animals?.name || '—',
    type: TYPE_LABELS[h.type] || h.type,
    description: (h.description || '').slice(0, 60),
    byName: h.created_by ? namesMap.get(h.created_by) || null : null,
    cost: h.cost,
  }))

  // 4. Rappels en retard (next_due_date < today, sans completion ulterieure)
  const { data: overdueRaw } = await admin
    .from('animal_health_records')
    .select('animal_id, type, next_due_date, animals(name, status)')
    .eq('establishment_id', establishmentId)
    .not('next_due_date', 'is', null)
    .lt('next_due_date', today)
    .limit(200)

  // Filtrer : on garde uniquement si l'animal est encore en charge (shelter/foster/pound/boarding)
  // ET si aucun acte du meme type n'a ete saisi apres next_due_date pour ce meme animal
  const overdueCandidates = (overdueRaw || []) as unknown as Array<{
    animal_id: string
    type: string
    next_due_date: string
    animals: { name: string; status: string } | null
  }>
  const presentStatuses = new Set(['shelter', 'pound', 'boarding', 'foster_family'])

  const overdueReminders: AuditOverdueReminder[] = []
  for (const r of overdueCandidates) {
    if (!r.animals || !presentStatuses.has(r.animals.status)) continue
    // Verifie si un acte du meme type a deja ete fait apres next_due_date
    const { count } = await admin
      .from('animal_health_records')
      .select('id', { count: 'exact', head: true })
      .eq('animal_id', r.animal_id)
      .eq('type', r.type)
      .gte('date', r.next_due_date)
    if ((count ?? 0) > 0) continue
    overdueReminders.push({
      animalName: r.animals.name,
      type: TYPE_LABELS[r.type] || r.type,
      dueDate: r.next_due_date,
      daysLate: daysBetween(r.next_due_date, today),
    })
  }
  overdueReminders.sort((a, b) => b.daysLate - a.daysLate)

  // 5. Sorties saisies hier
  const { data: outingsRaw } = await admin
    .from('animal_outings')
    .select('animal_id, walked_by, duration_minutes, rating, animals!inner(name, establishment_id)')
    .gte('created_at', startISO)
    .lt('created_at', endISO)
    .eq('animals.establishment_id', establishmentId)
    .limit(100)

  const outingsSaved: AuditOutingRow[] = ((outingsRaw || []) as unknown as Array<{
    animals: { name: string } | null
    walked_by: string
    duration_minutes: number | null
    rating: number | null
  }>).map((o) => ({
    animalName: o.animals?.name || '—',
    walkedBy: o.walked_by,
    durationMinutes: o.duration_minutes,
    rating: o.rating,
  }))

  // Sorties retournees sans rating (toutes les sorties terminees depuis 7j)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoISO = sevenDaysAgo.toISOString()
  const { data: noRatingRaw } = await admin
    .from('animal_outings')
    .select('animal_id, walked_by, duration_minutes, rating, animals!inner(name, establishment_id)')
    .is('rating', null)
    .not('ended_at', 'is', null)
    .gte('ended_at', sevenDaysAgoISO)
    .eq('animals.establishment_id', establishmentId)
    .limit(50)

  const outingsWithoutRating: AuditOutingRow[] = ((noRatingRaw || []) as unknown as Array<{
    animals: { name: string } | null
    walked_by: string
    duration_minutes: number | null
    rating: number | null
  }>).map((o) => ({
    animalName: o.animals?.name || '—',
    walkedBy: o.walked_by,
    durationMinutes: o.duration_minutes,
    rating: null,
  }))

  // 6. CRA : mois precedent non envoye
  const now = new Date()
  const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth()
  const prevMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const { data: craRaw } = await admin
    .from('cra_monthly_status')
    .select('member_id, status, year, month, establishment_members!inner(pseudo, user_id, contract_type)')
    .eq('year', prevMonthYear)
    .eq('month', prevMonth)
    .neq('status', 'sent')
    .eq('establishment_members.establishment_id', establishmentId)
    .limit(50)

  const craGaps: AuditCraGap[] = ((craRaw || []) as unknown as Array<{
    status: string
    year: number
    month: number
    establishment_members: { pseudo: string | null; user_id: string | null; contract_type: string } | null
  }>).map((c) => ({
    memberName: memberDisplayName(
      c.establishment_members?.user_id ?? null,
      c.establishment_members?.pseudo ?? null,
    ),
    monthLabel: `${MONTH_FR[c.month - 1]} ${c.year}`,
    status: STATUS_LABELS[c.status] || c.status,
  }))

  // 7. Animaux a revoir (presents sans photo/desc/medaille)
  const { data: animalsRaw } = await admin
    .from('animals')
    .select('id, name, status, photo_url, description_external, medal_number, intake_date')
    .eq('establishment_id', establishmentId)
    .in('status', Array.from(presentStatuses))
    .limit(500)

  const animals = (animalsRaw || []) as Array<{
    id: string
    name: string
    status: string
    photo_url: string | null
    description_external: string | null
    medal_number: string | null
    intake_date: string | null
  }>

  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  const sixMonthsAgoISO = sixMonthsAgo.toISOString().slice(0, 10)

  const animalsToReview: AuditAnimalGap[] = []
  for (const a of animals) {
    const missing: string[] = []
    if (!a.photo_url) missing.push('photo')
    if (!a.description_external) missing.push('description publique')
    if (!a.medal_number) missing.push('n° médaille')
    if (a.intake_date && a.intake_date < sixMonthsAgoISO) {
      // Animal >6 mois — check si actualite news recente (<60j)
      const sixtyDaysAgo = new Date()
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)
      const { count: newsCount } = await admin
        .from('animal_news')
        .select('id', { count: 'exact', head: true })
        .eq('animal_id', a.id)
        .gte('posted_at', sixtyDaysAgo.toISOString())
      if ((newsCount ?? 0) === 0) missing.push('actu >60j')
    }
    if (missing.length > 0) {
      animalsToReview.push({ animalName: a.name, status: a.status, missing })
    }
  }
  animalsToReview.sort((a, b) => b.missing.length - a.missing.length)

  // 8. Procedures judiciaires incompletes
  const { data: judicialRaw } = await admin
    .from('animals')
    .select(`
      id, name, status,
      judicial_jurisdiction, judicial_seizure_date, judicial_dossier_number,
      judicial_owner_client_id, judicial_owner_name,
      judicial_hearing_date, judicial_decision_date,
      judicial_lawyer_name, judicial_lawyer_contact
    `)
    .eq('establishment_id', establishmentId)
    .eq('judicial_procedure', true)
    .in('status', Array.from(presentStatuses))
    .limit(100)

  const judicialIncomplete: AuditJudicialGap[] = []
  for (const a of (judicialRaw || []) as Array<{
    name: string
    judicial_jurisdiction: string | null
    judicial_seizure_date: string | null
    judicial_dossier_number: string | null
    judicial_owner_client_id: string | null
    judicial_owner_name: string | null
    judicial_hearing_date: string | null
    judicial_decision_date: string | null
    judicial_lawyer_name: string | null
    judicial_lawyer_contact: string | null
  }>) {
    const missing: string[] = []
    if (!a.judicial_jurisdiction) missing.push('juridiction')
    if (!a.judicial_seizure_date) missing.push('date saisie')
    if (!a.judicial_dossier_number) missing.push('n° dossier')
    if (!a.judicial_owner_client_id && !a.judicial_owner_name) missing.push('propriétaire mis en cause')
    if (!a.judicial_lawyer_name) missing.push('avocat')
    const daysToHearing = a.judicial_hearing_date
      ? daysBetween(today, a.judicial_hearing_date)
      : null
    if (missing.length > 0 || (daysToHearing !== null && daysToHearing >= 0 && daysToHearing <= 7)) {
      judicialIncomplete.push({
        animalName: a.name,
        missing,
        hearingDate: a.judicial_hearing_date,
        daysToHearing,
      })
    }
  }
  judicialIncomplete.sort((a, b) => {
    if (a.daysToHearing !== null && b.daysToHearing !== null) return a.daysToHearing - b.daysToHearing
    if (a.daysToHearing !== null) return -1
    if (b.daysToHearing !== null) return 1
    return b.missing.length - a.missing.length
  })

  // 8.bis Detection de changements suspects dans les activity_logs hier
  //
  // Heuristiques :
  //   - Animal birth_date : ecart > 365 jours entre old et new = suspect
  //     (cas reel : adoption en fourriere d'un chien estime 2 ans, modifie
  //     plus tard pour devenir "8 jours" — donne un age incoherent)
  //   - Animal : suppression (entity_type=animal + action=delete)
  //   - Procedure judiciaire : modification des champs cle (saisie_date,
  //     hearing_date, jurisdiction, dossier_number) flagee pour relecture
  const suspiciousChanges: AuditSuspiciousChange[] = []
  const JUDICIAL_FIELDS = new Set([
    'judicial_jurisdiction',
    'judicial_seizure_date',
    'judicial_dossier_number',
    'judicial_hearing_date',
    'judicial_decision_date',
    'judicial_lawyer_name',
    'judicial_owner_client_id',
    'judicial_owner_name',
  ])

  function asChangeObj(v: unknown): { old: unknown; new: unknown } | null {
    if (v && typeof v === 'object' && 'old' in v && 'new' in v) {
      return v as { old: unknown; new: unknown }
    }
    return null
  }

  function fmt(v: unknown): string {
    if (v === null || v === undefined) return '∅'
    return String(v)
  }

  for (const a of activityList) {
    const by = a.user_id ? namesMap.get(a.user_id) || null : null

    // Suppression d'animal
    if (a.entity_type === 'animal' && a.action === 'delete') {
      suspiciousChanges.push({
        byName: by,
        action: a.action,
        entityType: a.entity_type,
        entityName: a.entity_name,
        reason: 'Suppression d\'un animal',
        oldValue: a.entity_name ?? '—',
        newValue: '∅',
        at: a.created_at,
      })
      continue
    }

    if (!a.details || a.action !== 'update') continue

    // Animal: date de naissance incoherente
    if (a.entity_type === 'animal') {
      const bdChange = asChangeObj(a.details.birth_date)
      if (bdChange) {
        const oldDate = typeof bdChange.old === 'string' ? bdChange.old : null
        const newDate = typeof bdChange.new === 'string' ? bdChange.new : null
        if (oldDate && newDate) {
          const diffDays = Math.abs(daysBetween(oldDate, newDate))
          if (diffDays > 365) {
            suspiciousChanges.push({
              byName: by,
              action: a.action,
              entityType: a.entity_type,
              entityName: a.entity_name,
              reason: `Date de naissance modifiée de ${diffDays} jours (>365)`,
              oldValue: oldDate,
              newValue: newDate,
              at: a.created_at,
            })
          }
        }
      }

      // Procedure judiciaire : champs cles touches
      for (const field of Object.keys(a.details)) {
        if (!JUDICIAL_FIELDS.has(field)) continue
        const ch = asChangeObj(a.details[field])
        if (!ch) continue
        suspiciousChanges.push({
          byName: by,
          action: a.action,
          entityType: a.entity_type,
          entityName: a.entity_name,
          reason: `Procédure judiciaire — champ ${field} modifié`,
          oldValue: fmt(ch.old),
          newValue: fmt(ch.new),
          at: a.created_at,
        })
      }
    }
  }

  // 9. Critiques (en haut du rapport, rouge)
  const critical: AuditCriticalItem[] = []
  for (const j of judicialIncomplete) {
    if (j.daysToHearing !== null && j.daysToHearing >= 0 && j.daysToHearing <= 3) {
      critical.push({
        level: 'critical',
        category: 'Procédure judiciaire',
        label: `Audience dans ${j.daysToHearing}j — ${j.animalName}`,
        detail: j.missing.length > 0 ? `Manque : ${j.missing.join(', ')}` : 'Dossier complet, vérifier prep',
      })
    }
  }
  for (const r of overdueReminders) {
    if (r.daysLate > 30) {
      critical.push({
        level: 'critical',
        category: 'Santé',
        label: `${r.type} — ${r.animalName}`,
        detail: `En retard de ${r.daysLate} jours`,
      })
    }
  }
  for (const c of craGaps) {
    if (now.getDate() > 10) {
      critical.push({
        level: 'warning',
        category: 'CRA',
        label: `${c.memberName} — ${c.monthLabel}`,
        detail: `Statut : ${c.status}`,
      })
    }
  }

  // Changements suspects : promus en critique si presents
  for (const s of suspiciousChanges) {
    critical.push({
      level: 'warning',
      category: 'Incohérence',
      label: `${s.entityName ?? '—'} — ${s.reason}`,
      detail: `${s.byName ?? 'Inconnu'} : ${s.oldValue} → ${s.newValue}`,
    })
  }

  // 8.ter Incoherences sur les fiches animales (regles metier statiques)
  const animalInconsistencies = await detectAnimalInconsistencies(establishmentId)
  for (const inc of animalInconsistencies) {
    if (inc.severity === 'critical') {
      critical.push({
        level: 'critical',
        category: 'Fiche animale',
        label: `${inc.animalName} — ${inc.rule}`,
        detail: inc.detail,
      })
    } else if (inc.severity === 'warning') {
      critical.push({
        level: 'warning',
        category: 'Fiche animale',
        label: `${inc.animalName} — ${inc.rule}`,
        detail: inc.detail,
      })
    }
  }

  // 10. Score /100 — simple heuristic
  let score = 100
  score -= critical.filter((c) => c.level === 'critical').length * 10
  score -= overdueReminders.length * 2
  score -= judicialIncomplete.filter((j) => j.missing.length > 0).length * 3
  score -= craGaps.length * 5
  score -= animalsToReview.length * 1
  score -= inactiveMembers.length * 3
  score -= suspiciousChanges.length * 4
  score -= animalInconsistencies.filter((i) => i.severity === 'critical').length * 5
  score -= animalInconsistencies.filter((i) => i.severity === 'warning').length * 2
  score = Math.max(0, Math.min(100, score))

  return {
    establishmentId,
    establishmentName,
    auditDate: isoDate,
    generatedAt: new Date().toISOString(),
    critical,
    topContributors,
    inactiveMembers,
    totalActionsYesterday,
    healthSaved,
    overdueReminders,
    outingsSaved,
    outingsWithoutRating,
    craGaps,
    animalsToReview: animalsToReview.slice(0, 15),
    judicialIncomplete,
    suspiciousChanges,
    animalInconsistencies,
    scoreOutOf100: score,
  }
}

export async function computeDailyAudit(
  establishmentIds?: string[],
): Promise<DailyAuditSection[]> {
  const admin = createAdminClient()
  let query = admin.from('establishments').select('id, name').order('name')
  if (establishmentIds && establishmentIds.length > 0) {
    query = query.in('id', establishmentIds)
  }
  const { data: estabsRaw } = await query
  const estabs = (estabsRaw || []) as Array<{ id: string; name: string }>
  const sections: DailyAuditSection[] = []
  for (const e of estabs) {
    sections.push(await computeDailyAuditForEstablishment(e.id, e.name))
  }
  return sections
}
