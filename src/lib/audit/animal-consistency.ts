import { createAdminClient } from '@/lib/supabase/server'

/**
 * Detection des incoherences metier sur les fiches animales.
 *
 * Chaque regle est un check SQL/TS pur qui ne necessite aucune inference IA.
 * Le but : pre-machiner pour le prompt IA et faire ressortir dans le PDF
 * les fiches a recroiser (par ex. un animal en procedure judiciaire taggue
 * "trouve / errant" — incoherence factuelle).
 */

export type InconsistencySeverity = 'critical' | 'warning' | 'info'

export interface AnimalInconsistency {
  animalId: string
  animalName: string
  status: string
  rule: string
  severity: InconsistencySeverity
  detail: string
}

const SHELTERED_STATUSES = new Set(['shelter', 'pound', 'boarding', 'foster_family'])
const TERMINAL_STATUSES = new Set(['adopted', 'returned', 'transferred', 'deceased', 'euthanized'])

interface AnimalRow {
  id: string
  name: string
  species: 'cat' | 'dog'
  sex: string
  birth_date: string | null
  status: string
  origin_type: string | null
  judicial_procedure: boolean
  chip_number: string | null
  tattoo_number: string | null
  medal_number: string | null
  sterilized: boolean
  adoptable: boolean
  box_id: string | null
  pound_entry_date: string | null
  shelter_entry_date: string | null
  exit_date: string | null
}

export async function detectAnimalInconsistencies(
  establishmentId: string,
): Promise<AnimalInconsistency[]> {
  const admin = createAdminClient()

  const { data } = await admin
    .from('animals')
    .select(`
      id, name, species, sex, birth_date, status, origin_type,
      judicial_procedure, chip_number, tattoo_number, medal_number,
      sterilized, adoptable, box_id,
      pound_entry_date, shelter_entry_date, exit_date
    `)
    .eq('establishment_id', establishmentId)
    .limit(2000)

  const animals = (data || []) as AnimalRow[]
  const results: AnimalInconsistency[] = []
  const today = new Date()
  const todayISO = today.toISOString().slice(0, 10)
  const thirtyYearsAgo = new Date(today)
  thirtyYearsAgo.setFullYear(thirtyYearsAgo.getFullYear() - 30)
  const thirtyYearsAgoISO = thirtyYearsAgo.toISOString().slice(0, 10)

  for (const a of animals) {
    // 1. Procedure judiciaire mais origine non "requisition"
    if (a.judicial_procedure && a.origin_type && a.origin_type !== 'requisition') {
      results.push({
        animalId: a.id,
        animalName: a.name,
        status: a.status,
        rule: 'Procédure judiciaire + origine ≠ réquisition',
        severity: 'critical',
        detail: `Animal en procédure judiciaire mais tagué « ${a.origin_type} ». Devrait être « requisition ».`,
      })
    }

    // 2. Procedure judiciaire sans origine renseignee
    if (a.judicial_procedure && !a.origin_type) {
      results.push({
        animalId: a.id,
        animalName: a.name,
        status: a.status,
        rule: 'Procédure judiciaire sans origine',
        severity: 'warning',
        detail: 'Animal en procédure judiciaire sans type d\'origine renseigné.',
      })
    }

    // 3. ICAD : animal heberge sans identification
    if (
      SHELTERED_STATUSES.has(a.status) &&
      (a.species === 'cat' || a.species === 'dog') &&
      !a.chip_number &&
      !a.tattoo_number &&
      !a.medal_number
    ) {
      results.push({
        animalId: a.id,
        animalName: a.name,
        status: a.status,
        rule: 'ICAD manquante',
        severity: 'critical',
        detail: 'Aucun n° de puce, tatouage ou médaille — obligation ICAD pour chien/chat de +4 mois.',
      })
    }

    // 4. exit_date non null mais statut actif
    if (a.exit_date && SHELTERED_STATUSES.has(a.status)) {
      results.push({
        animalId: a.id,
        animalName: a.name,
        status: a.status,
        rule: 'Sortie sans statut terminal',
        severity: 'critical',
        detail: `Date de sortie ${a.exit_date} mais statut toujours « ${a.status} ».`,
      })
    }

    // 5. Statut terminal mais exit_date null
    if (TERMINAL_STATUSES.has(a.status) && !a.exit_date) {
      results.push({
        animalId: a.id,
        animalName: a.name,
        status: a.status,
        rule: 'Statut terminal sans date de sortie',
        severity: 'warning',
        detail: `Statut « ${a.status} » mais aucune date de sortie renseignée.`,
      })
    }

    // 6. Birth_date dans le futur
    if (a.birth_date && a.birth_date > todayISO) {
      results.push({
        animalId: a.id,
        animalName: a.name,
        status: a.status,
        rule: 'Date de naissance dans le futur',
        severity: 'critical',
        detail: `birth_date = ${a.birth_date} (> aujourd'hui).`,
      })
    }

    // 7. Birth_date trop ancienne
    if (a.birth_date && a.birth_date < thirtyYearsAgoISO) {
      results.push({
        animalId: a.id,
        animalName: a.name,
        status: a.status,
        rule: 'Date de naissance > 30 ans',
        severity: 'warning',
        detail: `birth_date = ${a.birth_date} — durée de vie improbable.`,
      })
    }

    // 8. Adoptable mais pas en charge
    if (a.adoptable && !SHELTERED_STATUSES.has(a.status)) {
      results.push({
        animalId: a.id,
        animalName: a.name,
        status: a.status,
        rule: 'Adoptable avec statut non-actif',
        severity: 'warning',
        detail: `adoptable = true mais statut « ${a.status} » (devrait être shelter/foster/boarding).`,
      })
    }

    // 9. Box assigne mais statut != shelter
    if (a.box_id && a.status !== 'shelter') {
      results.push({
        animalId: a.id,
        animalName: a.name,
        status: a.status,
        rule: 'Box assigné avec statut non-shelter',
        severity: 'info',
        detail: `Animal en box mais statut « ${a.status} » au lieu de « shelter ».`,
      })
    }

    // 10. Dates inversees pound_entry > exit_date
    if (a.pound_entry_date && a.exit_date && a.pound_entry_date > a.exit_date) {
      results.push({
        animalId: a.id,
        animalName: a.name,
        status: a.status,
        rule: 'Dates inversées (fourrière)',
        severity: 'critical',
        detail: `pound_entry_date ${a.pound_entry_date} postérieure à exit_date ${a.exit_date}.`,
      })
    }
  }

  // Trier : critical d'abord, puis warning, puis info
  const order = { critical: 0, warning: 1, info: 2 }
  results.sort((a, b) => order[a.severity] - order[b.severity])
  return results
}
