// lib/health/vaccine-schedule.ts
//
// Règles métier des vaccins du refuge SDA Nord.
//
// Référence officielle (tableau Mary) :
//
//   Chien :
//     - PRIMO         CHPPI + Lepto + toux chenil  → rappel à +4 semaines
//     - RAPPEL MOIS   CHPPI                        → rappel à +365 jours
//     - RAPPEL ANNUEL CHPPI + Lepto + toux chenil  → rappel à +365 jours
//
//   Chat :
//     - PRIMO         RCP                          → rappel à +4 semaines
//     - RAPPEL MOIS   RCP                          → rappel à +365 jours
//     - RAPPEL ANNUEL RCP                          → rappel à +365 jours
//
// Quand un membre coche un de ces 6 actes sur une ligne de passage véto,
// un enregistrement animal_health_records est créé automatiquement avec
// la date du prochain rappel calculée selon ces règles.

/**
 * Clés vaccin reconnues sur vet_visit_lines.acts (JSONB).
 * Compatibles avec l'ancien `vaccin_chien` / `vaccin_chat` qui restent
 * acceptés en lecture mais ne déclenchent pas de calcul de rappel.
 */
export const VACCINE_ACT_KEYS = [
  'vaccin_chien_primo',
  'vaccin_chien_rappel_mois',
  'vaccin_chien_rappel_annuel',
  'vaccin_chat_primo',
  'vaccin_chat_rappel_mois',
  'vaccin_chat_rappel_annuel',
] as const

export type VaccineActKey = (typeof VACCINE_ACT_KEYS)[number]

export interface VaccineRule {
  /** Espèce concernée */
  species: 'dog' | 'cat'
  /** Stage du vaccin (primo / rappel mois / rappel annuel) */
  stage: 'primo' | 'rappel_mois' | 'rappel_annuel'
  /** Libellé court affiché dans l'UI de saisie */
  shortLabel: string
  /** Libellé long avec composition (ex: "CHPPI + Lepto + toux chenil") */
  longLabel: string
  /** Composition vaccinale */
  composition: string
  /** Délai en jours avant le prochain rappel */
  nextDueInDays: number
  /** Pastille couleur (Tailwind) pour la cellule du tableau passage véto */
  color: string
}

export const VACCINE_RULES: Record<VaccineActKey, VaccineRule> = {
  vaccin_chien_primo: {
    species: 'dog',
    stage: 'primo',
    shortLabel: 'Chien · Primo',
    longLabel: 'Chien — Primo CHPPI + Lepto + toux chenil',
    composition: 'CHPPI + Lepto + toux chenil',
    nextDueInDays: 28, // 4 semaines
    color: 'bg-yellow-200/50 text-yellow-800',
  },
  vaccin_chien_rappel_mois: {
    species: 'dog',
    stage: 'rappel_mois',
    shortLabel: 'Chien · Rappel mois',
    longLabel: 'Chien — Rappel mois CHPPI',
    composition: 'CHPPI',
    nextDueInDays: 365,
    color: 'bg-orange-200/50 text-orange-800',
  },
  vaccin_chien_rappel_annuel: {
    species: 'dog',
    stage: 'rappel_annuel',
    shortLabel: 'Chien · Rappel annuel',
    longLabel: 'Chien — Rappel annuel CHPPI + Lepto + toux chenil',
    composition: 'CHPPI + Lepto + toux chenil',
    nextDueInDays: 365,
    color: 'bg-purple-200/40 text-purple-800',
  },
  vaccin_chat_primo: {
    species: 'cat',
    stage: 'primo',
    shortLabel: 'Chat · Primo',
    longLabel: 'Chat — Primo RCP',
    composition: 'RCP',
    nextDueInDays: 28, // 4 semaines
    color: 'bg-lime-200/40 text-lime-800',
  },
  vaccin_chat_rappel_mois: {
    species: 'cat',
    stage: 'rappel_mois',
    shortLabel: 'Chat · Rappel mois',
    longLabel: 'Chat — Rappel mois RCP',
    composition: 'RCP',
    nextDueInDays: 365,
    color: 'bg-emerald-200/50 text-emerald-800',
  },
  vaccin_chat_rappel_annuel: {
    species: 'cat',
    stage: 'rappel_annuel',
    shortLabel: 'Chat · Rappel annuel',
    longLabel: 'Chat — Rappel annuel RCP',
    composition: 'RCP',
    nextDueInDays: 365,
    color: 'bg-green-200/50 text-green-800',
  },
}

/**
 * Type guard : true si la clé est un acte vaccin reconnu (parmi les 6
 * nouveaux types). Les anciens 'vaccin_chien' / 'vaccin_chat' simples
 * retournent false — pas de calcul de rappel possible sur eux.
 */
export function isVaccineActKey(key: string): key is VaccineActKey {
  return (VACCINE_ACT_KEYS as readonly string[]).includes(key)
}

/**
 * Calcule la date du prochain rappel pour un acte vaccin donné.
 * @param actKey - une des 6 VaccineActKey
 * @param visitDate - date de la visite véto (au format ISO YYYY-MM-DD)
 * @returns la date du prochain rappel au format ISO YYYY-MM-DD
 */
export function computeNextDueDate(
  actKey: VaccineActKey,
  visitDate: string,
): string {
  const rule = VACCINE_RULES[actKey]
  const d = new Date(visitDate)
  if (Number.isNaN(d.getTime())) {
    throw new Error(`computeNextDueDate: visitDate invalide "${visitDate}"`)
  }
  d.setDate(d.getDate() + rule.nextDueInDays)
  return d.toISOString().slice(0, 10)
}

/**
 * Extrait les VaccineActKey présentes (et true) dans un objet acts.
 * Utilisé par la server action de save d'une vet_visit_line.
 */
export function extractVaccineActs(
  acts: Record<string, unknown> | null | undefined,
): VaccineActKey[] {
  if (!acts) return []
  const out: VaccineActKey[] = []
  for (const key of VACCINE_ACT_KEYS) {
    if (acts[key] === true) out.push(key)
  }
  return out
}

/**
 * Statut d'un rappel à venir, utilisé pour le bandeau fiche animal.
 */
export type ReminderStatus = 'overdue' | 'due_soon' | 'upcoming'

/**
 * Calcule le statut d'un rappel selon la date prévue.
 *  - overdue   : la date est passée
 *  - due_soon  : la date est dans <= 30 jours
 *  - upcoming  : la date est dans > 30 jours
 */
export function getReminderStatus(
  nextDueDate: string,
  now: Date = new Date(),
): ReminderStatus {
  const due = new Date(nextDueDate)
  const diffMs = due.getTime() - now.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'overdue'
  if (diffDays <= 30) return 'due_soon'
  return 'upcoming'
}
