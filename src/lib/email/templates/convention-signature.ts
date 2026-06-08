/**
 * Template HTML email pour invitation à signer une convention de fourrière
 * animale entre la SDA et une commune (ou EPCI).
 *
 * Ton institutionnel et factuel, contrairement aux contrats adoption/FA :
 * la mairie attend un acte administratif entre établissements, pas une
 * communication chaleureuse. Le récap des conditions joue le rôle que
 * jouait la photo de l'animal sur les contrats particuliers : rassurer le
 * signataire sur **ce** qu'il signe avant qu'il clique sur "Signer".
 *
 * Cohérent avec la direction "digne, pas mignonne" actée pour SDA.
 *
 * Compatible avec tous les clients mail majeurs (inline CSS, table-based
 * layout, dimensions max 600px).
 */

// === Charte SDA officielle (cf. src/lib/pdf/sda-brand.ts) ===
const PRIMARY = '#5ba8a0'      // teal SDA
const PRIMARY_DARK = '#1e3a5f' // bleu marine SDA
const TEXT = '#1e3a5f'
const TEXT_MUTED = '#6b7f96'
const BORDER = '#d9e6ed'
const BG = '#f0f7fa'
const SURFACE = '#ffffff'
const FOOTER_GRADIENT = 'linear-gradient(90deg, #c96b3c 0%, #5ba8a0 50%, #1e3a5f 100%)'

export interface ConventionSignatureEmailParams {
  /** URL Documenso de signature à mettre derrière le bouton */
  signingUrl: string
  /** N° de contrat (ex: "CV-2026-0029") */
  contractNumber: string
  /** Nom complet du périmètre (ex: "Commune de Maroilles", "Communauté d'Agglomération de Cambrai") */
  scopeName: string
  /** Salutation courte ("Monsieur le Maire", "Madame la Présidente"…). Auto-déduite si omis. */
  signatoryShort?: string | null
  /** Rôle ("Maire", "Présidente"…) — utilisé pour déduire signatoryShort si besoin */
  signatoryRole?: string | null
  /** Nom complet du signataire ("Monsieur Dominique QUINZIN") — utilisé en fallback */
  signatoryName?: string | null
  /** Population de référence (habitants). */
  populationReference: number
  /** Cotisation annuelle en euros (pas en centimes). */
  yearlyFeeEuros: number
  /** Taux par habitant en euros (pas en centimes). */
  ratePerInhabitantEuros: number
  /** Intervention nuit / week-end en euros. */
  nightInterventionEuros: number
  /** Majoration dimanche / férié en euros. */
  nightSurchargeEuros: number
  /** Durée du contrat en années. */
  durationYears: number
  /** Nom de l'établissement (toujours "SDA d'Estourmel" pour l'instant) */
  establishmentName: string
  /** Email de contact (footer + replyTo) */
  establishmentEmail?: string | null
  /** Site web (footer) */
  establishmentWebsite?: string | null
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function fmtEuros(n: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

/**
 * Déduit la salutation courte à partir du rôle/nom du signataire.
 * Exemples :
 *   - role="Maire", name="Monsieur Dominique QUINZIN"  → "Monsieur le Maire"
 *   - role="Présidente", name="Madame Marjorie GOSSELET" → "Madame la Présidente"
 *   - role="Maire", name="Madame Dalila DUWEZ"  → "Madame le Maire"
 *   - role=null → "Madame, Monsieur"
 */
function deduceSignatoryShort(role: string | null | undefined, name: string | null | undefined): string {
  if (!role) return 'Madame, Monsieur'
  const isFemale = /^madame\b/i.test(name || '')
  const isMale = /^monsieur\b/i.test(name || '')
  const civility = isFemale ? 'Madame' : isMale ? 'Monsieur' : 'Monsieur'
  // "Maire" → le Maire ; "Présidente" → la Présidente ; "Président" → le Président
  const lowerRole = role.toLowerCase()
  if (lowerRole.includes('présidente')) return `${civility} la Présidente`
  if (lowerRole.includes('président')) return `${civility} le Président`
  if (lowerRole.includes('maire')) return `${civility} le Maire`
  return `${civility} ${role}`
}

export function buildConventionSignatureEmail(
  p: ConventionSignatureEmailParams,
): { subject: string; html: string } {
  const subject = `Convention de fourrière animale ${p.contractNumber} — ${p.scopeName}`
  const greeting = p.signatoryShort?.trim() || deduceSignatoryShort(p.signatoryRole, p.signatoryName)

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
    Convention de fourrière animale ${escapeHtml(p.contractNumber)} à signer électroniquement.
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${BG};">
    <tr><td align="center" style="padding:32px 16px;">

      <!-- Header logo SDA -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="container" style="max-width:600px;margin-bottom:16px;">
        <tr><td class="px-mobile" style="padding:0 8px;">
          <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:20px;font-weight:700;color:${PRIMARY_DARK};letter-spacing:0.5px;line-height:1.1;">
            <span style="color:${PRIMARY};">SDA</span> d'Estourmel
          </div>
          <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:9px;color:${PRIMARY};font-weight:600;text-transform:uppercase;letter-spacing:1.8px;margin-top:3px;">
            Défendons les animaux · Fourrière conventionnée
          </div>
        </td></tr>
      </table>

      <!-- Card principale -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="container" style="max-width:600px;background:${SURFACE};border:1px solid ${BORDER};border-radius:8px;overflow:hidden;">
        <tr><td style="padding:0;line-height:0;height:4px;background:${FOOTER_GRADIENT};">&nbsp;</td></tr>

        <tr><td class="px-mobile" style="padding:32px 40px 8px 40px;">
          <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:1px;color:${PRIMARY};text-transform:uppercase;">Convention de fourrière animale</p>
          <h1 style="margin:8px 0 0 0;font-size:24px;line-height:1.25;font-weight:700;color:${TEXT};">${escapeHtml(p.scopeName)}</h1>
          <p style="margin:6px 0 0 0;font-size:13px;color:${TEXT_MUTED};font-family:'SF Mono',Menlo,Consolas,monospace;">Référence : ${escapeHtml(p.contractNumber)}</p>
        </td></tr>

        <tr><td class="px-mobile" style="padding:24px 40px 8px 40px;">
          <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:${TEXT};">À l'attention de ${escapeHtml(greeting)},</p>
          <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:${TEXT};">Madame, Monsieur,<br><br>
Suite à votre accord et conformément aux articles L211-24 et L211-25 du Code rural et de la pêche maritime, la <strong>Société de Défense des Animaux du Nord (SDA)</strong> vous adresse la convention de fourrière animale entre votre collectivité et notre établissement.</p>
          <p style="margin:0;font-size:15px;line-height:1.6;color:${TEXT};">Ce document a été pré-rempli avec les coordonnées et la population de référence de votre collectivité. Nous vous invitons à en prendre connaissance puis à le signer électroniquement via le bouton ci-dessous. Vous recevrez automatiquement une copie signée par les deux parties à l'issue.</p>
        </td></tr>

        <tr><td class="px-mobile" style="padding:24px 40px 8px 40px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${BORDER};border-radius:8px;background:${BG};">
            <tr><td style="padding:18px 20px;">
              <p style="margin:0 0 12px 0;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${PRIMARY};">Récapitulatif des conditions</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;">
                <tr><td style="padding:6px 0;color:${TEXT_MUTED};">Population de référence</td><td align="right" style="padding:6px 0;color:${TEXT};font-weight:600;">${p.populationReference.toLocaleString('fr-FR')} habitants</td></tr>
                <tr><td style="padding:6px 0;color:${TEXT_MUTED};border-top:1px solid ${BORDER};">Taux par habitant</td><td align="right" style="padding:6px 0;color:${TEXT};font-weight:600;border-top:1px solid ${BORDER};">${fmtEuros(p.ratePerInhabitantEuros)} / an</td></tr>
                <tr><td style="padding:6px 0;color:${TEXT_MUTED};border-top:1px solid ${BORDER};font-weight:600;">Cotisation annuelle</td><td align="right" style="padding:6px 0;color:${PRIMARY_DARK};font-weight:700;font-size:16px;border-top:1px solid ${BORDER};">${fmtEuros(p.yearlyFeeEuros)}</td></tr>
                <tr><td style="padding:6px 0;color:${TEXT_MUTED};border-top:1px solid ${BORDER};">Intervention nuit / week-end</td><td align="right" style="padding:6px 0;color:${TEXT};font-weight:600;border-top:1px solid ${BORDER};">${fmtEuros(p.nightInterventionEuros)} (+${fmtEuros(p.nightSurchargeEuros)} dim/férié)</td></tr>
                <tr><td style="padding:6px 0;color:${TEXT_MUTED};border-top:1px solid ${BORDER};">Durée du contrat</td><td align="right" style="padding:6px 0;color:${TEXT};font-weight:600;border-top:1px solid ${BORDER};">${p.durationYears} ans, reconductible</td></tr>
              </table>
            </td></tr>
          </table>
        </td></tr>

        <tr><td class="px-mobile" align="center" style="padding:32px 40px 8px 40px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="background:${PRIMARY_DARK};border-radius:6px;">
              <a href="${escapeHtml(p.signingUrl)}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:${SURFACE};text-decoration:none;border-radius:6px;">
                Signer la convention →
              </a>
            </td></tr>
          </table>
          <p style="margin:14px 0 0 0;font-size:12px;color:${TEXT_MUTED};line-height:1.5;">
            Signature électronique sécurisée &nbsp;·&nbsp; conforme eIDAS<br/>
            Référence : ${escapeHtml(p.contractNumber)} &nbsp;·&nbsp; durée estimée : 2 minutes
          </p>
        </td></tr>

        <tr><td class="px-mobile" style="padding:8px 40px 32px 40px;">
          <div style="border-top:1px solid ${BORDER};padding-top:18px;">
            <p style="margin:0;font-size:12px;line-height:1.6;color:${TEXT_MUTED};">
              Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :<br />
              <a href="${escapeHtml(p.signingUrl)}" style="color:${PRIMARY_DARK};word-break:break-all;">${escapeHtml(p.signingUrl)}</a>
            </p>
            <p style="margin:14px 0 0 0;font-size:13px;line-height:1.6;color:${TEXT};">
              Pour toute question : <a href="mailto:${escapeHtml(p.establishmentEmail || 'contact@sda-nord.com')}" style="color:${PRIMARY};">${escapeHtml(p.establishmentEmail || 'contact@sda-nord.com')}</a><br/>
              <span style="color:${TEXT_MUTED};">Clément Scailteux, Président SDA</span>
            </p>
          </div>
        </td></tr>
      </table>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="container" style="max-width:600px;margin-top:24px;">
        <tr><td class="px-mobile" align="center" style="padding:0 8px;">
          <p style="margin:0;font-size:13px;color:${TEXT_MUTED};line-height:1.6;">
            <strong style="color:${TEXT};">Société de Défense des Animaux du Nord (SDA)</strong><br />
            11 route nationale, 59400 Estourmel${p.establishmentEmail ? ` &nbsp;·&nbsp; <a href="mailto:${escapeHtml(p.establishmentEmail)}" style="color:${PRIMARY};text-decoration:none;">${escapeHtml(p.establishmentEmail)}</a>` : ''}${p.establishmentWebsite ? ` &nbsp;·&nbsp; <a href="${escapeHtml(p.establishmentWebsite)}" style="color:${TEXT_MUTED};text-decoration:none;">${escapeHtml(p.establishmentWebsite.replace(/^https?:\/\//, ''))}</a>` : ''}
          </p>
          <p style="margin:12px 0 0 0;font-size:11px;color:${TEXT_MUTED};line-height:1.5;">
            Association loi 1901 reconnue d'utilité publique &nbsp;·&nbsp; Fourrière conventionnée par arrêté préfectoral
          </p>
        </td></tr>
      </table>

    </td></tr>
  </table>
</body>
</html>`

  return { subject, html }
}
