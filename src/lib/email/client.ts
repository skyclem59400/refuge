import nodemailer, { type Transporter } from 'nodemailer'

/**
 * Client SMTP Brevo pour l'envoi d'emails transactionnels depuis Optimus.
 *
 * Configuration via env vars :
 * - BREVO_SMTP_USER     — login technique SMTP (ex: a97868001@smtp-brevo.com)
 * - BREVO_SMTP_KEY      — clé SMTP générée dans Brevo
 * - BREVO_FROM_ADDRESS  — adresse d'expédition par défaut (doit être domaine vérifié Brevo)
 *
 * Cas d'usage actuels :
 *   - mail INITIAL d'invitation à signer un contrat d'adoption / FA (pour
 *     avoir le branding SDA + photo de l'animal — Documenso s'occupe ensuite
 *     des relances et notifications via les mêmes credentials)
 *   - compte-rendu d'intervention astreinte (PDF en pièce jointe + copie
 *     à fourriere@sda-nord.com)
 *
 * Pour ajouter un nouveau type d'email, mettre à jour cette liste et le
 * `fromName` par défaut si le branding doit changer.
 */

const SMTP_HOST = 'smtp-relay.brevo.com'
const SMTP_PORT = 587

let transporter: Transporter | null = null

function getTransporter(): Transporter {
  if (transporter) return transporter

  const user = process.env.BREVO_SMTP_USER
  const pass = process.env.BREVO_SMTP_KEY
  if (!user || !pass) {
    throw new Error('BREVO_SMTP_USER ou BREVO_SMTP_KEY manquante en env. Vérifier la config Coolify.')
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: false, // STARTTLS sur 587
    auth: { user, pass },
  })

  return transporter
}

export interface SendEmailAttachment {
  filename: string
  content: Buffer
  contentType?: string
}

export interface SendEmailParams {
  to: string
  /** Nom affiché du destinataire (optionnel, améliore l'UX dans les clients mail). */
  toName?: string
  cc?: string | string[]
  subject: string
  html: string
  /** Plain-text fallback pour les clients qui n'affichent pas l'HTML. Auto-généré si omis. */
  text?: string
  /** Adresse d'expédition. Si omis, utilise BREVO_FROM_ADDRESS. */
  from?: string
  /** Nom de l'expéditeur affiché. Par défaut : "Refuge SDA". */
  fromName?: string
  /** Reply-To si différent du from (utile pour rediriger les réponses vers la boîte ops). */
  replyTo?: string
  attachments?: SendEmailAttachment[]
}

export async function sendEmail(params: SendEmailParams): Promise<{ messageId: string }> {
  const fromAddress = params.from || process.env.BREVO_FROM_ADDRESS || 'signature@sda-nord.com'
  const fromName = params.fromName || 'Refuge SDA'

  const result = await getTransporter().sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to: params.toName ? `"${params.toName}" <${params.to}>` : params.to,
    cc: params.cc,
    subject: params.subject,
    html: params.html,
    text: params.text || stripHtml(params.html),
    replyTo: params.replyTo,
    attachments: params.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType ?? 'application/octet-stream',
    })),
  })

  return { messageId: result.messageId }
}

/** Convertit un HTML en texte brut très basique pour le fallback plain-text. */
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
