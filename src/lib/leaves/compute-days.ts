/**
 * Calcul du nombre de jours de congé décomptés du solde.
 *
 * Helper pur et générique — l'appelant choisit la convention en passant la
 * liste des jours non-ouvrables (`restWeekdays`). Cas SDA : convention
 * fleuristes-animalerie (IDCC 1978) → mode "jours ouvrables" = `restWeekdays = [0]`
 * (seul le dimanche est non-ouvrable, le mercredi est décompté même s'il
 * s'agit du jour de repos hebdo personnel du salarié).
 *
 * Règle métier (Code du travail, art. L3141-5 et jurisprudence) :
 *   - Un jour férié chômé tombant pendant un congé n'est PAS décompté du solde.
 *   - Les jours indiqués dans `restWeekdays` (dim seul en ouvrable, sam+dim
 *     en ouvré) ne sont pas non plus décomptés.
 *
 * Conséquence en mode ouvrable (SDA), semaine du lun 4 au sam 9 mai 2026 :
 *   - Jours ouvrables : lun 4, mar 5, mer 6, jeu 7, sam 9 = 5 jours
 *   - Ven 8 (férié Victoire 1945) : non décompté
 *   - Dim 10 : non concerné (hors plage)
 *   Total : 5 jours décomptés (peu importe que mer soit le repos du salarié).
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
   * Jours de la semaine NON-ouvrables / non-décomptés du solde.
   * Format : 0=dimanche, 1=lundi, ..., 6=samedi (cohérent avec `Date.getDay()`).
   *   - Mode "jours ouvrables" (CCN fleuristes, défaut SDA) : `[0]` (dim seul)
   *   - Mode "jours ouvrés" (5j/sem) : `[0, 6]` (sam + dim)
   *   - Cas temps partiel atypique : passer les jours non travaillés du salarié
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
