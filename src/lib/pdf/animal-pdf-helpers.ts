import { createAdminClient } from '@/lib/supabase/server'
import { fetchLogoBase64 } from '@/lib/pdf/render'
import type { Animal, AnimalHealthRecord, AnimalPhoto, Establishment, Veterinarian, VeterinaryClinic } from '@/lib/types/database'

export interface AnimalPdfBundle {
  animal: Animal
  healthRecords: AnimalHealthRecord[]
  primaryPhoto: string | null
  establishment: Establishment
  vet: Veterinarian | null
  clinic: VeterinaryClinic | null
  logoBase64?: string
}

export async function loadAnimalForPdf(animalId: string): Promise<AnimalPdfBundle | null> {
  const admin = createAdminClient()

  const [{ data: animal }, { data: photos }, { data: healthRecords }] = await Promise.all([
    admin.from('animals').select('*').eq('id', animalId).single(),
    admin.from('animal_photos').select('*').eq('animal_id', animalId).order('is_primary', { ascending: false }),
    admin.from('animal_health_records').select('*').eq('animal_id', animalId).order('date', { ascending: false }),
  ])

  if (!animal) return null

  const { data: establishment } = await admin
    .from('establishments')
    .select('*')
    .eq('id', (animal as Animal).establishment_id)
    .single()

  if (!establishment) return null

  // Find the most appropriate vet : identifying vet, or first vet on a health record, or default clinic referent.
  let vet: Veterinarian | null = null
  let clinic: VeterinaryClinic | null = null

  const animalRow = animal as Animal
  if (animalRow.identifying_veterinarian_id) {
    const { data } = await admin
      .from('veterinarians')
      .select('*, veterinary_clinics(*)')
      .eq('id', animalRow.identifying_veterinarian_id)
      .single()
    if (data) {
      vet = data as Veterinarian
      clinic = (data as { veterinary_clinics: VeterinaryClinic | null }).veterinary_clinics
    }
  }

  if (!vet) {
    const lastHealth = (healthRecords as AnimalHealthRecord[] | null)?.find((h) => h.veterinarian_id)
    if (lastHealth?.veterinarian_id) {
      const { data } = await admin
        .from('veterinarians')
        .select('*, veterinary_clinics(*)')
        .eq('id', lastHealth.veterinarian_id)
        .single()
      if (data) {
        vet = data as Veterinarian
        clinic = (data as { veterinary_clinics: VeterinaryClinic | null }).veterinary_clinics
      }
    }
  }

  if (!clinic) {
    const { data } = await admin
      .from('veterinary_clinics')
      .select('*')
      .eq('establishment_id', animalRow.establishment_id)
      .eq('is_default', true)
      .maybeSingle()
    if (data) clinic = data as VeterinaryClinic
  }

  const primaryPhoto = ((photos as AnimalPhoto[] | null) || []).find((p) => p.is_primary)?.url
    || (photos as AnimalPhoto[] | null)?.[0]?.url
    || animalRow.photo_url
    || null

  const logoBase64 = await fetchLogoBase64((establishment as Establishment).logo_url)

  return {
    animal: animalRow,
    healthRecords: (healthRecords as AnimalHealthRecord[]) || [],
    primaryPhoto,
    establishment: establishment as Establishment,
    vet,
    clinic,
    logoBase64,
  }
}
