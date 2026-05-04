import { sendEmail } from './client'
import { SDA_NAVY, SDA_TEAL, SDA_ORANGE } from '@/lib/pdf/sda-brand'
import type { AstreinteReportData } from '@/lib/pdf/astreinte-report-template'

const FOURRIERE_EMAIL = 'fourriere@sda-nord.com'

const INTERVENTION_TYPE_LABELS: Record<string, string> = {
  divagation: 'divagation',
  dangerous: 'animal dangereux',
  requisition: 'réquisition',
  veterinary_emergency: 'urgence vétérinaire',
}

const OUTCOME_LABELS: Record<string, string> = {
  animal_recovered: 'Animal pris en charge',
  not_found: 'Animal non trouvé',
  refused: 'Prise en charge refusée',
  deceased: 'Animal décédé',
  transferred_owner: 'Restitué au propriétaire',
  other: 'Autre',
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  })
}

function buildHtml(data: AstreinteReportData): string {
  const interventionLabel = INTERVENTION_TYPE_LABELS[data.interventionType] ?? data.interventionType
  const outcomeLabel = data.outcome ? OUTCOME_LABELS[data.outcome] ?? data.outcome : '—'

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:'Helvetica Neue',Arial,sans-serif;background:#f4f7f8;color:${SDA_NAVY};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f8;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <tr><td style="padding:24px 28px;border-bottom:2px solid ${SDA_NAVY};">
          <div style="font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:${SDA_TEAL};font-weight:700;">SDA d'Estourmel</div>
          <div style="font-size:22px;font-weight:800;color:${SDA_NAVY};margin-top:4px;">Compte-rendu d'intervention</div>
          <div style="font-size:13px;color:#6b7f96;margin-top:2px;">${data.ticketNumber}</div>
        </td></tr>
        <tr><td style="padding:24px 28px;">
          <p style="margin:0 0 14px;font-size:14px;line-height:1.55;">Bonjour${data.declarantName ? ' ' + data.declarantName : ''},</p>
          <p style="margin:0 0 14px;font-size:14px;line-height:1.55;">
            Suite à votre signalement (${interventionLabel}) reçu le ${fmtDate(data.createdAt)},
            l'équipe d'astreinte de la SDA est intervenue. Vous trouverez en pièce jointe le
            <strong>compte-rendu détaillé</strong> de l'intervention.
          </p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;border:1px solid #d9e6ed;border-radius:6px;">
            <tr><td style="padding:14px 16px;font-size:13px;line-height:1.6;">
              <strong style="color:${SDA_TEAL};text-transform:uppercase;letter-spacing:1px;font-size:10px;">Synthèse</strong><br/>
              <strong>Issue :</strong> ${outcomeLabel}<br/>
              <strong>Intervenu le :</strong> ${fmtDate(data.onSiteAt)}<br/>
              <strong>Terminé le :</strong> ${fmtDate(data.completedAt)}
              ${data.agentName ? `<br/><strong>Agent :</strong> ${data.agentName}` : ''}
            </td></tr>
          </table>

          <p style="margin:0 0 14px;font-size:14px;line-height:1.55;">
            Pour toute question ou information complémentaire, vous pouvez répondre à ce mail
            ou contacter la fourrière SDA à
            <a href="mailto:${FOURRIERE_EMAIL}" style="color:${SDA_TEAL};">${FOURRIERE_EMAIL}</a>.
          </p>

          <p style="margin:18px 0 0;font-size:14px;line-height:1.55;">
            Merci pour votre vigilance et votre signalement.<br/>
            <em style="color:#6b7f96;">L'équipe SDA</em>
          </p>
        </td></tr>
        <tr><td style="background:#fafbfc;padding:14px 28px;border-top:1px solid #d9e6ed;font-size:11px;color:#6b7f96;text-align:center;">
          Société de Défense des Animaux du Nord — 11 route nationale, 59400 Estourmel<br/>
          <a href="https://astreinte.sda-nord.com" style="color:${SDA_ORANGE};">astreinte.sda-nord.com</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

export interface SendAstreinteReportParams {
  data: AstreinteReportData
  pdfBuffer: Buffer
  pdfFilename: string
}

export async function sendAstreinteReport(params: SendAstreinteReportParams): Promise<{ messageId: string; recipients: string[] }> {
  const { data, pdfBuffer, pdfFilename } = params
  const recipients = [data.declarantEmail]
  const html = buildHtml(data)

  const result = await sendEmail({
    to: data.declarantEmail,
    toName: data.declarantName ?? undefined,
    cc: FOURRIERE_EMAIL,
    subject: `Compte-rendu intervention SDA — ${data.ticketNumber}`,
    html,
    fromName: 'SDA Astreinte',
    replyTo: FOURRIERE_EMAIL,
    attachments: [
      {
        filename: pdfFilename,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  })

  return { messageId: result.messageId, recipients: [...recipients, FOURRIERE_EMAIL] }
}
