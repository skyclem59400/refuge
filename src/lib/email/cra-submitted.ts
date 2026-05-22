import { sendEmail } from './client'

const MONTH_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

interface CraSubmittedEmailParams {
  to: string
  toName: string
  year: number
  month: number
  establishmentName: string
  /** Optionnel : URL de base de l'app (fallback https://sda.optimus-services.fr) */
  appUrl?: string
}

/**
 * Email envoyé au collaborateur quand Mary soumet son CRA mensuel pour validation.
 * Charte SDA : navy + teal + orange terracotta.
 */
export async function sendCraSubmittedEmail(params: CraSubmittedEmailParams) {
  const monthName = MONTH_FR[params.month - 1] || String(params.month)
  const period = `${monthName} ${params.year}`
  const baseUrl = params.appUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://sda.optimus-services.fr'
  const ctaUrl = `${baseUrl}/espace-collaborateur/cra/${params.year}/${params.month}`

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<title>Votre CRA est prêt à valider</title>
</head>
<body style="margin:0;padding:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;background:#f8fafc;color:#1e293b;">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(15,23,42,.08);">
    <div style="background:#1e3a5f;padding:20px 24px;">
      <h1 style="margin:0;color:white;font-size:20px;font-weight:700;letter-spacing:.5px;">
        ${params.establishmentName}
      </h1>
      <p style="margin:4px 0 0 0;color:#a5b4cb;font-size:12px;text-transform:uppercase;letter-spacing:1.5px;">
        Compte-rendu d'activité
      </p>
    </div>

    <div style="padding:28px 24px;">
      <p style="margin:0 0 14px 0;font-size:15px;">Bonjour ${params.toName},</p>
      <p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;">
        Votre CRA pour <strong style="color:#1e3a5f;">${period}</strong> a été préparé.
        Merci de prendre quelques minutes pour le vérifier et le valider.
      </p>
      <p style="margin:0 0 22px 0;font-size:14px;color:#475569;line-height:1.6;">
        Si tout vous semble correct, cliquez sur « Valider mon CRA ». Sinon, vous pouvez
        demander une modification directement depuis votre espace collaborateur.
      </p>

      <div style="text-align:center;margin:28px 0;">
        <a href="${ctaUrl}"
           style="display:inline-block;background:#5ba8a0;color:white;text-decoration:none;font-weight:700;
                  padding:13px 28px;border-radius:8px;font-size:14px;letter-spacing:.5px;">
          Consulter mon CRA
        </a>
      </div>

      <div style="border-left:3px solid #c96b3c;background:#fffbeb;padding:12px 14px;border-radius:4px;margin:18px 0;">
        <p style="margin:0;font-size:13px;color:#92400e;line-height:1.5;">
          <strong>Rappel :</strong> sans validation de votre part, le CRA ne pourra pas être transmis au comptable
          pour la préparation de votre paie.
        </p>
      </div>

      <p style="margin:18px 0 0 0;font-size:13px;color:#64748b;line-height:1.5;">
        Si vous avez la moindre question, contactez directement Mary ou un administrateur de l'association.
      </p>
    </div>

    <div style="height:4px;background:linear-gradient(90deg,#c96b3c 0%,#5ba8a0 50%,#1e3a5f 100%);"></div>

    <div style="background:#f8fafc;padding:16px 24px;text-align:center;font-size:11px;color:#94a3b8;">
      Email automatique envoyé par ${params.establishmentName} — merci de ne pas y répondre directement.
    </div>
  </div>
</body>
</html>`

  return sendEmail({
    to: params.to,
    toName: params.toName,
    subject: `Votre CRA de ${period} est à valider`,
    html,
    fromName: params.establishmentName,
  })
}
