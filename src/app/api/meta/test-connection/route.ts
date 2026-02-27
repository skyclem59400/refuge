import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }

    const body = await request.json()
    const { pageId, accessToken, instagramAccountId } = body

    if (!pageId || !accessToken) {
      return NextResponse.json(
        { error: 'pageId et accessToken sont requis' },
        { status: 400 }
      )
    }

    // Test Facebook Page connection
    const fbRes = await fetch(
      `${GRAPH_API_BASE}/${pageId}?fields=name,id&access_token=${accessToken}`
    )
    const fbData = await fbRes.json()

    if (fbData.error) {
      return NextResponse.json(
        { error: `Facebook: ${fbData.error.message}` },
        { status: 400 }
      )
    }

    const result: {
      success: boolean
      facebook: { id: string; name: string }
      instagram?: { id: string; username: string }
    } = {
      success: true,
      facebook: { id: fbData.id, name: fbData.name },
    }

    // Test Instagram Business Account connection (optional)
    if (instagramAccountId) {
      const igRes = await fetch(
        `${GRAPH_API_BASE}/${instagramAccountId}?fields=name,username&access_token=${accessToken}`
      )
      const igData = await igRes.json()

      if (igData.error) {
        return NextResponse.json(
          { error: `Instagram: ${igData.error.message}` },
          { status: 400 }
        )
      }

      result.instagram = { id: igData.id, username: igData.username }
    }

    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    )
  }
}
