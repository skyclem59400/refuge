const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0'

interface FacebookPublishParams {
  pageId: string
  accessToken: string
  message: string
  photoUrls?: string[]
  videoUrl?: string | null
}

interface FacebookPublishResult {
  postId?: string
  error?: string
}

interface InstagramPublishParams {
  instagramAccountId: string
  accessToken: string
  caption: string
  photoUrls?: string[]
  videoUrl?: string | null
}

interface InstagramPublishResult {
  mediaId?: string
  error?: string
}

export async function publishToFacebook({
  pageId,
  accessToken,
  message,
  photoUrls,
  videoUrl,
}: FacebookPublishParams): Promise<FacebookPublishResult> {
  try {
    // Video post
    if (videoUrl) {
      const res = await fetch(`${GRAPH_API_BASE}/${pageId}/videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_url: videoUrl,
          description: message,
          access_token: accessToken,
        }),
      })
      const data = await res.json()
      if (data.error) return { error: data.error.message }
      return { postId: data.id }
    }

    // Multi-photo album post
    if (photoUrls && photoUrls.length > 1) {
      // Step 1: Upload each photo as unpublished
      const photoIds: string[] = []
      for (const url of photoUrls) {
        const res = await fetch(`${GRAPH_API_BASE}/${pageId}/photos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url,
            published: false,
            access_token: accessToken,
          }),
        })
        const data = await res.json()
        if (data.error) return { error: data.error.message }
        photoIds.push(data.id)
      }

      // Step 2: Create the post with attached media
      const attachedMedia = photoIds.map((id) => ({ media_fbid: id }))
      const res = await fetch(`${GRAPH_API_BASE}/${pageId}/feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          attached_media: attachedMedia,
          access_token: accessToken,
        }),
      })
      const data = await res.json()
      if (data.error) return { error: data.error.message }
      return { postId: data.id }
    }

    // Single photo post
    if (photoUrls && photoUrls.length === 1) {
      const res = await fetch(`${GRAPH_API_BASE}/${pageId}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: photoUrls[0],
          message,
          access_token: accessToken,
        }),
      })
      const data = await res.json()
      if (data.error) return { error: data.error.message }
      return { postId: data.id }
    }

    // Text-only post
    const res = await fetch(`${GRAPH_API_BASE}/${pageId}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        access_token: accessToken,
      }),
    })
    const data = await res.json()
    if (data.error) return { error: data.error.message }
    return { postId: data.id }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function publishToInstagram({
  instagramAccountId,
  accessToken,
  caption,
  photoUrls,
  videoUrl,
}: InstagramPublishParams): Promise<InstagramPublishResult> {
  try {
    // Reels video post
    if (videoUrl) {
      // Step 1: Create media container
      const containerRes = await fetch(`${GRAPH_API_BASE}/${instagramAccountId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_type: 'REELS',
          video_url: videoUrl,
          caption,
          access_token: accessToken,
        }),
      })
      const containerData = await containerRes.json()
      if (containerData.error) return { error: containerData.error.message }

      const containerId = containerData.id

      // Step 2: Poll for status until FINISHED (max 30 attempts, 5s interval)
      for (let i = 0; i < 30; i++) {
        await new Promise((resolve) => setTimeout(resolve, 5000))

        const statusRes = await fetch(
          `${GRAPH_API_BASE}/${containerId}?fields=status_code&access_token=${accessToken}`
        )
        const statusData = await statusRes.json()

        if (statusData.status_code === 'FINISHED') break
        if (statusData.status_code === 'ERROR') {
          return { error: 'Erreur lors du traitement de la video par Instagram' }
        }
        if (i === 29) {
          return { error: 'Timeout: la video n\'a pas ete traitee par Instagram dans le delai imparti' }
        }
      }

      // Step 3: Publish
      const publishRes = await fetch(`${GRAPH_API_BASE}/${instagramAccountId}/media_publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: containerId,
          access_token: accessToken,
        }),
      })
      const publishData = await publishRes.json()
      if (publishData.error) return { error: publishData.error.message }
      return { mediaId: publishData.id }
    }

    // Carousel post (multiple images)
    if (photoUrls && photoUrls.length > 1) {
      // Step 1: Create individual item containers
      const itemIds: string[] = []
      for (const url of photoUrls) {
        const res = await fetch(`${GRAPH_API_BASE}/${instagramAccountId}/media`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_url: url,
            is_carousel_item: true,
            access_token: accessToken,
          }),
        })
        const data = await res.json()
        if (data.error) return { error: data.error.message }
        itemIds.push(data.id)
      }

      // Step 2: Create carousel container
      const carouselRes = await fetch(`${GRAPH_API_BASE}/${instagramAccountId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_type: 'CAROUSEL',
          children: itemIds,
          caption,
          access_token: accessToken,
        }),
      })
      const carouselData = await carouselRes.json()
      if (carouselData.error) return { error: carouselData.error.message }

      // Step 3: Publish carousel
      const publishRes = await fetch(`${GRAPH_API_BASE}/${instagramAccountId}/media_publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: carouselData.id,
          access_token: accessToken,
        }),
      })
      const publishData = await publishRes.json()
      if (publishData.error) return { error: publishData.error.message }
      return { mediaId: publishData.id }
    }

    // Single image post
    if (photoUrls && photoUrls.length === 1) {
      // Step 1: Create media container
      const containerRes = await fetch(`${GRAPH_API_BASE}/${instagramAccountId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: photoUrls[0],
          caption,
          access_token: accessToken,
        }),
      })
      const containerData = await containerRes.json()
      if (containerData.error) return { error: containerData.error.message }

      // Step 2: Publish
      const publishRes = await fetch(`${GRAPH_API_BASE}/${instagramAccountId}/media_publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: containerData.id,
          access_token: accessToken,
        }),
      })
      const publishData = await publishRes.json()
      if (publishData.error) return { error: publishData.error.message }
      return { mediaId: publishData.id }
    }

    return { error: 'Instagram necessite au moins une image ou une video' }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
