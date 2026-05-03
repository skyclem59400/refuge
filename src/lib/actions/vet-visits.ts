'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireEstablishment, requirePermission } from '@/lib/establishment/permissions'
import { logActivity } from '@/lib/actions/activity-log'
import type {
  VetVisit,
  VetVisitLine,
  VetVisitLineWithAnimal,
  VetVisitWithLines,
  VetVisitActKey,
  VetVisitActs,
  HealthRecordType,
} from '@/lib/types/database'

// Mapping des cases du planning -> type d'acte santé créé sur l'animal
const ACT_TO_HEALTH_TYPE: Record<VetVisitActKey, HealthRecordType> = {
  puce: 'identification',
  cession: 'cession',
  vaccin_chien: 'vaccination',
  vaccin_chat: 'vaccination',
  visite_divers: 'consultation',
  importation: 'consultation',
  test_leucose: 'blood_test',
  consultation: 'consultation',
  sterilization: 'sterilization',
  antiparasitic: 'antiparasitic',
  radio: 'radio',
}

const ACT_LABELS: Record<VetVisitActKey, string> = {
  puce: 'Identification (puce)',
  cession: 'Cession véto',
  vaccin_chien: 'Vaccin chien',
  vaccin_chat: 'Vaccin chat',
  visite_divers: 'Visite divers',
  importation: 'Importation',
  test_leucose: 'Test leucose / FIV',
  consultation: 'Consultation',
  sterilization: 'Stérilisation',
  antiparasitic: 'Antiparasitaire',
  radio: 'Radio',
}

// ============================================
// READ
// ============================================

export async function listVetVisits(filters?: { startDate?: string; endDate?: string }) {
  try {
    const { establishmentId } = await requireEstablishment()
    const admin = createAdminClient()

    let query = admin
      .from('vet_visits')
      .select('*')
      .eq('establishment_id', establishmentId)

    if (filters?.startDate) query = query.gte('visit_date', filters.startDate)
    if (filters?.endDate) query = query.lte('visit_date', filters.endDate)

    const { data, error } = await query.order('visit_date', { ascending: false })
    if (error) return { error: error.message }
    return { data: (data as VetVisit[]) || [] }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function getVetVisit(visitId: string) {
  try {
    const { establishmentId } = await requireEstablishment()
    const admin = createAdminClient()

    const { data: visit, error } = await admin
      .from('vet_visits')
      .select('*')
      .eq('id', visitId)
      .eq('establishment_id', establishmentId)
      .single()

    if (error || !visit) return { error: error?.message || 'Visite introuvable' }

    const { data: lines, error: linesError } = await admin
      .from('vet_visit_lines')
      .select(`
        *,
        animal:animals!animal_id(id, name, species, medal_number, breed, breed_cross, color, box_id, chip_number)
      `)
      .eq('visit_id', visitId)
      .order('line_order')

    if (linesError) return { error: linesError.message }

    const result: VetVisitWithLines = {
      ...(visit as VetVisit),
      lines: (lines as unknown as VetVisitLineWithAnimal[]) || [],
    }
    return { data: result }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ============================================
// WRITE
// ============================================

interface CreateVisitInput {
  visit_date: string
  time_label?: string | null
  location_label?: string | null
  veterinarian_id?: string | null
  vet_label?: string | null
  notes?: string | null
}

export async function createVetVisit(input: CreateVisitInput) {
  try {
    const ctx = await requirePermission('manage_health')
    const admin = createAdminClient()

    const { data, error } = await admin
      .from('vet_visits')
      .insert({
        establishment_id: ctx.establishmentId,
        visit_date: input.visit_date,
        time_label: input.time_label?.trim() || null,
        location_label: input.location_label?.trim() || null,
        veterinarian_id: input.veterinarian_id || null,
        vet_label: input.vet_label?.trim() || null,
        notes: input.notes?.trim() || null,
        created_by: ctx.userId,
      })
      .select()
      .single()

    if (error) return { error: error.message }

    revalidatePath('/sante/passages')
    revalidatePath('/sante/planning')
    logActivity({ action: 'create', entityType: 'vet_visit', entityId: (data as VetVisit).id, entityName: input.visit_date })
    return { data: data as VetVisit }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function updateVetVisit(visitId: string, input: Partial<CreateVisitInput>) {
  try {
    const { establishmentId } = await requirePermission('manage_health')
    const admin = createAdminClient()
    const update: Record<string, unknown> = {}
    if (input.visit_date !== undefined) update.visit_date = input.visit_date
    if (input.time_label !== undefined) update.time_label = input.time_label?.trim() || null
    if (input.location_label !== undefined) update.location_label = input.location_label?.trim() || null
    if (input.veterinarian_id !== undefined) update.veterinarian_id = input.veterinarian_id
    if (input.vet_label !== undefined) update.vet_label = input.vet_label?.trim() || null
    if (input.notes !== undefined) update.notes = input.notes?.trim() || null

    const { error } = await admin
      .from('vet_visits')
      .update(update)
      .eq('id', visitId)
      .eq('establishment_id', establishmentId)
    if (error) return { error: error.message }
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function deleteVetVisit(visitId: string) {
  try {
    const { establishmentId } = await requirePermission('manage_health')
    const admin = createAdminClient()
    const { error } = await admin
      .from('vet_visits')
      .delete()
      .eq('id', visitId)
      .eq('establishment_id', establishmentId)
    if (error) return { error: error.message }
    revalidatePath('/sante/planning')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

interface AddLineInput {
  visit_id: string
  animal_id: string
  acts?: VetVisitActs
  chip_number?: string | null
  weight?: number | null
  cost?: number | null
  observations?: string | null
  complement?: string | null
}

export async function addVetVisitLine(input: AddLineInput) {
  try {
    await requirePermission('manage_health')
    const admin = createAdminClient()

    // Détermine le line_order automatiquement
    const { data: existing } = await admin
      .from('vet_visit_lines')
      .select('line_order')
      .eq('visit_id', input.visit_id)
      .order('line_order', { ascending: false })
      .limit(1)
    const nextOrder = ((existing?.[0] as { line_order: number } | undefined)?.line_order ?? -1) + 1

    const { data, error } = await admin
      .from('vet_visit_lines')
      .insert({
        visit_id: input.visit_id,
        animal_id: input.animal_id,
        line_order: nextOrder,
        acts: input.acts || {},
        chip_number: input.chip_number?.trim() || null,
        weight: input.weight ?? null,
        cost: input.cost ?? null,
        observations: input.observations?.trim() || null,
        complement: input.complement?.trim() || null,
      })
      .select()
      .single()

    if (error) return { error: error.message }
    revalidatePath('/sante/planning')
    return { data: data as VetVisitLine }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function updateVetVisitLine(lineId: string, input: Partial<AddLineInput>) {
  try {
    await requirePermission('manage_health')
    const admin = createAdminClient()

    const update: Record<string, unknown> = {}
    if (input.acts !== undefined) update.acts = input.acts
    if (input.chip_number !== undefined) update.chip_number = input.chip_number?.trim() || null
    if (input.weight !== undefined) update.weight = input.weight
    if (input.cost !== undefined) update.cost = input.cost
    if (input.observations !== undefined) update.observations = input.observations?.trim() || null
    if (input.complement !== undefined) update.complement = input.complement?.trim() || null

    const { error } = await admin.from('vet_visit_lines').update(update).eq('id', lineId)
    if (error) return { error: error.message }
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function deleteVetVisitLine(lineId: string) {
  try {
    await requirePermission('manage_health')
    const admin = createAdminClient()
    const { error } = await admin.from('vet_visit_lines').delete().eq('id', lineId)
    if (error) return { error: error.message }
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ============================================
// VALIDATION : génère les actes santé sur les animaux
// ============================================

export async function validateVetVisitLine(lineId: string) {
  try {
    const ctx = await requirePermission('manage_health')
    const admin = createAdminClient()

    // 1. Lire la ligne + visite + animal
    const { data: line } = await admin
      .from('vet_visit_lines')
      .select(`
        *,
        visit:vet_visits!visit_id(id, visit_date, vet_label, veterinarian_id, establishment_id, location_label),
        animal:animals!animal_id(id, name, chip_number)
      `)
      .eq('id', lineId)
      .single()

    if (!line) return { error: 'Ligne introuvable' }

    const lineData = line as unknown as VetVisitLine & {
      visit: { id: string; visit_date: string; vet_label: string | null; veterinarian_id: string | null; establishment_id: string; location_label: string | null }
      animal: { id: string; name: string; chip_number: string | null }
    }

    // Vérifier que l'utilisateur a les droits sur cet établissement
    if (lineData.visit.establishment_id !== ctx.establishmentId) {
      return { error: 'Accès refusé' }
    }

    if (lineData.validated_at) {
      return { error: 'Cette ligne a déjà été validée' }
    }

    const acts = (lineData.acts || {}) as VetVisitActs
    const checkedActs = (Object.keys(acts) as VetVisitActKey[]).filter((k) => acts[k])

    if (checkedActs.length === 0) {
      return { error: 'Aucun acte coché à enregistrer' }
    }

    // 2. Pour chaque acte coché, créer un animal_health_record
    const created: string[] = []
    for (const actKey of checkedActs) {
      const healthType = ACT_TO_HEALTH_TYPE[actKey]
      const description = ACT_LABELS[actKey]
      const notes = lineData.observations || null

      const { data: rec, error: recErr } = await admin
        .from('animal_health_records')
        .insert({
          animal_id: lineData.animal_id,
          type: healthType,
          date: lineData.visit.visit_date,
          description,
          veterinarian: lineData.visit.vet_label || null,
          veterinarian_id: lineData.visit.veterinarian_id,
          cost: lineData.cost ?? null,
          notes,
          created_by: ctx.userId,
        })
        .select('id')
        .single()

      if (recErr) {
        console.error('Erreur création acte', actKey, ':', recErr.message)
        continue
      }
      created.push((rec as { id: string }).id)
    }

    // 3. Si la puce a été cochée et un n° saisi, reporter sur la fiche animal
    if (acts.puce && lineData.chip_number) {
      const animalUpdate: Record<string, unknown> = {
        chip_number: lineData.chip_number,
        identification_date: lineData.visit.visit_date,
      }
      if (lineData.visit.veterinarian_id) {
        animalUpdate.identifying_veterinarian_id = lineData.visit.veterinarian_id
      }
      await admin.from('animals').update(animalUpdate).eq('id', lineData.animal_id)
    }

    // 4. Si stérilisation cochée, marquer l'animal comme stérilisé
    if (acts.sterilization) {
      await admin.from('animals').update({ sterilized: true }).eq('id', lineData.animal_id)
    }

    // 5. Si poids saisi, mettre à jour
    if (lineData.weight !== null && lineData.weight !== undefined) {
      await admin.from('animals').update({ weight: lineData.weight }).eq('id', lineData.animal_id)
    }

    // 6. Marquer la ligne comme validée
    await admin
      .from('vet_visit_lines')
      .update({ validated_at: new Date().toISOString(), validated_by: ctx.userId })
      .eq('id', lineId)

    revalidatePath(`/animals/${lineData.animal_id}`)
    revalidatePath(`/sante/planning/${lineData.visit.id}`)
    revalidatePath('/sante/passages')

    logActivity({
      action: 'create',
      entityType: 'vet_visit_validation',
      entityId: lineId,
      entityName: `${lineData.animal.name} — ${checkedActs.length} acte(s)`,
      parentType: 'animal',
      parentId: lineData.animal_id,
    })

    return { success: true, created: created.length }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function unvalidateVetVisitLine(lineId: string) {
  try {
    await requirePermission('manage_health')
    const admin = createAdminClient()
    // On ne supprime pas les actes santé créés (trop dangereux), on annule juste la validation
    const { error } = await admin
      .from('vet_visit_lines')
      .update({ validated_at: null, validated_by: null })
      .eq('id', lineId)
    if (error) return { error: error.message }
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
