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

// ---------------------------------------------------------------------------
// Graph API helpers
// ---------------------------------------------------------------------------

/** POST to the Graph API and return parsed JSON, propagating errors */
async function graphPost(endpoint: string, body: Record<string, unknown>): Promise<{ data: Record<string, unknown>; error?: string }> {
  const res = await fetch(`${GRAPH_API_BASE}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (data.error) return { data, error: data.error.message }
  return { data }
}

/** Publish an Instagram media container (shared by all IG post types) */
async function publishInstagramContainer(
  instagramAccountId: string,
  containerId: string,
  accessToken: string
): Promise<InstagramPublishResult> {
  const { data, error } = await graphPost(`${instagramAccountId}/media_publish`, {
    creation_id: containerId,
    access_token: accessToken,
  })
  if (error) return { error }
  return { mediaId: data.id as string }
}

/** Poll for Instagram media container status until FINISHED */
async function waitForInstagramProcessing(
  containerId: string,
  accessToken: string
): Promise<{ error?: string }> {
  for (let i = 0; i < 30; i++) {
    await new Promise((resolve) => setTimeout(resolve, 5000))

    const statusRes = await fetch(
      `${GRAPH_API_BASE}/${containerId}?fields=status_code&access_token=${accessToken}`
    )
    const statusData = await statusRes.json()

    if (statusData.status_code === 'FINISHED') return {}
    if (statusData.status_code === 'ERROR') {
      return { error: 'Erreur lors du traitement de la video par Instagram' }
    }
  }
  return { error: 'Timeout: la video n\'a pas ete traitee par Instagram dans le delai imparti' }
}

// ---------------------------------------------------------------------------
// Facebook publishing sub-functions
// ---------------------------------------------------------------------------

async function publishFacebookVideo(pageId: string, accessToken: string, message: string, videoUrl: string): Promise<FacebookPublishResult> {
  const { data, error } = await graphPost(`${pageId}/videos`, {
    file_url: videoUrl,
    description: message,
    access_token: accessToken,
  })
  if (error) return { error }
  return { postId: data.id as string }
}

async function publishFacebookAlbum(pageId: string, accessToken: string, message: string, photoUrls: string[]): Promise<FacebookPublishResult> {
  const photoIds: string[] = []
  for (const url of photoUrls) {
    const { data, error } = await graphPost(`${pageId}/photos`, {
      url,
      published: false,
      access_token: accessToken,
    })
    if (error) return { error }
    photoIds.push(data.id as string)
  }

  const attachedMedia = photoIds.map((id) => ({ media_fbid: id }))
  const { data, error } = await graphPost(`${pageId}/feed`, {
    message,
    attached_media: attachedMedia,
    access_token: accessToken,
  })
  if (error) return { error }
  return { postId: data.id as string }
}

async function publishFacebookSinglePhoto(pageId: string, accessToken: string, message: string, photoUrl: string): Promise<FacebookPublishResult> {
  const { data, error } = await graphPost(`${pageId}/photos`, {
    url: photoUrl,
    message,
    access_token: accessToken,
  })
  if (error) return { error }
  return { postId: data.id as string }
}

async function publishFacebookText(pageId: string, accessToken: string, message: string): Promise<FacebookPublishResult> {
  const { data, error } = await graphPost(`${pageId}/feed`, {
    message,
    access_token: accessToken,
  })
  if (error) return { error }
  return { postId: data.id as string }
}

// ---------------------------------------------------------------------------
// Instagram publishing sub-functions
// ---------------------------------------------------------------------------

async function publishInstagramReel(accountId: string, accessToken: string, caption: string, videoUrl: string): Promise<InstagramPublishResult> {
  const { data, error } = await graphPost(`${accountId}/media`, {
    media_type: 'REELS',
    video_url: videoUrl,
    caption,
    access_token: accessToken,
  })
  if (error) return { error }

  const processingResult = await waitForInstagramProcessing(data.id as string, accessToken)
  if (processingResult.error) return { error: processingResult.error }

  return publishInstagramContainer(accountId, data.id as string, accessToken)
}

async function publishInstagramCarousel(accountId: string, accessToken: string, caption: string, photoUrls: string[]): Promise<InstagramPublishResult> {
  const itemIds: string[] = []
  for (const url of photoUrls) {
    const { data, error } = await graphPost(`${accountId}/media`, {
      image_url: url,
      is_carousel_item: true,
      access_token: accessToken,
    })
    if (error) return { error }
    itemIds.push(data.id as string)
  }

  const { data: carouselData, error: carouselError } = await graphPost(`${accountId}/media`, {
    media_type: 'CAROUSEL',
    children: itemIds,
    caption,
    access_token: accessToken,
  })
  if (carouselError) return { error: carouselError }

  return publishInstagramContainer(accountId, carouselData.id as string, accessToken)
}

async function publishInstagramSingleImage(accountId: string, accessToken: string, caption: string, imageUrl: string): Promise<InstagramPublishResult> {
  const { data, error } = await graphPost(`${accountId}/media`, {
    image_url: imageUrl,
    caption,
    access_token: accessToken,
  })
  if (error) return { error }

  return publishInstagramContainer(accountId, data.id as string, accessToken)
}

// ---------------------------------------------------------------------------
// Main exports
// ---------------------------------------------------------------------------

export async function publishToFacebook({
  pageId,
  accessToken,
  message,
  photoUrls,
  videoUrl,
}: FacebookPublishParams): Promise<FacebookPublishResult> {
  try {
    if (videoUrl) return await publishFacebookVideo(pageId, accessToken, message, videoUrl)
    if (photoUrls?.length && photoUrls.length > 1) return await publishFacebookAlbum(pageId, accessToken, message, photoUrls)
    if (photoUrls?.length === 1) return await publishFacebookSinglePhoto(pageId, accessToken, message, photoUrls[0])
    return await publishFacebookText(pageId, accessToken, message)
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
    if (videoUrl) return await publishInstagramReel(instagramAccountId, accessToken, caption, videoUrl)
    if (photoUrls?.length && photoUrls.length > 1) return await publishInstagramCarousel(instagramAccountId, accessToken, caption, photoUrls)
    if (photoUrls?.length === 1) return await publishInstagramSingleImage(instagramAccountId, accessToken, caption, photoUrls[0])
    return { error: 'Instagram necessite au moins une image ou une video' }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
