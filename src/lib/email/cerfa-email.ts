import { sendEmail } from './client'
import { SDA_NAVY, SDA_TEAL, SDA_ORANGE } from '@/lib/pdf/sda-brand'
import { getClientDisplayName } from '@/lib/types/database'
import type { Donation } from '@/lib/types/database'

const REPLY_TO_EMAIL = 'contact@sda-nord.com'
const SENDER_ADDRESS = 'noreply@sda-nord.com'
const SENDER_NAME = "SDA d'Estourmel"

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  })
}

function fmtAmount(amount: number | string): string {
  const n = typeof amount === 'string' ? Number(amount) : amount
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

function buildHtml(params: {
  donorDisplayName: string
  amount: number | string
  date: string
  cerfaNumber: string | null
}): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:'Helvetica Neue',Arial,sans-serif;background:#f4f7f8;color:${SDA_NAVY};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f8;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <tr><td style="padding:24px 28px;border-bottom:2px solid ${SDA_NAVY};">
          <div style="font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:${SDA_TEAL};font-weight:700;">SDA d'Estourmel</div>
          <div style="font-size:22px;font-weight:800;color:${SDA_NAVY};margin-top:4px;">Votre reçu fiscal</div>
          <div style="font-size:13px;color:#6b7f96;margin-top:2px;">Don du ${fmtDate(params.date)}</div>
        </td></tr>
        <tr><td style="padding:24px 28px;">
          <p style="margin:0 0 14px;font-size:14px;line-height:1.55;">Bonjour ${params.donorDisplayName},</p>
          <p style="margin:0 0 14px;font-size:14px;line-height:1.55;">
            Au nom de toute l'équipe et des animaux que nous accueillons, nous vous remercions
            chaleureusement pour votre don de <strong>${fmtAmount(params.amount)}</strong>.
            Votre soutien contribue directement à la prise en charge, aux soins et au bien-être
            des animaux du refuge.
          </p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;border:1px solid #d9e6ed;border-radius:6px;">
            <tr><td style="padding:14px 16px;font-size:13px;line-height:1.6;">
              <strong style="color:${SDA_TEAL};text-transform:uppercase;letter-spacing:1px;font-size:10px;">Reçu fiscal CERFA n° 11580*04</strong><br/>
              <strong>Montant :</strong> ${fmtAmount(params.amount)}<br/>
              <strong>Date du don :</strong> ${fmtDate(params.date)}
              ${params.cerfaNumber ? `<br/><strong>Référence :</strong> ${params.cerfaNumber}` : ''}
            </td></tr>
          </table>

          <p style="margin:0 0 14px;font-size:14px;line-height:1.55;">
            Vous trouverez en pièce jointe votre reçu fiscal officiel. Il vous permet de bénéficier
            d'une <strong>réduction d'impôt de 66 %</strong> du montant du don (article 200 du Code
            général des impôts), dans la limite de 20 % de votre revenu imposable.
          </p>
          <p style="margin:0 0 14px;font-size:14px;line-height:1.55;">
            Conservez-le précieusement : il sera à joindre à votre déclaration de revenus.
          </p>

          <p style="margin:18px 0 0;font-size:14px;line-height:1.55;">
            Pour toute question, vous pouvez répondre à ce mail ou nous écrire à
            <a href="mailto:${REPLY_TO_EMAIL}" style="color:${SDA_TEAL};">${REPLY_TO_EMAIL}</a>.
          </p>

          <p style="margin:18px 0 0;font-size:14px;line-height:1.55;">
            Encore merci pour votre générosité.<br/>
            <em style="color:#6b7f96;">L'équipe SDA</em>
          </p>
        </td></tr>
        <tr><td style="background:#fafbfc;padding:14px 28px;border-top:1px solid #d9e6ed;font-size:11px;color:#6b7f96;text-align:center;">
          Société de Défense des Animaux du Nord — 11 route nationale, 59400 Estourmel<br/>
          <a href="https://sda-nord.com" style="color:${SDA_ORANGE};">sda-nord.com</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

export interface SendCerfaByEmailParams {
  donation: Donation
  pdfBuffer: Buffer
  pdfFilename: string
  /** Email du destinataire. Si omis, utilise donation.donor_email. */
  to?: string
}

export async function sendCerfaByEmail(
  params: SendCerfaByEmailParams,
): Promise<{ messageId: string; recipient: string }> {
  const recipient = params.to || params.donation.donor_email
  if (!recipient) {
    throw new Error("Aucun email destinataire : renseignez l'email du donateur avant d'envoyer.")
  }

  const donorDisplayName = getClientDisplayName({
    kind: 'person',
    name: params.donation.donor_name,
    first_name: null,
  })

  const html = buildHtml({
    donorDisplayName,
    amount: params.donation.amount,
    date: params.donation.date,
    cerfaNumber: params.donation.cerfa_number,
  })

  const result = await sendEmail({
    to: recipient,
    toName: params.donation.donor_name,
    subject: `Votre reçu fiscal — Don du ${fmtDate(params.donation.date)} à la SDA`,
    html,
    from: SENDER_ADDRESS,
    fromName: SENDER_NAME,
    replyTo: REPLY_TO_EMAIL,
    attachments: [
      {
        filename: params.pdfFilename,
        content: params.pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  })

  return { messageId: result.messageId, recipient }
}
