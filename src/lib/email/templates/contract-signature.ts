/**
 * Template HTML email pour invitation à signer un contrat (FA + adoption).
 *
 * Design : sobre, élégant, branding SDA (logo + couleurs).
 * Pas de pathos, pas de mignonnerie surfaite — direction "digne" cohérente
 * avec les autres communications SDA.
 *
 * Compatible avec tous les clients mail majeurs (inline CSS, table-based
 * layout, fallbacks pour Outlook, dimensions max 600px).
 */

export type ContractKind = 'foster' | 'adoption'

export interface ContractEmailParams {
  /** "foster" → famille d'accueil, "adoption" → adoption */
  kind: ContractKind
  /** URL de signature Documenso à mettre derrière le bouton */
  signingUrl: string
  /** Prénom du destinataire (FA ou adoptant) */
  recipientFirstName: string
  /** Nom complet du destinataire (pour la salutation formelle si pas de prénom) */
  recipientName: string
  /** Nom de l'animal */
  animalName: string
  /** "chien" | "chat" — détermine l'emoji et le wording */
  animalSpecies: 'cat' | 'dog' | string
  /** Race / croisement, ou null si inconnu */
  animalBreed?: string | null
  /** URL publique de la photo de l'animal (Supabase Storage). null = pas de photo */
  animalPhotoUrl?: string | null
  /** Numéro du contrat (ex: "CFA-2026-001") */
  contractNumber: string
  /** Nom de l'établissement (ex: "SDA d'Estourmel") */
  establishmentName: string
  /** Email de contact de l'établissement (footer + reply-to) */
  establishmentEmail?: string | null
  /** URL publique du logo de l'établissement (Supabase Storage). null = nom textuel */
  establishmentLogoUrl?: string | null
  /** URL du site web de l'établissement (footer) */
  establishmentWebsite?: string | null
}

const PRIMARY = '#0d9488' // teal-600 (logo SDA)
const PRIMARY_DARK = '#0f766e' // teal-700
const TEXT = '#1f2937' // grey-800
const TEXT_MUTED = '#6b7280' // grey-500
const BORDER = '#e5e7eb' // grey-200
const BG = '#f9fafb' // grey-50
const SURFACE = '#ffffff'

function buildSubject(p: ContractEmailParams): string {
  if (p.kind === 'foster') {
    return `Convention famille d'accueil — ${p.animalName} | ${p.establishmentName}`
  }
  return `Contrat d'adoption — ${p.animalName} | ${p.establishmentName}`
}

function buildHeading(p: ContractEmailParams): string {
  return p.kind === 'foster' ? 'Convention famille d’accueil' : 'Contrat d’adoption'
}

function buildIntro(p: ContractEmailParams): string {
  if (p.kind === 'foster') {
    return `Merci pour votre engagement à accueillir <strong>${escapeHtml(p.animalName)}</strong> en famille d'accueil. Vous trouverez ci-dessous la convention de placement à signer électroniquement avant le début de l'accueil.`
  }
  return `Félicitations pour l'adoption de <strong>${escapeHtml(p.animalName)}</strong>. Le contrat d'adoption ci-dessous est à signer électroniquement pour finaliser la cession définitive.`
}

function buildCtaLabel(p: ContractEmailParams): string {
  return p.kind === 'foster' ? 'Signer la convention' : 'Signer le contrat'
}

function speciesLabel(species: string): string {
  if (species === 'cat') return 'Chat'
  if (species === 'dog') return 'Chien'
  return species
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function buildContractSignatureEmail(p: ContractEmailParams): { subject: string; html: string } {
  const subject = buildSubject(p)
  const heading = buildHeading(p)
  const intro = buildIntro(p)
  const ctaLabel = buildCtaLabel(p)
  const orgName = escapeHtml(p.establishmentName)
  const greetingName = escapeHtml(p.recipientFirstName || p.recipientName.split(' ')[0])
  const animalNameSafe = escapeHtml(p.animalName)
  const breedLine = p.animalBreed?.trim()
    ? `${escapeHtml(speciesLabel(p.animalSpecies))} · ${escapeHtml(p.animalBreed.trim())}`
    : escapeHtml(speciesLabel(p.animalSpecies))

  const logoBlock = p.establishmentLogoUrl
    ? `<img src="${escapeHtml(p.establishmentLogoUrl)}" alt="${orgName}" width="120" style="display:block;height:auto;max-width:120px;border:0;outline:none;text-decoration:none;" />`
    : `<span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:18px;font-weight:600;color:${PRIMARY};letter-spacing:0.5px;">${orgName.toUpperCase()}</span>`

  const photoBlock = p.animalPhotoUrl
    ? `<tr>
        <td style="padding:0;line-height:0;">
          <img src="${escapeHtml(p.animalPhotoUrl)}" alt="${animalNameSafe}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;border-top-left-radius:8px;border-top-right-radius:8px;" />
        </td>
      </tr>`
    : ''

  const contactLine = p.establishmentEmail
    ? `<a href="mailto:${escapeHtml(p.establishmentEmail)}" style="color:${PRIMARY};text-decoration:none;">${escapeHtml(p.establishmentEmail)}</a>`
    : ''

  const websiteLine = p.establishmentWebsite
    ? `<a href="${escapeHtml(p.establishmentWebsite)}" style="color:${TEXT_MUTED};text-decoration:none;">${escapeHtml(p.establishmentWebsite.replace(/^https?:\/\//, ''))}</a>`
    : ''

  const footerSeparator = contactLine && websiteLine ? ' &nbsp;·&nbsp; ' : ''

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
  <style>
    @media only screen and (max-width: 620px) {
      .container { width: 100% !important; padding-left: 0 !important; padding-right: 0 !important; }
      .px-mobile { padding-left: 24px !important; padding-right: 24px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;color:${TEXT};">
  <div style="display:none;font-size:0;line-height:0;color:${BG};max-height:0;max-width:0;opacity:0;overflow:hidden;">
    ${escapeHtml(intro.replace(/<[^>]+>/g, ''))}
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${BG};">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <!-- Header logo -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="container" style="max-width:600px;margin-bottom:16px;">
          <tr>
            <td class="px-mobile" style="padding:0 8px;">
              ${logoBlock}
            </td>
          </tr>
        </table>

        <!-- Card -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="container" style="max-width:600px;background:${SURFACE};border:1px solid ${BORDER};border-radius:8px;overflow:hidden;">
          ${photoBlock}
          <tr>
            <td class="px-mobile" style="padding:32px 40px 8px 40px;">
              <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:1px;color:${PRIMARY};text-transform:uppercase;">${escapeHtml(heading)}</p>
              <h1 style="margin:8px 0 0 0;font-size:26px;line-height:1.2;font-weight:700;color:${TEXT};">${animalNameSafe}</h1>
              <p style="margin:6px 0 0 0;font-size:14px;color:${TEXT_MUTED};">${breedLine}</p>
            </td>
          </tr>
          <tr>
            <td class="px-mobile" style="padding:24px 40px 8px 40px;">
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:${TEXT};">Bonjour ${greetingName},</p>
              <p style="margin:0;font-size:15px;line-height:1.6;color:${TEXT};">${intro}</p>
            </td>
          </tr>
          <tr>
            <td class="px-mobile" align="center" style="padding:32px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:${PRIMARY};border-radius:6px;">
                    <a href="${escapeHtml(p.signingUrl)}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:${SURFACE};text-decoration:none;border-radius:6px;">
                      ${escapeHtml(ctaLabel)} →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:16px 0 0 0;font-size:12px;color:${TEXT_MUTED};">Signature électronique sécurisée · ${escapeHtml(p.contractNumber)}</p>
            </td>
          </tr>
          <tr>
            <td class="px-mobile" style="padding:0 40px 32px 40px;">
              <div style="border-top:1px solid ${BORDER};padding-top:20px;">
                <p style="margin:0;font-size:13px;line-height:1.6;color:${TEXT_MUTED};">
                  Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :<br />
                  <a href="${escapeHtml(p.signingUrl)}" style="color:${PRIMARY_DARK};word-break:break-all;">${escapeHtml(p.signingUrl)}</a>
                </p>
              </div>
            </td>
          </tr>
        </table>

        <!-- Footer -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="container" style="max-width:600px;margin-top:24px;">
          <tr>
            <td class="px-mobile" align="center" style="padding:0 8px;">
              <p style="margin:0;font-size:13px;color:${TEXT_MUTED};line-height:1.6;">
                <strong style="color:${TEXT};">${orgName}</strong><br />
                ${contactLine}${footerSeparator}${websiteLine}
              </p>
              <p style="margin:12px 0 0 0;font-size:11px;color:${TEXT_MUTED};">
                Cet email est confidentiel et destiné uniquement à ${escapeHtml(p.recipientName)}.
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`

  return { subject, html }
}
