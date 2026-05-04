import nodemailer, { type Transporter } from 'nodemailer'

/**
 * Client SMTP Brevo pour l'envoi d'emails depuis Optimus.
 *
 * Configuration via env vars :
 * - BREVO_SMTP_USER     — login technique SMTP (ex: a97868001@smtp-brevo.com)
 * - BREVO_SMTP_KEY      — clé SMTP générée dans Brevo
 * - BREVO_FROM_ADDRESS  — adresse d'expédition par défaut (doit être domaine vérifié Brevo)
 *
 * Documenso continue d'utiliser ces mêmes credentials pour ses propres emails
 * (rappels de signature, notifications de complétion). On envoie depuis Optimus
 * uniquement le mail INITIAL qui invite à signer (pour avoir le branding SDA + photo animal).
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

export interface SendEmailParams {
  to: string
  /** Nom affiché du destinataire (optionnel, améliore l'UX dans les clients mail). */
  toName?: string
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
}

export async function sendEmail(params: SendEmailParams): Promise<{ messageId: string }> {
  const fromAddress = params.from || process.env.BREVO_FROM_ADDRESS || 'signature@sda-nord.com'
  const fromName = params.fromName || 'Refuge SDA'

  const result = await getTransporter().sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to: params.toName ? `"${params.toName}" <${params.to}>` : params.to,
    subject: params.subject,
    html: params.html,
    text: params.text || stripHtml(params.html),
    replyTo: params.replyTo,
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
