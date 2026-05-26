import { NextResponse, type NextRequest } from 'next/server'
import { buildDailyAuditPdf } from '@/lib/pdf/daily-audit-pdf'
import { sendEmail } from '@/lib/email/client'

/**
 * Endpoint cron quotidien — Audit equipe + PDF par mail.
 *
 * Configuration cron (cron-job.org ou pg_cron) :
 *   POST https://sda.optimus-services.fr/api/cron/daily-audit
 *   Header: Authorization: Bearer <CRON_SECRET>
 *
 * Cadence recommandee : tous les jours 7h00 heure Paris.
 *
 * Comportement :
 *   1. Calcule l'audit J-1 multi-etablissement
 *   2. Genere un PDF agrege
 *   3. Envoie le PDF a clement.scailteux@gmail.com (president SDA)
 */

const RECIPIENT_EMAIL = 'clement.scailteux@gmail.com'
const RECIPIENT_NAME = 'Clément Scailteux'

export async function POST(req: NextRequest) {
  return handleRequest(req)
}

export async function GET(req: NextRequest) {
  return handleRequest(req)
}

async function handleRequest(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET non configuré côté serveur' }, { status: 500 })
  }
  const authHeader = req.headers.get('authorization') || ''
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { buffer, filename, auditDate, criticalCount } = await buildDailyAuditPdf()

    const dateLabel = new Date(auditDate + 'T00:00:00').toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })

    const subject = criticalCount > 0
      ? `🚨 Audit Optimus du ${dateLabel} — ${criticalCount} alerte${criticalCount > 1 ? 's' : ''} critique${criticalCount > 1 ? 's' : ''}`
      : `Audit Optimus du ${dateLabel}`

    const html = `
      <p>Bonjour Clément,</p>
      <p>Voici l'audit de l'activité Optimus pour le <strong>${dateLabel}</strong>.</p>
      ${criticalCount > 0
        ? `<p style="color:#dc2626;"><strong>⚠️ ${criticalCount} alerte${criticalCount > 1 ? 's' : ''} critique${criticalCount > 1 ? 's' : ''}</strong> à traiter en priorité (audience judiciaire imminente, rappels santé très en retard, etc.).</p>`
        : `<p>Aucune alerte critique aujourd'hui. ✓</p>`}
      <p>Le détail (engagement équipe, soins, sorties, CRA, dossiers à compléter, procédures judiciaires) est dans le PDF en pièce jointe.</p>
      <p style="margin-top:24px;color:#94a3b8;font-size:12px;">Rapport généré automatiquement par Optimus.</p>
    `

    await sendEmail({
      to: RECIPIENT_EMAIL,
      toName: RECIPIENT_NAME,
      subject,
      html,
      attachments: [{ filename, content: buffer, contentType: 'application/pdf' }],
    })

    return NextResponse.json({
      ok: true,
      auditDate,
      criticalCount,
      sentTo: RECIPIENT_EMAIL,
    })
  } catch (e) {
    console.error('daily-audit cron error:', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
