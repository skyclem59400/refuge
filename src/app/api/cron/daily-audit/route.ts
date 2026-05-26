import { NextResponse, type NextRequest } from 'next/server'
import { buildDailyAuditPdf, markAuditRunSent } from '@/lib/pdf/daily-audit-pdf'
import { sendEmail } from '@/lib/email/client'

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
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const run = await buildDailyAuditPdf({ triggerSource: 'cron' })

    const dateLabel = new Date(run.auditDate + 'T00:00:00').toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })

    const subject = run.criticalCount > 0
      ? `🚨 Audit Optimus du ${dateLabel} — ${run.criticalCount} alerte${run.criticalCount > 1 ? 's' : ''} critique${run.criticalCount > 1 ? 's' : ''}`
      : `Audit Optimus du ${dateLabel}`

    const html = `
      <p>Bonjour Clément,</p>
      <p>Voici l'audit de l'activité Optimus pour le <strong>${dateLabel}</strong>.</p>
      ${run.aiAnalysis
        ? `<p>📊 L'analyse IA (Claude Haiku 4.5) figure en page 1 du PDF avec ses recommandations.</p>`
        : ''}
      ${run.criticalCount > 0
        ? `<p style="color:#dc2626;"><strong>⚠️ ${run.criticalCount} alerte${run.criticalCount > 1 ? 's' : ''} critique${run.criticalCount > 1 ? 's' : ''}</strong> à traiter en priorité.</p>`
        : `<p>Aucune alerte critique aujourd'hui. ✓</p>`}
      <p>Le détail (engagement équipe, soins, sorties, CRA, dossiers à compléter, procédures judiciaires) est dans le PDF en pièce jointe.</p>
      <p>Tu peux aussi consulter l'historique des audits dans <a href="https://sda.optimus-services.fr/etablissement/audit-quotidien">/etablissement/audit-quotidien</a>.</p>
      <p style="margin-top:24px;color:#94a3b8;font-size:12px;">Rapport généré automatiquement par Optimus.</p>
    `

    let sendError: string | null = null
    try {
      await sendEmail({
        to: RECIPIENT_EMAIL,
        toName: RECIPIENT_NAME,
        subject,
        html,
        attachments: [{ filename: run.filename, content: run.buffer, contentType: 'application/pdf' }],
      })
    } catch (e) {
      sendError = (e as Error).message
    }
    await markAuditRunSent(run.runId, RECIPIENT_EMAIL, sendError)

    return NextResponse.json({
      ok: !sendError,
      runId: run.runId,
      auditDate: run.auditDate,
      criticalCount: run.criticalCount,
      sentTo: RECIPIENT_EMAIL,
      sendError,
      aiUsage: run.aiUsage,
    })
  } catch (e) {
    console.error('daily-audit cron error:', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
