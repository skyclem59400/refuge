import { createAdminClient } from '@/lib/supabase/server'
import {
  buildMedicalCostRecapHtml,
  type MedicalCostRecap,
} from './medical-cost-recap-template'
import { renderHtmlToPdf, fetchLogoBase64 } from './render'
import type { HealthRecordType } from '@/lib/types/database'

const HEALTH_TYPE_LABEL: Record<HealthRecordType, string> = {
  vaccination: 'Vaccination',
  sterilization: 'Sterilisation',
  antiparasitic: 'Antiparasitaire',
  consultation: 'Consultation',
  surgery: 'Chirurgie',
  medication: 'Medication',
  behavioral_assessment: 'Evaluation comportementale',
  identification: 'Identification',
  radio: 'Radiographie',
  blood_test: 'Analyses sanguines',
  cession: 'Certificat cession',
}

function labelType(t: string): string {
  return HEALTH_TYPE_LABEL[t as HealthRecordType] ?? t
}

function safeFilenamePart(s: string): string {
  return (
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60) || 'animal'
  )
}

function todayCompact(): string {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

interface AnimalRow {
  id: string
  establishment_id: string
  name: string
  species: string
  breed: string | null
  breed_cross: string | null
  chip_number: string | null
  tattoo_number: string | null
  judicial_case_number: string | null
  judicial_jurisdiction: string | null
  judicial_seizure_date: string | null
  judicial_owner_name: string | null
  judicial_billing_recipient: string | null
  judicial_pickup_location: string | null
}

interface EstablishmentRow {
  name: string | null
  legal_name: string | null
  address: string | null
  siret: string | null
  iban: string | null
  bic: string | null
  logo_url: string | null
}

interface HealthRecordRow {
  id: string
  date: string
  type: string
  description: string
  veterinarian: string | null
  cost: number | null
  invoice_reference: string | null
  invoice_storage_path: string | null
  judicial_procedure: boolean
}

export async function buildMedicalCostRecapPdf(
  animalId: string
): Promise<{ buffer: Buffer; filename: string }> {
  const admin = createAdminClient()

  const { data: animal, error: animalError } = await admin
    .from('animals')
    .select(
      `id, establishment_id, name, species, breed, breed_cross, chip_number, tattoo_number,
       judicial_case_number, judicial_jurisdiction, judicial_seizure_date,
       judicial_owner_name, judicial_billing_recipient, judicial_pickup_location`
    )
    .eq('id', animalId)
    .single<AnimalRow>()

  if (animalError || !animal) throw new Error('Animal introuvable')

  const { data: est } = await admin
    .from('establishments')
    .select('name, legal_name, address, siret, iban, bic, logo_url')
    .eq('id', animal.establishment_id)
    .single<EstablishmentRow>()

  const { data: rawRecords } = await admin
    .from('animal_health_records')
    .select(
      `id, date, type, description, veterinarian, cost, invoice_reference,
       invoice_storage_path, judicial_procedure`
    )
    .eq('animal_id', animalId)
    .eq('judicial_procedure', true)
    .gt('cost', 0)
    .order('date', { ascending: true })

  const records = ((rawRecords as HealthRecordRow[] | null) ?? []).map((r) => {
    const costNum = Number(r.cost ?? 0)
    return {
      date: r.date,
      type: labelType(r.type),
      description: r.description ?? '',
      veterinarian: r.veterinarian,
      cost: costNum,
      invoice_reference: r.invoice_reference,
      has_invoice: Boolean(r.invoice_storage_path),
    }
  })

  const total_eur = records.reduce((sum, r) => sum + r.cost, 0)
  const with_invoice_count = records.filter((r) => r.has_invoice).length
  const without_invoice_count = records.length - with_invoice_count

  const identification = animal.chip_number ?? animal.tattoo_number ?? null

  const logoBase64 = await fetchLogoBase64(est?.logo_url ?? null)

  const payload: MedicalCostRecap = {
    establishment: {
      name: est?.name ?? 'Refuge',
      legal_name: est?.legal_name ?? null,
      address: est?.address ?? null,
      siret: est?.siret ?? null,
      iban: est?.iban ?? null,
      bic: est?.bic ?? null,
    },
    animal: {
      name: animal.name,
      species: animal.species,
      breed: animal.breed_cross || animal.breed || null,
      identification,
      chip_number: animal.chip_number,
    },
    judicial: {
      case_number: animal.judicial_case_number,
      jurisdiction: animal.judicial_jurisdiction,
      seizure_date: animal.judicial_seizure_date,
      owner_name: animal.judicial_owner_name,
      billing_recipient: animal.judicial_billing_recipient,
      pickup_location: animal.judicial_pickup_location,
    },
    records,
    totals: {
      total_eur,
      with_invoice_count,
      without_invoice_count,
    },
    generated_at: new Date().toISOString(),
  }

  const html = buildMedicalCostRecapHtml(payload, logoBase64)
  const buffer = await renderHtmlToPdf(html)

  const animalSafe = safeFilenamePart(animal.name)
  const suffix = animal.judicial_case_number
    ? safeFilenamePart(animal.judicial_case_number)
    : todayCompact()
  const filename = `Recap_frais_medicaux_${animalSafe}_${suffix}.pdf`

  return { buffer, filename }
}
