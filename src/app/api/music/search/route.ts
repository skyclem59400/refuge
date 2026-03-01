import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Mood mapping for each post type
const POST_TYPE_SEARCH: Record<string, { fuzzytags: string; speed: string }> = {
  adoption: { fuzzytags: 'happy+uplifting+positive', speed: 'medium+high' },
  search_owner: { fuzzytags: 'emotional+hopeful+calm', speed: 'low+medium' },
  event: { fuzzytags: 'festive+energetic+happy', speed: 'high+veryhigh' },
  info: { fuzzytags: 'calm+corporate+ambient', speed: 'low+medium' },
  other: { fuzzytags: 'positive+ambient+happy', speed: 'medium' },
}

// Mood chips available in the UI
const MOOD_SEARCH: Record<string, string> = {
  joyeux: 'happy+uplifting',
  triste: 'sad+melancholic',
  calme: 'calm+ambient+relaxing',
  energique: 'energetic+upbeat+groovy',
  emotionnel: 'emotional+dramatic',
  festif: 'festive+party+fun',
}

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.JAMENDO_CLIENT_ID
    if (!clientId) {
      return Response.json(
        { error: 'Configuration Jamendo manquante (JAMENDO_CLIENT_ID)' },
        { status: 500 }
      )
    }

    // Verify authentication
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ error: 'Non autorise' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const postType = searchParams.get('postType') || ''
    const mood = searchParams.get('mood') || ''

    // Build Jamendo API URL
    const params = new URLSearchParams({
      client_id: clientId,
      format: 'json',
      limit: '20',
      include: 'musicinfo',
      vocalinstrumental: 'instrumental',
      order: 'relevance',
      audiodownload_allowed: 'true',
    })

    // Apply search strategy
    if (query) {
      params.set('search', query)
    } else if (mood && MOOD_SEARCH[mood]) {
      params.set('fuzzytags', MOOD_SEARCH[mood])
    } else if (postType && POST_TYPE_SEARCH[postType]) {
      const config = POST_TYPE_SEARCH[postType]
      params.set('fuzzytags', config.fuzzytags)
      params.set('speed', config.speed)
    } else {
      params.set('fuzzytags', 'positive+happy+ambient')
    }

    const jamendoUrl = `https://api.jamendo.com/v3.0/tracks/?${params.toString()}`
    console.log('[Music API] Fetching:', jamendoUrl)

    const response = await fetch(jamendoUrl)

    if (!response.ok) {
      const body = await response.text()
      console.error('[Music API] Jamendo error:', response.status, body)
      return Response.json(
        { error: `Erreur Jamendo API (${response.status})` },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log('[Music API] Results:', data.headers?.results_count ?? 0)

    // Transform to simplified format
    const tracks = (data.results || []).map((track: {
      id: string
      name: string
      artist_name: string
      duration: number
      audio: string
      audiodownload: string
      album_image: string
      musicinfo?: {
        tags?: {
          genres?: string[]
          vartags?: string[]
        }
      }
    }) => ({
      id: track.id,
      title: track.name,
      artist: track.artist_name,
      duration: track.duration,
      audioUrl: track.audio,
      downloadUrl: track.audiodownload,
      imageUrl: track.album_image,
      tags: track.musicinfo?.tags?.genres || [],
      moods: track.musicinfo?.tags?.vartags || [],
    }))

    return Response.json({ tracks })
  } catch (error) {
    console.error('Music search error:', error)
    return Response.json(
      { error: 'Erreur lors de la recherche musicale' },
      { status: 500 }
    )
  }
}
