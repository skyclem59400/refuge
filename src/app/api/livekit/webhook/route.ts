import { NextRequest } from 'next/server'
import { WebhookReceiver } from 'livekit-server-sdk'
import { createClient } from '@supabase/supabase-js'

const receiver = new WebhookReceiver(
  process.env.LIVEKIT_API_KEY!,
  process.env.LIVEKIT_API_SECRET!
)

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const authorization = request.headers.get('Authorization')

    if (!authorization) {
      return Response.json(
        { error: 'Authorization header manquant' },
        { status: 401 }
      )
    }

    // Verify webhook signature
    const event = await receiver.receive(body, authorization)

    if (event.event === 'room_finished') {
      const roomName = event.room?.name

      if (roomName) {
        const supabase = getSupabaseAdmin()

        await supabase
          .from('call_logs')
          .update({
            status: 'completed',
            ended_at: new Date().toISOString(),
          })
          .eq('livekit_room_name', roomName)
          .eq('status', 'in_progress')
      }
    }

    return Response.json({ received: true })
  } catch (e) {
    console.error('[LiveKit Webhook] Error:', e)
    return Response.json(
      { error: 'Webhook invalide' },
      { status: 400 }
    )
  }
}
