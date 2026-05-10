'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/establishment/permissions'
import { logActivity } from '@/lib/actions/activity-log'

export interface AssignableAnimal {
  id: string
  name: string
  species: string
  sex: string | null
  status: string | null
  photo_url: string | null
  birth_date: string | null
  current_box_id: string | null
  current_box_name: string | null
}

/**
 * Liste les animaux candidats pour un box (compatibles espece, non encore
 * dans ce box). Inclut les animaux libres ET ceux assignes ailleurs (badge
 * "actuellement dans X").
 */
export async function listAssignableAnimals(
  boxId: string
): Promise<{ data?: AssignableAnimal[]; error?: string }> {
  try {
    const { establishmentId } = await requirePermission('manage_boxes')
    const admin = createAdminClient()

    // 1. Recuperer l'espece du box cible
    const { data: targetBox } = await admin
      .from('boxes')
      .select('id, species_type')
      .eq('id', boxId)
      .eq('establishment_id', establishmentId)
      .single()

    if (!targetBox) return { error: 'Box introuvable.' }

    // species_type sur boxes : 'cat' | 'dog' | 'mixed'
    // animals.species : 'cat' | 'dog' (et autres rares)
    // Si box est mixed -> tous les animaux ; sinon match exact
    let query = admin
      .from('animals')
      .select(
        `id, name, species, sex, status, photo_url, birth_date, box_id,
         box:boxes(id, name)`
      )
      .eq('establishment_id', establishmentId)
      // box_id != boxId OU box_id IS NULL (animaux sans box). Note PostgREST :
      // .neq('box_id', boxId) seul exclurait les NULL car null != value vaut null en SQL.
      .or(`box_id.neq.${boxId},box_id.is.null`)
      // Seuls les animaux physiquement presents au refuge ou en fourriere
      // peuvent etre dans un box. Les animaux en famille d'accueil (FA) ou
      // en pension (boarding) sont chez quelqu'un d'autre par definition.
      .in('status', ['shelter', 'pound'])

    if (targetBox.species_type !== 'mixed') {
      query = query.eq('species', targetBox.species_type)
    }

    const { data, error } = await query.order('name')
    if (error) return { error: error.message }

    interface Row {
      id: string
      name: string
      species: string
      sex: string | null
      status: string | null
      photo_url: string | null
      birth_date: string | null
      box_id: string | null
      box: { id: string; name: string }[] | { id: string; name: string } | null
    }

    const result: AssignableAnimal[] = ((data as unknown as Row[] | null) ?? []).map((a) => {
      const boxRel = Array.isArray(a.box) ? a.box[0] : a.box
      return {
        id: a.id,
        name: a.name,
        species: a.species,
        sex: a.sex,
        status: a.status,
        photo_url: a.photo_url,
        birth_date: a.birth_date,
        current_box_id: a.box_id,
        current_box_name: boxRel?.name ?? null,
      }
    })

    return { data: result }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/**
 * Assigne un ou plusieurs animaux a un box. Verifie la capacite et l'espece.
 */
export async function assignAnimalsToBox(boxId: string, animalIds: string[]) {
  try {
    if (!animalIds.length) return { success: true, assigned: 0 }
    const { establishmentId } = await requirePermission('manage_boxes')
    const supabase = await createClient()
    const admin = createAdminClient()

    // Capacite et espece du box
    const { data: box } = await admin
      .from('boxes')
      .select('id, name, capacity, species_type')
      .eq('id', boxId)
      .eq('establishment_id', establishmentId)
      .single()
    if (!box) return { error: 'Box introuvable.' }

    // Comptage actuel
    const { count: currentCount } = await admin
      .from('animals')
      .select('id', { count: 'exact', head: true })
      .eq('box_id', boxId)
      .eq('establishment_id', establishmentId)

    if ((currentCount ?? 0) + animalIds.length > box.capacity) {
      return {
        error: `Capacite depassee : ${currentCount}/${box.capacity}, +${animalIds.length} demandes.`,
      }
    }

    // Filtrer les animaux compatibles (espece + statut physiquement present)
    const { data: animals } = await admin
      .from('animals')
      .select('id, name, species, status')
      .in('id', animalIds)
      .eq('establishment_id', establishmentId)

    const validIds: string[] = []
    for (const a of animals ?? []) {
      const speciesOk = box.species_type === 'mixed' || a.species === box.species_type
      const statusOk = a.status === 'shelter' || a.status === 'pound'
      if (speciesOk && statusOk) validIds.push(a.id)
    }

    if (validIds.length === 0) {
      return {
        error:
          'Aucun animal compatible : verifiez espece et statut (un animal en famille d’accueil ne peut pas etre dans un box).',
      }
    }

    const { error } = await supabase
      .from('animals')
      .update({ box_id: boxId })
      .in('id', validIds)
      .eq('establishment_id', establishmentId)
    if (error) return { error: error.message }

    logActivity({
      action: 'update',
      entityType: 'box',
      entityId: boxId,
      entityName: box.name,
      details: { assigned_animals: validIds.length, animal_ids: validIds },
    })

    revalidatePath('/boxes')
    revalidatePath('/animals')
    return { success: true, assigned: validIds.length }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/**
 * Deplace un animal vers un autre box (ou null = retire du box).
 */
export async function moveAnimalToBox(animalId: string, newBoxId: string | null) {
  try {
    const { establishmentId } = await requirePermission('manage_boxes')
    const supabase = await createClient()
    const admin = createAdminClient()

    // Verifie que l'animal appartient a l'etablissement
    const { data: animal } = await admin
      .from('animals')
      .select('id, name, species, box_id, status')
      .eq('id', animalId)
      .eq('establishment_id', establishmentId)
      .single()
    if (!animal) return { error: 'Animal introuvable.' }

    if (newBoxId) {
      // Un animal en famille d'accueil ou en pension n'a logiquement pas
      // a etre dans un box (il est chez quelqu'un d'autre).
      if (animal.status !== 'shelter' && animal.status !== 'pound') {
        return {
          error: `${animal.name} a le statut « ${animal.status} » et ne peut pas etre place dans un box. Changez d'abord son statut.`,
        }
      }

      // Verifie box destination + capacite + espece
      const { data: box } = await admin
        .from('boxes')
        .select('id, name, capacity, species_type')
        .eq('id', newBoxId)
        .eq('establishment_id', establishmentId)
        .single()
      if (!box) return { error: 'Box destination introuvable.' }

      if (box.species_type !== 'mixed' && animal.species !== box.species_type) {
        return { error: `Espece incompatible avec le box « ${box.name} ».` }
      }

      const { count: currentCount } = await admin
        .from('animals')
        .select('id', { count: 'exact', head: true })
        .eq('box_id', newBoxId)
        .eq('establishment_id', establishmentId)
      if ((currentCount ?? 0) >= box.capacity) {
        return { error: `Box « ${box.name} » plein (${currentCount}/${box.capacity}).` }
      }
    }

    const { error } = await supabase
      .from('animals')
      .update({ box_id: newBoxId })
      .eq('id', animalId)
      .eq('establishment_id', establishmentId)
    if (error) return { error: error.message }

    logActivity({
      action: 'update',
      entityType: 'animal',
      entityId: animalId,
      entityName: animal.name,
      details: { from_box_id: animal.box_id, to_box_id: newBoxId },
    })

    revalidatePath('/boxes')
    revalidatePath('/animals')
    revalidatePath(`/animals/${animalId}`)
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
