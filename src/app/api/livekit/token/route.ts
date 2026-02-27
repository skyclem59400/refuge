import { NextRequest } from 'next/server'
import { AccessToken } from 'livekit-server-sdk'

export async function POST(request: NextRequest) {
  try {
    const { roomName, participantName } = await request.json() as {
      roomName?: string
      participantName?: string
    }

    if (!roomName || !participantName) {
      return Response.json(
        { error: 'roomName et participantName sont requis' },
        { status: 400 }
      )
    }

    const apiKey = process.env.LIVEKIT_API_KEY
    const apiSecret = process.env.LIVEKIT_API_SECRET

    if (!apiKey || !apiSecret) {
      return Response.json(
        { error: 'Configuration LiveKit manquante' },
        { status: 500 }
      )
    }

    const token = new AccessToken(apiKey, apiSecret, {
      identity: participantName,
    })

    token.addGrant({
      roomJoin: true,
      room: roomName,
    })

    const jwt = await token.toJwt()

    return Response.json({ token: jwt })
  } catch (e) {
    console.error('[LiveKit Token] Error:', e)
    return Response.json(
      { error: 'Erreur lors de la generation du token' },
      { status: 500 }
    )
  }
}
