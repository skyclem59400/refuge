'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireEstablishment, requirePermission } from '@/lib/establishment/permissions'
import type {
  SocialPostType,
  SocialPlatform,
  SocialPostStatus,
  MetaConnection,
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
    const supabase = createAdminClient()

    // Fetch animal's establishment_id
    const { data: animalData } = await supabase
      .from('animals')
      .select('establishment_id')
      .eq('id', data.animal_id)
      .single()

    const { data: post, error } = await supabase
      .from('social_posts')
      .insert({
        establishment_id: animalData?.establishment_id,
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
    revalidatePath('/publications')
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
    const supabase = createAdminClient()

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
    const supabase = createAdminClient()

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
    const supabase = createAdminClient()

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
    const supabase = createAdminClient()

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

// ============================================
// Social Media Publishing Module
// ============================================

export async function getAllPosts(filters?: {
  status?: SocialPostStatus
  platform?: SocialPlatform
  type?: SocialPostType
}) {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    let query = supabase
      .from('social_posts')
      .select('*, animals(id, name, species, photo_url)')
      .eq('establishment_id', establishmentId)
      .order('created_at', { ascending: false })

    if (filters?.status) query = query.eq('status', filters.status)
    if (filters?.platform) query = query.eq('platform', filters.platform)
    if (filters?.type) query = query.eq('type', filters.type)

    const { data, error } = await query
    if (error) return { error: error.message }
    return { data }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function getScheduledPosts(startDate: string, endDate: string) {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('social_posts')
      .select('*, animals(id, name, species, photo_url)')
      .eq('establishment_id', establishmentId)
      .in('status', ['scheduled', 'published', 'publishing', 'failed'])
      .gte('scheduled_at', startDate)
      .lte('scheduled_at', endDate)
      .order('scheduled_at', { ascending: true })

    if (error) return { error: error.message }
    return { data }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function createPostEnhanced(data: {
  animal_id?: string | null
  type: SocialPostType
  platform: SocialPlatform
  content: string
  content_facebook?: string | null
  content_instagram?: string | null
  photo_urls?: string[]
  video_url?: string | null
  scheduled_at?: string | null
}) {
  try {
    const { userId, establishmentId } = await requirePermission('manage_posts')
    const supabase = createAdminClient()

    const status: SocialPostStatus = data.scheduled_at ? 'scheduled' : 'draft'

    const { data: post, error } = await supabase
      .from('social_posts')
      .insert({
        establishment_id: establishmentId,
        animal_id: data.animal_id || null,
        type: data.type,
        platform: data.platform,
        content: data.content,
        content_facebook: data.content_facebook || null,
        content_instagram: data.content_instagram || null,
        photo_urls: data.photo_urls ?? [],
        video_url: data.video_url || null,
        status,
        scheduled_at: data.scheduled_at || null,
        created_by: userId,
      })
      .select()
      .single()

    if (error) return { error: error.message }

    revalidatePath('/publications')
    if (data.animal_id) revalidatePath(`/animals/${data.animal_id}`)
    return { data: post }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function schedulePost(id: string, scheduledAt: string) {
  try {
    await requirePermission('manage_posts')
    const supabase = createAdminClient()

    const { data: post, error } = await supabase
      .from('social_posts')
      .update({
        status: 'scheduled' as SocialPostStatus,
        scheduled_at: scheduledAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) return { error: error.message }

    revalidatePath('/publications')
    return { data: post }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function unschedulePost(id: string) {
  try {
    await requirePermission('manage_posts')
    const supabase = createAdminClient()

    const { data: post, error } = await supabase
      .from('social_posts')
      .update({
        status: 'draft' as SocialPostStatus,
        scheduled_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) return { error: error.message }

    revalidatePath('/publications')
    return { data: post }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function retryPost(id: string) {
  try {
    await requirePermission('manage_posts')
    const supabase = createAdminClient()

    const { data: post, error } = await supabase
      .from('social_posts')
      .update({
        status: 'scheduled' as SocialPostStatus,
        publish_error: null,
        scheduled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) return { error: error.message }

    revalidatePath('/publications')
    return { data: post }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function publishPostNow(id: string) {
  try {
    const { establishmentId } = await requirePermission('manage_posts')
    const supabase = createAdminClient()

    const { data: post, error: postError } = await supabase
      .from('social_posts')
      .select('*')
      .eq('id', id)
      .eq('establishment_id', establishmentId)
      .single()

    if (postError || !post) return { error: 'Publication introuvable' }

    const { data: connection } = await supabase
      .from('meta_connections')
      .select('*')
      .eq('establishment_id', establishmentId)
      .maybeSingle()

    if (!connection) return { error: 'Aucune connexion Meta configuree. Configurez vos comptes Facebook/Instagram dans les parametres.' }

    // Mark as publishing
    await supabase.from('social_posts').update({ status: 'publishing', updated_at: new Date().toISOString() }).eq('id', id)

    try {
      const { publishToFacebook, publishToInstagram } = await import('@/lib/meta-api')

      let fbPostId: string | null = null
      let igMediaId: string | null = null
      const fbContent = post.content_facebook || post.content
      const igContent = post.content_instagram || post.content

      if (post.platform === 'facebook' || post.platform === 'both') {
        const result = await publishToFacebook({
          pageId: connection.facebook_page_id,
          accessToken: connection.facebook_page_access_token,
          message: fbContent,
          photoUrls: post.photo_urls,
          videoUrl: post.video_url,
        })
        if (result.error) throw new Error(`Facebook: ${result.error}`)
        fbPostId = result.postId || null
      }

      if ((post.platform === 'instagram' || post.platform === 'both') && connection.instagram_business_account_id) {
        const result = await publishToInstagram({
          instagramAccountId: connection.instagram_business_account_id,
          accessToken: connection.facebook_page_access_token,
          caption: igContent,
          photoUrls: post.photo_urls,
          videoUrl: post.video_url,
        })
        if (result.error) throw new Error(`Instagram: ${result.error}`)
        igMediaId = result.mediaId || null
      }

      const { error: updateError } = await supabase.from('social_posts').update({
        status: 'published',
        published_at: new Date().toISOString(),
        meta_fb_post_id: fbPostId,
        meta_ig_media_id: igMediaId,
        publish_error: null,
        updated_at: new Date().toISOString(),
      }).eq('id', id)

      if (updateError) return { error: updateError.message }

      revalidatePath('/publications')
      return { success: true }
    } catch (publishError) {
      const errorMsg = publishError instanceof Error ? publishError.message : String(publishError)
      await supabase.from('social_posts').update({
        status: 'failed',
        publish_error: errorMsg,
        updated_at: new Date().toISOString(),
      }).eq('id', id)

      revalidatePath('/publications')
      return { error: errorMsg }
    }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
