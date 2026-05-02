'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/establishment/permissions'
import { fetchAllAnimals, mapHunimalisToAnimal } from '@/lib/hunimalis/client'

export async function syncAnimalsFromHunimalis(): Promise<{
  success?: boolean
  synced?: number
  total?: number
  details?: string
  error?: string
}> {
  try {
    const { establishmentId } = await requirePermission('manage_animals')

    // 1. Fetch all animals from all Hunimalis locations
    const { animals: hunimalisAnimals, total, byLocation } = await fetchAllAnimals()

    // 2. Map to our format
    const mapped = hunimalisAnimals.map(mapHunimalisToAnimal)

    // 3. Merge intelligent dans Supabase (match by hunimalis_id)
    //
    // IMPORTANT : on ne fait PAS un upsert brut. Hunimalis renvoie souvent
    // certains champs à null (puce posée chez nous mais pas encore syncée
    // côté Hunimalis, race ou âge encore inconnus côté Hunimalis, etc.).
    // Un upsert brut écraserait nos données locales saisies par les
    // soigneurs. On fait donc :
    //   - INSERT pour les nouveaux animaux (hunimalis_id inconnu en local)
    //   - UPDATE pour les existants en omettant les champs null/vide
    //     côté Hunimalis si la valeur locale est non-null.
    const supabase = createAdminClient()
    let synced = 0

    // Champs à préserver en local si Hunimalis renvoie null/vide.
    // Couvre tous les champs typiquement saisis par les soigneurs en interne
    // avant qu'Hunimalis ne les ait reçus (puce posée, vaccination, etc.)
    const PRESERVED_IF_HUNIMALIS_EMPTY: Array<keyof typeof mapped[0]> = [
      'chip_number',
      'birth_date',
      'birth_place',
      'color',
      'tattoo_number',
      'tattoo_position',
      'medal_number',
      'loof_number',
      'passport_number',
      'breed',
      'breed_cross',
      'name_secondary',
      'description',
    ]

    const huniIds = mapped.map((r) => r.hunimalis_id)
    const { data: existingAll, error: fetchErr } = await supabase
      .from('animals')
      .select('id, hunimalis_id, chip_number, birth_date, birth_place, color, tattoo_number, tattoo_position, medal_number, loof_number, passport_number, breed, breed_cross, name_secondary, description')
      .in('hunimalis_id', huniIds)
      .eq('establishment_id', establishmentId)

    if (fetchErr) {
      console.error('Hunimalis sync fetch existing error:', fetchErr.message)
      return { error: `Erreur lecture existants : ${fetchErr.message}` }
    }

    const byHuniId = new Map<number, Record<string, unknown>>()
    for (const r of existingAll || []) byHuniId.set((r as { hunimalis_id: number }).hunimalis_id, r as Record<string, unknown>)

    const toInsert: Record<string, unknown>[] = []
    const toUpdate: { id: string; data: Record<string, unknown> }[] = []

    for (const row of mapped) {
      const enriched: Record<string, unknown> = {
        ...row,
        establishment_id: establishmentId,
        last_synced_at: new Date().toISOString(),
      }
      const existing = byHuniId.get(row.hunimalis_id)
      if (existing) {
        // Merge : ne pas écraser un champ local si Hunimalis renvoie null/vide
        for (const field of PRESERVED_IF_HUNIMALIS_EMPTY) {
          const huniValue = enriched[field]
          const localValue = existing[field]
          if ((huniValue === null || huniValue === '' || huniValue === undefined) && localValue) {
            delete enriched[field]
          }
        }
        toUpdate.push({ id: existing.id as string, data: enriched })
      } else {
        toInsert.push(enriched)
      }
    }

    // INSERT (batches de 50)
    const batchSize = 50
    for (let i = 0; i < toInsert.length; i += batchSize) {
      const batch = toInsert.slice(i, i + batchSize)
      const { error } = await supabase.from('animals').insert(batch)
      if (error) {
        console.error('Hunimalis sync insert batch error:', error.message)
        return { error: `Erreur insert batch ${Math.floor(i / batchSize) + 1}: ${error.message}` }
      }
      synced += batch.length
    }

    // UPDATE (séquentiel — chaque animal a son id)
    for (const u of toUpdate) {
      const { error } = await supabase.from('animals').update(u.data).eq('id', u.id)
      if (error) {
        console.error('Hunimalis sync update error for animal', u.id, ':', error.message)
        // On continue avec les autres animaux plutôt que d'échouer la sync entière
        continue
      }
      synced += 1
    }

    // 4. Sync photos (set photo_url + insert into animal_photos if missing)
    for (const h of hunimalisAnimals) {
      if (h.picture) {
        // Update photo_url on the animal record
        const { data: animal } = await supabase
          .from('animals')
          .update({ photo_url: h.picture })
          .eq('hunimalis_id', h.id)
          .eq('establishment_id', establishmentId)
          .select('id')
          .single()

        if (animal) {
          // Check if this Hunimalis photo already exists in animal_photos
          const { data: existingPhotos } = await supabase
            .from('animal_photos')
            .select('id, url')
            .eq('animal_id', animal.id)

          const hasHunimalisPhoto = existingPhotos?.some((p) => p.url === h.picture)

          if (!hasHunimalisPhoto) {
            const isFirst = !existingPhotos || existingPhotos.length === 0
            await supabase
              .from('animal_photos')
              .insert({
                animal_id: animal.id,
                url: h.picture,
                is_primary: isFirst,
              })
          }
        }
      }
    }

    revalidatePath('/animals')
    revalidatePath('/dashboard')
    revalidatePath('/pound')

    // Build details string
    const details = byLocation
      .filter((l) => l.count > 0)
      .map((l) => `${l.label}: ${l.count}`)
      .join(', ')

    return { success: true, synced, total, details }
  } catch (e) {
    console.error('Hunimalis sync error:', e)
    return { error: (e as Error).message }
  }
}
