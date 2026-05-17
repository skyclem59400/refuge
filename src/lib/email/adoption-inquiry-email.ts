import { sendEmail } from './client'

const PRIMARY = '#1e3a5f' // navy
const ACCENT = '#5ba8a0' // teal
const WARM = '#c96b3c' // terracotta

interface AdoptionInquiryEmailBase {
  to: string
  firstName: string
  animalName: string
  appointmentDate: string // YYYY-MM-DD
  appointmentTime: string // HH:MM
  establishmentName: string
}

/**
 * Email accusé de réception immédiat après soumission d'une demande publique.
 * Statut côté équipe : pending → en attente de validation.
 */
export async function sendAdoptionInquiryConfirmation(params: AdoptionInquiryEmailBase) {
  const dateFr = formatFrDate(params.appointmentDate)
  const html = layout(
    `Votre demande d'adoption a bien été reçue`,
    `
    <p>Bonjour ${escape(params.firstName)},</p>
    <p>
      Merci pour votre demande d'adoption concernant
      <strong>${escape(params.animalName)}</strong>. Nous l'avons bien reçue
      et notre équipe la traite avec attention.
    </p>

    <div style="background:#f0f7fa;border-left:4px solid ${ACCENT};padding:18px;margin:24px 0;border-radius:6px;">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:${PRIMARY};font-weight:700;">
        Rendez-vous demandé
      </div>
      <div style="margin-top:6px;color:${PRIMARY};font-size:16px;">
        ${dateFr} à <strong>${escape(params.appointmentTime)}</strong>
      </div>
      <div style="margin-top:4px;color:#51647a;font-size:13px;">
        ${escape(params.establishmentName)} — durée ~45 minutes
      </div>
    </div>

    <p><strong>Et maintenant ?</strong></p>
    <ol style="padding-left:18px;line-height:1.7;">
      <li>Sous <strong>48h ouvrées</strong>, l'équipe examine votre demande.</li>
      <li>Nous vous confirmons (ou ajustons) le créneau par email.</li>
      <li>Le jour J, vous rencontrez ${escape(params.animalName)} avec un référent.</li>
    </ol>

    <p style="color:#6b7f96;font-size:13px;margin-top:30px;">
      Aucune action n'est nécessaire de votre part pour le moment. Si vous
      souhaitez annuler ou modifier votre demande, répondez simplement à cet email.
    </p>
    `,
  )

  return sendEmail({
    to: params.to,
    toName: params.firstName,
    subject: `Demande d'adoption de ${params.animalName} bien reçue — SDA Nord`,
    html,
    fromName: 'SDA Nord',
    from: 'noreply@sda-nord.com',
    replyTo: 'contact@sda-nord.com',
  })
}

/**
 * Email envoyé à l'utilisateur quand l'équipe valide la demande (status pending → contacted/rdv_confirmed).
 */
export async function sendAdoptionInquiryValidated(
  params: AdoptionInquiryEmailBase & { teamMessage?: string },
) {
  const dateFr = formatFrDate(params.appointmentDate)
  const html = layout(
    `Votre rendez-vous est confirmé`,
    `
    <p>Bonjour ${escape(params.firstName)},</p>
    <p>
      Bonne nouvelle : votre demande d'adoption pour
      <strong>${escape(params.animalName)}</strong> est <strong style="color:#10b981;">confirmée</strong>
      par notre équipe.
    </p>

    <div style="background:#ecfdf5;border-left:4px solid #10b981;padding:18px;margin:24px 0;border-radius:6px;">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:#047857;font-weight:700;">
        Rendez-vous confirmé
      </div>
      <div style="margin-top:6px;color:${PRIMARY};font-size:16px;">
        ${dateFr} à <strong>${escape(params.appointmentTime)}</strong>
      </div>
      <div style="margin-top:4px;color:#51647a;font-size:13px;">
        ${escape(params.establishmentName)}
      </div>
    </div>

    ${params.teamMessage ? `<div style="background:#fdf4ee;padding:14px;border-radius:6px;font-size:14px;margin:16px 0;"><strong>Message de l'équipe :</strong><br>${escape(params.teamMessage)}</div>` : ''}

    <p><strong>Avant de venir :</strong></p>
    <ul style="padding-left:18px;line-height:1.7;">
      <li>Pensez à apporter <strong>une pièce d'identité</strong> et un <strong>justificatif de domicile</strong> récent.</li>
      <li>Si vous avez déjà un animal, vous pouvez nous envoyer son carnet de santé.</li>
      <li>Prévoyez ~1h sur place pour la rencontre et l'échange avec le référent.</li>
    </ul>

    <p style="color:#6b7f96;font-size:13px;margin-top:30px;">
      Pour annuler ou décaler le RDV, contactez-nous au plus vite en répondant à cet email.
    </p>
    `,
  )

  return sendEmail({
    to: params.to,
    toName: params.firstName,
    subject: `RDV confirmé pour ${params.animalName} — ${dateFr}`,
    html,
    fromName: 'SDA Nord',
    from: 'noreply@sda-nord.com',
    replyTo: 'contact@sda-nord.com',
  })
}

/**
 * Email envoyé quand l'équipe refuse la demande (status → refused).
 */
export async function sendAdoptionInquiryRefused(
  params: Omit<AdoptionInquiryEmailBase, 'appointmentDate' | 'appointmentTime'> & {
    reason?: string
  },
) {
  const html = layout(
    `Concernant votre demande d'adoption`,
    `
    <p>Bonjour ${escape(params.firstName)},</p>
    <p>
      Après étude attentive de votre demande pour
      <strong>${escape(params.animalName)}</strong>, nous ne pouvons
      malheureusement pas y donner suite favorablement.
    </p>

    ${
      params.reason
        ? `<div style="background:#fef3c7;border-left:4px solid ${WARM};padding:14px;border-radius:6px;margin:16px 0;"><strong>Motif :</strong><br>${escape(params.reason)}</div>`
        : ''
    }

    <p>
      Ce choix ne remet pas en cause vos qualités. Nous prenons en compte de
      nombreux critères pour déterminer le meilleur foyer possible pour chaque
      animal (rythme, expérience, configuration du logement, autres animaux…).
    </p>

    <p>
      <strong>D'autres animaux n'attendent que vous</strong> sur notre site :
      <a href="https://contact.sda-nord.com/adoption" style="color:${ACCENT};">
        contact.sda-nord.com/adoption
      </a>
    </p>

    <p style="color:#6b7f96;font-size:13px;margin-top:30px;">
      Si vous souhaitez en discuter, vous pouvez répondre à cet email.
      Merci pour votre intérêt et votre démarche.
    </p>
    `,
  )

  return sendEmail({
    to: params.to,
    toName: params.firstName,
    subject: `Concernant votre demande d'adoption — SDA Nord`,
    html,
    fromName: 'SDA Nord',
    from: 'noreply@sda-nord.com',
    replyTo: 'contact@sda-nord.com',
  })
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function layout(title: string, content: string): string {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>${escape(title)}</title></head>
<body style="margin:0;padding:0;background:#f0f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#3d5a80;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f0f7fa;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #d9e6ed;">
      <tr>
        <td style="background:${PRIMARY};padding:20px 28px;color:#fff;">
          <div style="font-family:Georgia,serif;font-size:20px;font-weight:600;letter-spacing:-0.01em;">
            <span style="color:${ACCENT};">SDA</span> <span style="font-style:italic;font-weight:400;">Nord</span>
          </div>
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.15em;opacity:0.7;margin-top:3px;">
            Société de Défense des Animaux du Nord · depuis 1864
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:32px 28px 8px;">
          <h1 style="font-family:Georgia,serif;font-size:24px;color:${PRIMARY};margin:0 0 16px;line-height:1.2;">
            ${escape(title)}
          </h1>
        </td>
      </tr>
      <tr>
        <td style="padding:0 28px 28px;font-size:15px;line-height:1.6;">
          ${content}
        </td>
      </tr>
      <tr>
        <td style="background:#fafcfd;padding:18px 28px;border-top:1px solid #eef4f7;font-size:11px;color:#6b7f96;text-align:center;">
          SDA Nord · 28 rue du Marais, 59400 Estourmel · 03 27 83 32 70<br>
          <a href="https://sda-nord.com" style="color:${ACCENT};">sda-nord.com</a>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body></html>`
}

function escape(str: string): string {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

function formatFrDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
