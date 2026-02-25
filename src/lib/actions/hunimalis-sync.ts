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

    // 3. Upsert into Supabase (match by hunimalis_id)
    const supabase = createAdminClient()
    let synced = 0

    // Process in batches of 50
    const batchSize = 50
    for (let i = 0; i < mapped.length; i += batchSize) {
      const batch = mapped.slice(i, i + batchSize)

      const rows = batch.map((animal) => ({
        ...animal,
        establishment_id: establishmentId,
        last_synced_at: new Date().toISOString(),
      }))

      const { error } = await supabase
        .from('animals')
        .upsert(rows, {
          onConflict: 'hunimalis_id',
          ignoreDuplicates: false,
        })

      if (error) {
        console.error('Hunimalis sync batch error:', error.message)
        return { error: `Erreur de sync batch ${Math.floor(i / batchSize) + 1}: ${error.message}` }
      }

      synced += batch.length
    }

    // 4. Sync photos (set photo_url from Hunimalis picture)
    for (const h of hunimalisAnimals) {
      if (h.picture) {
        await supabase
          .from('animals')
          .update({ photo_url: h.picture })
          .eq('hunimalis_id', h.id)
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
