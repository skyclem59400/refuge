'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/establishment/permissions'
import { logActivity } from '@/lib/actions/activity-log'
import type {
  AnimalNews,
  AnimalNewsPhoto,
  AnimalNewsWithAnimal,
  AnimalNewsMosaic,
} from '@/lib/types/database'
import { ANIMAL_NEWS_ELIGIBLE_STATUSES } from '@/lib/types/database'

// ============================================
// Read actions
// ============================================

export async function getAnimalNewsInbox() {
  try {
    const ctx = await requirePermission('view_animal_news')
    const admin = createAdminClient()

    const { data, error } = await admin
      .from('animal_news')
      .select('*, animal:animals(id,name,species,sex,status,exit_date,photo_url,birth_date)')
      .eq('establishment_id', ctx.establishmentId)
      .is('posted_at', null)
      .order('received_at', { ascending: false })

    if (error) return { error: error.message }
    return { data: (data as AnimalNewsWithAnimal[]) || [] }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function getAnimalNewsHistory() {
  try {
    const ctx = await requirePermission('view_animal_news')
    const admin = createAdminClient()

    const [{ data: solos, error: e1 }, { data: mosaics, error: e2 }] = await Promise.all([
      admin
        .from('animal_news')
        .select('*, animal:animals(id,name,species,sex,status,exit_date,photo_url,birth_date)')
        .eq('establishment_id', ctx.establishmentId)
        .not('posted_at', 'is', null)
        .is('posted_in_mosaic_id', null)
        .order('posted_at', { ascending: false }),
      admin
        .from('animal_news_mosaics')
        .select('*')
        .eq('establishment_id', ctx.establishmentId)
        .not('posted_at', 'is', null)
        .order('posted_at', { ascending: false }),
    ])

    if (e1) return { error: e1.message }
    if (e2) return { error: e2.message }

    return {
      data: {
        solos: (solos as AnimalNewsWithAnimal[]) || [],
        mosaics: (mosaics as AnimalNewsMosaic[]) || [],
      },
    }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function getAnimalNewsForAnimal(animalId: string) {
  try {
    const ctx = await requirePermission('view_animal_news')
    const admin = createAdminClient()

    const { data, error } = await admin
      .from('animal_news')
      .select('*')
      .eq('animal_id', animalId)
      .eq('establishment_id', ctx.establishmentId)
      .order('received_at', { ascending: false })

    if (error) return { error: error.message }
    return { data: (data as AnimalNews[]) || [] }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/** Animaux éligibles : statut adopted / foster_family / transferred / returned. */
export async function getEligibleAnimalsForNews() {
  try {
    const ctx = await requirePermission('view_animal_news')
    const admin = createAdminClient()

    const { data, error } = await admin
      .from('animals')
      .select('id, name, species, sex, status, exit_date, photo_url, birth_date')
      .eq('establishment_id', ctx.establishmentId)
      .in('status', ANIMAL_NEWS_ELIGIBLE_STATUSES)
      .order('name', { ascending: true })

    if (error) return { error: error.message }
    return { data: data || [] }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ============================================
// Write actions
// ============================================

interface AddNewsInput {
  animal_id: string
  photos: AnimalNewsPhoto[] // uploadées côté client direct vers Storage
  text: string | null
  received_from: string | null
  received_at: string // YYYY-MM-DD
}

export async function addAnimalNews(input: AddNewsInput) {
  try {
    const ctx = await requirePermission('view_animal_news')
    const admin = createAdminClient()

    // Vérifier que l'animal appartient bien à l'établissement
    const { data: animal } = await admin
      .from('animals')
      .select('id, name, establishment_id')
      .eq('id', input.animal_id)
      .eq('establishment_id', ctx.establishmentId)
      .single()

    if (!animal) return { error: 'Animal introuvable' }

    // Sanity-check : tous les paths doivent commencer par {establishmentId}/news/
    for (const p of input.photos) {
      if (!p.path.startsWith(`${ctx.establishmentId}/news/`)) {
        return { error: 'Chemin de stockage invalide pour cet établissement' }
      }
    }

    const { data: news, error } = await admin
      .from('animal_news')
      .insert({
        establishment_id: ctx.establishmentId,
        animal_id: input.animal_id,
        photos: input.photos,
        text: input.text,
        received_from: input.received_from,
        received_at: input.received_at,
        created_by: ctx.userId,
      })
      .select()
      .single()

    if (error) {
      // Best-effort cleanup des photos uploadées si insert échoue
      if (input.photos.length > 0) {
        await admin.storage.from('animal-photos').remove(input.photos.map((p) => p.path))
      }
      return { error: error.message }
    }

    logActivity({
      action: 'create',
      entityType: 'animal_news',
      entityId: (news as AnimalNews).id,
      entityName: `Nouvelle de ${animal.name}`,
      parentType: 'animal',
      parentId: input.animal_id,
    })

    revalidatePath('/nouvelles')
    revalidatePath(`/animals/${input.animal_id}`)
    return { data: news as AnimalNews }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function deleteAnimalNews(id: string) {
  try {
    const ctx = await requirePermission('view_animal_news')
    const admin = createAdminClient()

    const { data: news } = await admin
      .from('animal_news')
      .select('*')
      .eq('id', id)
      .eq('establishment_id', ctx.establishmentId)
      .single()

    if (!news) return { error: 'Nouvelle introuvable' }

    const typed = news as AnimalNews

    // Cleanup photos in storage
    const paths = (typed.photos || []).map((p) => p.path).filter(Boolean)
    if (paths.length > 0) {
      await admin.storage.from('animal-photos').remove(paths)
    }

    const { error } = await admin
      .from('animal_news')
      .delete()
      .eq('id', id)
      .eq('establishment_id', ctx.establishmentId)

    if (error) return { error: error.message }

    logActivity({
      action: 'delete',
      entityType: 'animal_news',
      entityId: id,
    })

    revalidatePath('/nouvelles')
    revalidatePath(`/animals/${typed.animal_id}`)
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/**
 * Marque les nouvelles comme publiées. Si mosaicTitle fourni, crée la mosaïque
 * et lie toutes les nouvelles à elle. Sinon, c'est une publication solo (1 ID).
 */
export async function markNewsAsPosted(params: {
  newsIds: string[]
  mosaicTitle?: string | null
  generatedImageUrl?: string | null
}) {
  try {
    const ctx = await requirePermission('view_animal_news')
    const admin = createAdminClient()

    if (params.newsIds.length === 0) return { error: 'Aucune nouvelle sélectionnée' }

    // Vérifier que toutes les news appartiennent à l'établissement
    const { data: existing, error: checkErr } = await admin
      .from('animal_news')
      .select('id, establishment_id, animal_id')
      .in('id', params.newsIds)

    if (checkErr) return { error: checkErr.message }
    if (!existing || existing.length !== params.newsIds.length) {
      return { error: 'Certaines nouvelles sont introuvables' }
    }
    for (const e of existing as { establishment_id: string }[]) {
      if (e.establishment_id !== ctx.establishmentId) {
        return { error: 'Nouvelles hors de votre établissement' }
      }
    }

    const now = new Date().toISOString()
    let mosaicId: string | null = null

    if (params.newsIds.length > 1) {
      // Création de la mosaïque
      const { data: mosaic, error: mErr } = await admin
        .from('animal_news_mosaics')
        .insert({
          establishment_id: ctx.establishmentId,
          news_ids: params.newsIds,
          title: params.mosaicTitle ?? null,
          generated_image_url: params.generatedImageUrl ?? null,
          posted_at: now,
          created_by: ctx.userId,
        })
        .select()
        .single()

      if (mErr) return { error: mErr.message }
      mosaicId = (mosaic as AnimalNewsMosaic).id
    }

    const { error: updErr } = await admin
      .from('animal_news')
      .update({
        posted_at: now,
        posted_in_mosaic_id: mosaicId,
      })
      .in('id', params.newsIds)

    if (updErr) return { error: updErr.message }

    logActivity({
      action: 'update',
      entityType: 'animal_news',
      details: { posted: params.newsIds.length, mosaic_id: mosaicId },
    })

    revalidatePath('/nouvelles')
    return { success: true, mosaicId }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
