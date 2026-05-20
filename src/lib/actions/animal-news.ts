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
  NewsCategory,
} from '@/lib/types/database'
import { SHELTERED_STATUSES, ALUMNI_STATUSES } from '@/lib/types/database'

// ============================================
// Read actions
// ============================================

/**
 * Récupère les news d'une catégorie ("sheltered" = au refuge / "alumni" = sortis),
 * avec filtres optionnels par animaux et par range de dates.
 * Plus d'inbox : toutes les news sont considérées publiées dès leur création.
 */
export async function getAnimalNewsByCategory(opts: {
  category: NewsCategory
  animalIds?: string[]
  dateFrom?: string // YYYY-MM-DD
  dateTo?: string // YYYY-MM-DD
}) {
  try {
    const ctx = await requirePermission('view_animal_news')
    const admin = createAdminClient()
    const statuses = opts.category === 'sheltered' ? SHELTERED_STATUSES : ALUMNI_STATUSES

    let query = admin
      .from('animal_news')
      .select(
        '*, animal:animals!inner(id,name,species,sex,status,exit_date,photo_url,birth_date)',
      )
      .eq('establishment_id', ctx.establishmentId)
      .in('animal.status', statuses)
      .order('received_at', { ascending: false })

    if (opts.animalIds && opts.animalIds.length > 0) {
      query = query.in('animal_id', opts.animalIds)
    }
    if (opts.dateFrom) query = query.gte('received_at', opts.dateFrom)
    if (opts.dateTo) query = query.lte('received_at', opts.dateTo)

    const { data, error } = await query

    if (error) return { error: error.message }
    return { data: (data as AnimalNewsWithAnimal[]) || [] }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/** Mosaïques publiées (uniquement côté Alumni — récap Facebook multi-animaux). */
export async function getMosaics() {
  try {
    const ctx = await requirePermission('view_animal_news')
    const admin = createAdminClient()

    const { data, error } = await admin
      .from('animal_news_mosaics')
      .select('*')
      .eq('establishment_id', ctx.establishmentId)
      .not('posted_at', 'is', null)
      .order('posted_at', { ascending: false })

    if (error) return { error: error.message }
    return { data: (data as AnimalNewsMosaic[]) || [] }
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

/** Liste les animaux éligibles à recevoir une nouvelle pour une catégorie donnée. */
export async function getAnimalsForCategory(category: NewsCategory) {
  try {
    const ctx = await requirePermission('view_animal_news')
    const admin = createAdminClient()
    const statuses = category === 'sheltered' ? SHELTERED_STATUSES : ALUMNI_STATUSES

    const { data, error } = await admin
      .from('animals')
      .select('id, name, species, sex, status, exit_date, photo_url, birth_date')
      .eq('establishment_id', ctx.establishmentId)
      .in('status', statuses)
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
  photos: AnimalNewsPhoto[]
  text: string | null
  received_from: string | null
  received_at: string // YYYY-MM-DD
}

/**
 * Ajoute une news et la publie immédiatement (plus d'inbox).
 * Synchronise les photos vers animal_photos pour qu'elles apparaissent dans
 * l'onglet Photos de la fiche animal (cf. migration 20260519d).
 */
export async function addAnimalNews(input: AddNewsInput) {
  try {
    const ctx = await requirePermission('view_animal_news')
    const admin = createAdminClient()

    const { data: animal } = await admin
      .from('animals')
      .select('id, name, establishment_id')
      .eq('id', input.animal_id)
      .eq('establishment_id', ctx.establishmentId)
      .single()

    if (!animal) return { error: 'Animal introuvable' }

    for (const p of input.photos) {
      if (!p.path.startsWith(`${ctx.establishmentId}/news/`)) {
        return { error: 'Chemin de stockage invalide pour cet établissement' }
      }
    }

    const now = new Date().toISOString()
    const { data: news, error } = await admin
      .from('animal_news')
      .insert({
        establishment_id: ctx.establishmentId,
        animal_id: input.animal_id,
        photos: input.photos,
        text: input.text,
        received_from: input.received_from,
        received_at: input.received_at,
        posted_at: now, // publication immédiate
        created_by: ctx.userId,
      })
      .select()
      .single()

    if (error) {
      if (input.photos.length > 0) {
        await admin.storage.from('animal-photos').remove(input.photos.map((p) => p.path))
      }
      return { error: error.message }
    }

    const typedNews = news as AnimalNews

    if (input.photos.length > 0) {
      const photoRows = input.photos.map((p) => ({
        animal_id: input.animal_id,
        url: p.url,
        is_primary: false,
        source_news_id: typedNews.id,
      }))
      const { error: photoErr } = await admin.from('animal_photos').insert(photoRows)
      if (photoErr) {
        console.error('Failed to sync news photos to animal_photos:', photoErr.message)
      }
    }

    logActivity({
      action: 'create',
      entityType: 'animal_news',
      entityId: typedNews.id,
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
 * Crée une mosaïque (récap Facebook combinant plusieurs news d'animaux différents).
 * Réservé au module Alumni — usage : poster hebdomadaire "Les sortis de la semaine".
 */
export async function createMosaic(params: {
  newsIds: string[]
  title?: string | null
  generatedImageUrl?: string | null
}) {
  try {
    const ctx = await requirePermission('view_animal_news')
    const admin = createAdminClient()

    if (params.newsIds.length < 2) {
      return { error: 'Une mosaïque doit contenir au moins 2 nouvelles' }
    }

    const { data: existing, error: checkErr } = await admin
      .from('animal_news')
      .select('id, establishment_id')
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
    const { data: mosaic, error: mErr } = await admin
      .from('animal_news_mosaics')
      .insert({
        establishment_id: ctx.establishmentId,
        news_ids: params.newsIds,
        title: params.title ?? null,
        generated_image_url: params.generatedImageUrl ?? null,
        posted_at: now,
        created_by: ctx.userId,
      })
      .select()
      .single()

    if (mErr) return { error: mErr.message }

    await admin
      .from('animal_news')
      .update({ posted_in_mosaic_id: (mosaic as AnimalNewsMosaic).id })
      .in('id', params.newsIds)

    logActivity({
      action: 'create',
      entityType: 'animal_news_mosaic',
      entityId: (mosaic as AnimalNewsMosaic).id,
      details: { news_count: params.newsIds.length },
    })

    revalidatePath('/nouvelles')
    return { data: mosaic as AnimalNewsMosaic }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
