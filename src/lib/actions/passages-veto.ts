'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { requireEstablishment } from '@/lib/establishment/permissions'

export interface PassageVeto {
  id: string
  date: string
  type: string
  description: string
  cost: number | null
  notes: string | null
  judicial_procedure: boolean
  billed_to: string | null
  invoice_reference: string | null
  animal_id: string
  animal_name: string
  animal_species: string
  animal_medal: string | null
  animal_chip: string | null
  animal_judicial: boolean
  veterinarian_id: string | null
  vet_first_name: string | null
  vet_last_name: string | null
  clinic_id: string | null
  clinic_name: string | null
  clinic_city: string | null
}

interface Filters {
  startDate?: string
  endDate?: string
  vetId?: string
  clinicId?: string
  type?: string
  judicialOnly?: boolean
  animalId?: string
}

export async function getPassagesVeto(filters?: Filters) {
  try {
    const { establishmentId } = await requireEstablishment()
    const admin = createAdminClient()

    let query = admin
      .from('animal_health_records')
      .select(`
        id, date, type, description, cost, notes, judicial_procedure, billed_to, invoice_reference,
        animal_id, veterinarian_id,
        animals!inner(name, species, medal_number, chip_number, establishment_id, judicial_procedure),
        veterinarians:veterinarian_id(id, first_name, last_name, clinic_id, veterinary_clinics(id, name, city))
      `)
      .eq('animals.establishment_id', establishmentId)

    if (filters?.startDate) query = query.gte('date', filters.startDate)
    if (filters?.endDate) query = query.lte('date', filters.endDate)
    if (filters?.vetId) query = query.eq('veterinarian_id', filters.vetId)
    if (filters?.type) query = query.eq('type', filters.type)
    if (filters?.judicialOnly) query = query.eq('judicial_procedure', true)
    if (filters?.animalId) query = query.eq('animal_id', filters.animalId)

    const { data, error } = await query.order('date', { ascending: false })
    if (error) return { error: error.message }

    type Row = {
      id: string; date: string; type: string; description: string; cost: number | null; notes: string | null
      judicial_procedure: boolean; billed_to: string | null; invoice_reference: string | null
      animal_id: string; veterinarian_id: string | null
      animals: { name: string; species: string; medal_number: string | null; chip_number: string | null; judicial_procedure: boolean }
      veterinarians: { id: string; first_name: string | null; last_name: string; clinic_id: string | null; veterinary_clinics: { id: string; name: string; city: string | null } | null } | null
    }
    const rows = ((data as unknown) as Row[]) || []

    let result: PassageVeto[] = rows.map((r) => ({
      id: r.id,
      date: r.date,
      type: r.type,
      description: r.description,
      cost: r.cost,
      notes: r.notes,
      judicial_procedure: r.judicial_procedure,
      billed_to: r.billed_to,
      invoice_reference: r.invoice_reference,
      animal_id: r.animal_id,
      animal_name: r.animals.name,
      animal_species: r.animals.species,
      animal_medal: r.animals.medal_number,
      animal_chip: r.animals.chip_number,
      animal_judicial: r.animals.judicial_procedure,
      veterinarian_id: r.veterinarian_id,
      vet_first_name: r.veterinarians?.first_name ?? null,
      vet_last_name: r.veterinarians?.last_name ?? null,
      clinic_id: r.veterinarians?.clinic_id ?? null,
      clinic_name: r.veterinarians?.veterinary_clinics?.name ?? null,
      clinic_city: r.veterinarians?.veterinary_clinics?.city ?? null,
    }))

    if (filters?.clinicId) {
      result = result.filter((p) => p.clinic_id === filters.clinicId)
    }

    return { data: result }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function getPassagesVetoStats(filters?: Filters) {
  const res = await getPassagesVeto(filters)
  if ('error' in res || !res.data) return { error: ('error' in res ? res.error : 'Erreur') as string }

  const rows = res.data
  const totalCost = rows.reduce((s, r) => s + (Number(r.cost) || 0), 0)
  const byVet: Record<string, { name: string; count: number; cost: number }> = {}
  const byType: Record<string, number> = {}

  for (const r of rows) {
    const vetKey = r.veterinarian_id || 'none'
    const vetName = r.vet_first_name || r.vet_last_name
      ? `Dr ${r.vet_first_name ? `${r.vet_first_name} ` : ''}${r.vet_last_name || ''}`.trim()
      : 'Vétérinaire inconnu'
    if (!byVet[vetKey]) byVet[vetKey] = { name: vetName, count: 0, cost: 0 }
    byVet[vetKey].count += 1
    byVet[vetKey].cost += Number(r.cost) || 0
    byType[r.type] = (byType[r.type] || 0) + 1
  }

  return { data: { count: rows.length, totalCost, byVet, byType } }
}
