import { sendEmail } from './client'
import type { SatisfactionSurveyKind } from '@/lib/types/database'

interface SatisfactionEmailParams {
  to: string
  toName: string | null
  kind: SatisfactionSurveyKind
  token: string
  establishmentName: string
  /** Optionnel : nom de l'animal (pour adoption/foster) */
  animalName?: string | null
  /** URL de base de l'app, fallback https://sda.optimus-services.fr */
  appUrl?: string
}

const SUBJECT_BY_KIND: Record<SatisfactionSurveyKind, string> = {
  adoption: 'Comment se passe l\'adoption ?',
  donation: 'Merci pour votre don — quelques mots de retour ?',
  foster: 'Votre expérience en famille d\'accueil',
}

const INTRO_BY_KIND: Record<SatisfactionSurveyKind, (name: string, animal?: string | null) => string> = {
  adoption: (name, animal) => `
    Bonjour ${name},<br/><br/>
    Cela fait maintenant une semaine que vous avez adopté <strong>${animal || 'votre nouveau compagnon'}</strong>.
    Toute l'équipe de la SDA pense à vous et espère que tout se passe bien à la maison.<br/><br/>
    Pour nous aider à mieux accompagner les futurs adoptants, nous serions ravis d'avoir
    votre <strong>retour honnête</strong> sur l'adoption — ce qui s'est bien passé, et surtout ce que
    nous aurions pu mieux faire.
  `,
  donation: (name) => `
    Bonjour ${name},<br/><br/>
    Encore un grand merci pour votre don qui contribue directement à protéger et soigner les animaux du refuge.<br/><br/>
    Pour nous aider à mieux communiquer et à améliorer la relation avec nos donateurs,
    pouvez-vous nous donner votre <strong>ressenti honnête</strong> sur cette expérience ?
    Cela ne prend que 30 secondes.
  `,
  foster: (name, animal) => `
    Bonjour ${name},<br/><br/>
    Cela fait une semaine que vous avez accueilli <strong>${animal || 'un animal en famille d\'accueil'}</strong>.
    Merci pour ce que vous faites — sans les familles d'accueil, le refuge ne pourrait pas
    fonctionner.<br/><br/>
    Pour mieux soutenir nos FA, nous aimerions avoir votre <strong>retour honnête</strong>
    sur l'accompagnement reçu jusqu'ici.
  `,
}

const CTA_LABEL_BY_KIND: Record<SatisfactionSurveyKind, string> = {
  adoption: 'Donner mon avis (30 sec)',
  donation: 'Répondre en 30 secondes',
  foster: 'Partager mon expérience',
}

/**
 * Envoie l'email NPS au destinataire avec lien tokenisé vers la page de réponse.
 * Charte SDA : navy / teal / orange terracotta.
 */
export async function sendSatisfactionSurveyEmail(params: SatisfactionEmailParams) {
  const baseUrl = params.appUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://sda.optimus-services.fr'
  const ctaUrl = `${baseUrl}/satisfaction/${params.token}`
  const recipientName = params.toName || 'Bonjour'
  const intro = INTRO_BY_KIND[params.kind](recipientName, params.animalName)

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<title>${SUBJECT_BY_KIND[params.kind]}</title>
</head>
<body style="margin:0;padding:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;background:#f8fafc;color:#1e293b;">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(15,23,42,.08);">
    <div style="background:#1e3a5f;padding:24px;">
      <h1 style="margin:0;color:white;font-size:22px;font-weight:700;letter-spacing:.5px;">
        ${params.establishmentName}
      </h1>
      <p style="margin:6px 0 0 0;color:#a5b4cb;font-size:12px;text-transform:uppercase;letter-spacing:1.5px;">
        ${SUBJECT_BY_KIND[params.kind]}
      </p>
    </div>

    <div style="padding:30px 28px;font-size:15px;line-height:1.65;">
      <p style="margin:0 0 18px 0;">${intro}</p>

      <div style="text-align:center;margin:30px 0;">
        <a href="${ctaUrl}"
           style="display:inline-block;background:#5ba8a0;color:white;text-decoration:none;font-weight:700;
                  padding:14px 28px;border-radius:8px;font-size:14px;letter-spacing:.5px;">
          ${CTA_LABEL_BY_KIND[params.kind]} →
        </a>
      </div>

      <div style="border-left:3px solid #c96b3c;background:#fffbeb;padding:14px 16px;border-radius:4px;margin:24px 0;">
        <p style="margin:0;font-size:13px;color:#92400e;line-height:1.5;">
          <strong>Promesse :</strong> aucune publicité, aucun spam. Vos retours sont lus
          personnellement par l'équipe et servent à améliorer concrètement nos pratiques.
        </p>
      </div>

      <p style="margin:18px 0 0 0;font-size:13px;color:#64748b;line-height:1.5;">
        Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :<br/>
        <a href="${ctaUrl}" style="color:#1e3a5f;word-break:break-all;">${ctaUrl}</a>
      </p>
    </div>

    <div style="height:4px;background:linear-gradient(90deg,#c96b3c 0%,#5ba8a0 50%,#1e3a5f 100%);"></div>

    <div style="background:#f8fafc;padding:16px 24px;text-align:center;font-size:11px;color:#94a3b8;">
      ${params.establishmentName} — Merci de prendre quelques instants pour nous aider à nous améliorer.
    </div>
  </div>
</body>
</html>`

  return sendEmail({
    to: params.to,
    toName: params.toName || undefined,
    subject: SUBJECT_BY_KIND[params.kind],
    html,
    fromName: params.establishmentName,
  })
}
