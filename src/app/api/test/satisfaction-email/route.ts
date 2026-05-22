import { NextResponse, type NextRequest } from 'next/server'
import { sendSatisfactionSurveyEmail } from '@/lib/email/satisfaction-survey'
import type { SatisfactionSurveyKind } from '@/lib/types/database'

/**
 * Endpoint de TEST pour envoyer un mail satisfaction NPS de démo
 * (rendu réel chez Gmail/Outlook pour valider charte + délivrabilité).
 *
 * Protégé par le même CRON_SECRET que /api/cron/satisfaction.
 *
 * Usage :
 *   POST /api/test/satisfaction-email?kind=adoption&to=clement@gmail.com
 *   Header: Authorization: Bearer <CRON_SECRET>
 *
 * Crée un token bidon "test-preview" — le lien dans le mail mènera vers une
 * page d'erreur "Lien introuvable" (normal, c'est juste pour visualiser).
 */
export async function POST(req: NextRequest) {
  return handle(req)
}

export async function GET(req: NextRequest) {
  return handle(req)
}

async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET non configuré' }, { status: 500 })
  }
  const authHeader = req.headers.get('authorization') || ''
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const kind = (url.searchParams.get('kind') || 'adoption') as SatisfactionSurveyKind
  const to = url.searchParams.get('to')
  const toName = url.searchParams.get('toName') || 'Clément (test)'
  const animalName = url.searchParams.get('animalName') || 'Pixel'

  if (!to || !to.includes('@')) {
    return NextResponse.json({ error: 'Paramètre ?to=email manquant ou invalide' }, { status: 400 })
  }
  if (!['adoption', 'donation', 'foster'].includes(kind)) {
    return NextResponse.json({ error: 'kind doit être adoption | donation | foster' }, { status: 400 })
  }

  try {
    const result = await sendSatisfactionSurveyEmail({
      to,
      toName,
      kind,
      token: 'test-preview-' + Date.now(),
      establishmentName: 'Refuge SDA d\'Estourmel',
      animalName: kind === 'donation' ? null : animalName,
    })
    return NextResponse.json({
      ok: true,
      messageId: result.messageId,
      sentTo: to,
      kind,
      note: 'Le lien dans le mail mènera vers une page "Lien introuvable" — c\'est normal, ce token est bidon.',
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
