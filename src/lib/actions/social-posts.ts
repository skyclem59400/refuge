'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireEstablishment, requirePermission } from '@/lib/establishment/permissions'
import type {
  SocialPostType,
  SocialPlatform,
  SocialPostStatus,
} from '@/lib/types/database'

// ============================================
// Read actions (use createAdminClient)
// ============================================

export async function getAnimalPosts(animalId: string) {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('social_posts')
      .select('*, animals!inner(id, name, establishment_id)')
      .eq('animals.establishment_id', establishmentId)
      .eq('animal_id', animalId)
      .order('created_at', { ascending: false })

    if (error) {
      return { error: error.message }
    }

    return { data }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ============================================
// Write actions (use createClient)
// ============================================

export async function createPost(data: {
  animal_id: string
  type: SocialPostType
  platform: SocialPlatform
  content: string
  photo_urls?: string[]
}) {
  try {
    const { userId } = await requirePermission('manage_posts')
    const supabase = await createClient()

    const { data: post, error } = await supabase
      .from('social_posts')
      .insert({
        animal_id: data.animal_id,
        type: data.type,
        platform: data.platform,
        content: data.content,
        photo_urls: data.photo_urls ?? [],
        status: 'draft',
        created_by: userId,
      })
      .select()
      .single()

    if (error) {
      return { error: error.message }
    }

    revalidatePath(`/animals/${data.animal_id}`)
    return { data: post }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function updatePost(id: string, data: {
  content?: string
  platform?: SocialPlatform
  status?: SocialPostStatus
  photo_urls?: string[]
}) {
  try {
    await requirePermission('manage_posts')
    const supabase = await createClient()

    const { data: post, error } = await supabase
      .from('social_posts')
      .update(data)
      .eq('id', id)
      .select('*, animals!inner(id)')
      .single()

    if (error) {
      return { error: error.message }
    }

    revalidatePath(`/animals/${post.animals.id}`)
    return { data: post }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function deletePost(id: string) {
  try {
    await requirePermission('manage_posts')
    const supabase = await createClient()

    // Get animal_id before deleting for revalidation
    const { data: post, error: fetchError } = await supabase
      .from('social_posts')
      .select('animal_id')
      .eq('id', id)
      .single()

    if (fetchError || !post) {
      return { error: 'Publication introuvable' }
    }

    const { error } = await supabase
      .from('social_posts')
      .delete()
      .eq('id', id)

    if (error) {
      return { error: error.message }
    }

    revalidatePath(`/animals/${post.animal_id}`)
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function publishPost(id: string) {
  try {
    await requirePermission('manage_posts')
    const supabase = await createClient()

    const { data: post, error } = await supabase
      .from('social_posts')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*, animals!inner(id)')
      .single()

    if (error) {
      return { error: error.message }
    }

    revalidatePath(`/animals/${post.animals.id}`)
    return { data: post }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function archivePost(id: string) {
  try {
    await requirePermission('manage_posts')
    const supabase = await createClient()

    const { data: post, error } = await supabase
      .from('social_posts')
      .update({ status: 'archived' })
      .eq('id', id)
      .select('*, animals!inner(id)')
      .single()

    if (error) {
      return { error: error.message }
    }

    revalidatePath(`/animals/${post.animals.id}`)
    return { data: post }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
