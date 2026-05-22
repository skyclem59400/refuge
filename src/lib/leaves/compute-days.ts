/**
 * Calcul du nombre de jours de congé décomptés du solde.
 *
 * Règle métier (droit du travail français, art. L3141-5) :
 *   - Un jour férié chômé tombant pendant un congé n'est PAS décompté du solde.
 *   - Un jour de repos hebdomadaire (selon la semaine type du salarié) n'est pas
 *     décompté non plus — sinon on consommerait des CP pour un dimanche par exemple.
 *
 * Conséquence : pour une semaine de congé du lundi 4 au samedi 9 mai 2026 (6 jours
 * calendaires), pour un salarié travaillant lun→ven sans jour de repos sup., on
 * décompte 4 jours (lun 4, mar 5, mer 6, jeu 7) car le ven 8 mai est férié (Victoire
 * 1945) et le sam 9 est jour de repos hebdo.
 *
 * Les demi-journées (`halfDayStart` / `halfDayEnd`) déduisent 0.5 chacune, à
 * condition que le jour concerné soit effectivement comptabilisé (pas férié et
 * pas jour de repos).
 */

export interface ComputeLeaveDaysParams {
  /** Date début, format 'YYYY-MM-DD' inclus */
  startDate: string
  /** Date fin, format 'YYYY-MM-DD' inclus */
  endDate: string
  /**
   * Jours de la semaine considérés en repos hebdo pour ce membre.
   * Format : 0=dimanche, 1=lundi, ..., 6=samedi (cohérent avec `Date.getDay()`).
   * Fallback raisonnable si non fourni : `[0, 6]` (week-end standard).
   */
  restWeekdays: number[]
  /**
   * Liste des dates fériées (chômées) à exclure, format 'YYYY-MM-DD'.
   * Ces dates ne sont pas décomptées du solde même si elles tombent un jour
   * normalement travaillé.
   */
  holidays: string[]
  /** Premier jour en demi-journée (matin OFF / après-midi OFF selon convention) */
  halfDayStart?: boolean
  /** Dernier jour en demi-journée */
  halfDayEnd?: boolean
}

/**
 * Retourne le nombre de jours à décompter du solde de CP.
 * Toujours >= 0, en demi-journée (multiple de 0.5).
 */
export function computeLeaveDays(params: ComputeLeaveDaysParams): number {
  const { startDate, endDate, restWeekdays, holidays, halfDayStart, halfDayEnd } = params

  if (!startDate || !endDate || startDate > endDate) return 0

  const restSet = new Set(restWeekdays)
  const holidaySet = new Set(holidays)

  // On itère en UTC pour éviter les sauts d'heure d'été (DST) qui pourraient
  // décaler les jours sur une période traversant mars/octobre.
  const [sy, sm, sd] = startDate.split('-').map(Number)
  const [ey, em, ed] = endDate.split('-').map(Number)
  const start = Date.UTC(sy, sm - 1, sd)
  const end = Date.UTC(ey, em - 1, ed)

  let count = 0
  let firstCountedISO: string | null = null
  let lastCountedISO: string | null = null

  for (let t = start; t <= end; t += 86_400_000) {
    const d = new Date(t)
    const iso = d.toISOString().slice(0, 10)
    const weekday = d.getUTCDay()

    if (holidaySet.has(iso)) continue          // Férié : non décompté
    if (restSet.has(weekday)) continue          // Repos hebdo : non décompté

    count += 1
    if (firstCountedISO === null) firstCountedISO = iso
    lastCountedISO = iso
  }

  // Demi-journées : déduction de 0.5 si la borne concernée a effectivement été
  // comptabilisée (un halfDayStart sur un dimanche/férié n'aurait aucun sens).
  if (startDate === endDate) {
    // Mono-jour : au plus une demi-déduction (priorité halfDayStart pour ne pas cumuler à 0)
    if ((halfDayStart || halfDayEnd) && firstCountedISO === startDate) count -= 0.5
  } else {
    if (halfDayStart && firstCountedISO === startDate) count -= 0.5
    if (halfDayEnd && lastCountedISO === endDate) count -= 0.5
  }

  return Math.max(0, count)
}
