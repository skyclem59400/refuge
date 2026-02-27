'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/establishment/permissions'

export async function uploadSocialMedia(formData: FormData) {
  try {
    const { establishmentId } = await requirePermission('manage_posts')
    const adminClient = createAdminClient()

    const file = formData.get('file') as File | null
    if (!file || !(file instanceof File)) {
      return { error: 'Aucun fichier fourni' }
    }

    const isImage = file.type.startsWith('image/')
    const isVideo = file.type.startsWith('video/')
    if (!isImage && !isVideo) {
      return { error: 'Le fichier doit etre une image ou une video' }
    }

    const maxSize = isVideo ? 50 * 1024 * 1024 : 5 * 1024 * 1024
    if (file.size > maxSize) {
      return { error: isVideo ? 'La video ne doit pas depasser 50 Mo' : 'L\'image ne doit pas depasser 5 Mo' }
    }

    const ext = file.name.split('.').pop() || (isVideo ? 'mp4' : 'jpg')
    const randomId = crypto.randomUUID()
    const path = `${establishmentId}/${randomId}.${ext}`

    const { error: uploadError } = await adminClient.storage
      .from('social-media')
      .upload(path, file, { upsert: false })

    if (uploadError) {
      return { error: 'Erreur lors de l\'upload : ' + uploadError.message }
    }

    const { data: { publicUrl } } = adminClient.storage
      .from('social-media')
      .getPublicUrl(path)

    return { data: { url: publicUrl, type: isVideo ? 'video' as const : 'image' as const } }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function deleteSocialMedia(url: string) {
  try {
    await requirePermission('manage_posts')
    const adminClient = createAdminClient()

    const urlParts = url.split('/social-media/')
    if (urlParts.length > 1) {
      const storagePath = urlParts[1].split('?')[0]
      await adminClient.storage.from('social-media').remove([storagePath])
    }

    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
