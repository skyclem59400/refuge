/**
 * Charte graphique officielle de la SDA — référence : courrier candidats Cambrai 2026.
 *
 * Cette palette est utilisée transversalement dans tous les documents générés
 * (convention FA, contrat adoption, certificats vétérinaires, courriers, emails).
 *
 * Source de référence : `/Users/clement/Projets/SDA/lab/courrier-candidats-cambrai/courrier-template.html`
 */

// === Couleurs principales ====================================================

/** Bleu marine — couleur principale (texte fort, en-têtes, séparateurs) */
export const SDA_NAVY = '#1e3a5f'

/** Teal — couleur secondaire (accents, sous-titre "Défendons les animaux", liens) */
export const SDA_TEAL = '#5ba8a0'

/** Orange terracotta — couleur tertiaire (numérotation sections, mises en avant, CTA) */
export const SDA_ORANGE = '#c96b3c'

// === Couleurs neutres ========================================================

/** Bleu intermédiaire (texte secondaire, formules) */
export const SDA_NAVY_LIGHT = '#3d5a80'

/** Bleu gris (texte muted, méta) */
export const SDA_MUTED = '#6b7f96'

/** Bordure standard */
export const SDA_BORDER = '#d9e6ed'

// === Fonds ===================================================================

/** Fond doux principal (page background) */
export const SDA_BG = '#f0f7fa'

/** Fond surface neutre (cards intérieures) */
export const SDA_SURFACE_NEUTRAL = '#f8fafb'

/** Gradient orange clair (highlights, mises en avant) */
export const SDA_HIGHLIGHT_GRADIENT = 'linear-gradient(135deg, #fdf4ee 0%, #fef9f5 100%)'

/** Fond légal (références juridiques) */
export const SDA_LEGAL_BG = '#f8fafb'

// === Footer accent ===========================================================

/** Gradient signature SDA — orange → teal → bleu marine, 3px bottom strip */
export const SDA_FOOTER_ACCENT_GRADIENT =
  'linear-gradient(90deg, #c96b3c 0%, #5ba8a0 50%, #1e3a5f 100%)'

// === Typographie =============================================================

export const SDA_FONT_FAMILY =
  "'Helvetica Neue', Helvetica, Arial, sans-serif"

export const SDA_FONT_SERIF = "Georgia, 'Times New Roman', serif"

// === Identité ================================================================

export const SDA_ORG_NAME_FULL = "SDA d'Estourmel"
export const SDA_ORG_TAGLINE = 'DÉFENDONS LES ANIMAUX'
export const SDA_ORG_LEGAL = 'Société de Défense des Animaux du Nord'
export const SDA_ORG_ADDRESS = '11 route nationale — 59400 Estourmel'
export const SDA_ORG_PHONE = '06 84 41 89 34'
export const SDA_ORG_EMAIL = 'c.scailteux@sda-nord.com'
export const SDA_ORG_WEBSITE = 'www.sda-nord.com'

// === Helpers HTML ============================================================

/**
 * En-tête type "courrier officiel" : logo + nom + tagline + adresse, séparateur navy 2.5px.
 * Utilisable dans tous les documents SDA. Si logoBase64 absent, fallback texte.
 */
export function renderSdaHeader(opts: {
  logoBase64?: string | null
  /** Adresse à afficher (override l'adresse SDA par défaut) */
  address?: string | null
  /** Téléphone à afficher (override) */
  phone?: string | null
  /** Email à afficher (override) */
  email?: string | null
}): string {
  const address = opts.address ?? SDA_ORG_ADDRESS
  const phone = opts.phone ?? SDA_ORG_PHONE
  const email = opts.email ?? SDA_ORG_EMAIL
  const logoImg = opts.logoBase64
    ? `<img src="${opts.logoBase64}" alt="Logo SDA d'Estourmel" style="width:80px;height:80px;object-fit:contain;flex-shrink:0;" />`
    : ''
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8mm;padding-bottom:4mm;border-bottom:2.5px solid ${SDA_NAVY};">
      <div style="display:flex;align-items:center;gap:14px;">
        ${logoImg}
        <div>
          <div style="font-size:18pt;font-weight:700;color:${SDA_NAVY};letter-spacing:1px;line-height:1.1;">
            <span style="color:${SDA_TEAL};">SDA</span> d'Estourmel
          </div>
          <div style="font-size:9pt;color:${SDA_TEAL};font-weight:600;text-transform:uppercase;letter-spacing:2px;margin-top:2px;">
            ${SDA_ORG_TAGLINE}
          </div>
          <div style="font-size:8.5pt;color:${SDA_MUTED};margin-top:4px;line-height:1.4;">
            ${escapeHtml(address)}<br/>
            ${phone ? escapeHtml(phone) : ''}${phone && email ? ' &mdash; ' : ''}${email ? escapeHtml(email) : ''}
          </div>
        </div>
      </div>
    </div>
  `.trim()
}

/**
 * Footer type "courrier officiel" : adresse + site + accent gradient bottom 3px.
 */
export function renderSdaFooter(): string {
  return `
    <div>
      <div style="padding-top:3mm;border-top:2px solid ${SDA_NAVY};display:flex;justify-content:space-between;align-items:center;font-size:7.5pt;color:${SDA_MUTED};">
        <div style="line-height:1.4;">
          <strong style="color:${SDA_NAVY};">${SDA_ORG_NAME_FULL}</strong> &mdash; ${SDA_ORG_TAGLINE.toLowerCase()}<br/>
          ${SDA_ORG_ADDRESS}<br/>
          ${SDA_ORG_PHONE} &mdash; ${SDA_ORG_EMAIL}
        </div>
        <div style="text-align:right;color:${SDA_TEAL};font-weight:600;font-size:8pt;">${SDA_ORG_WEBSITE}</div>
      </div>
      <div style="height:3px;background:${SDA_FOOTER_ACCENT_GRADIENT};margin-top:2mm;border-radius:2px;"></div>
    </div>
  `.trim()
}

/** Cercle numéroté orange pour les sections (1, 2, 3…) */
export function renderSdaSectionNumber(n: number): string {
  return `<span style="display:inline-flex;align-items:center;justify-content:center;background:${SDA_ORANGE};color:white;width:18px;height:18px;border-radius:50%;font-size:8.5pt;font-weight:700;flex-shrink:0;">${n}</span>`
}

/** Box highlight orange (mise en avant d'engagement, info clé) */
export function renderSdaHighlight(htmlContent: string): string {
  return `<div style="background:${SDA_HIGHLIGHT_GRADIENT};border-left:3px solid ${SDA_ORANGE};padding:2.5mm 4mm;margin:2mm 0 3mm 0;font-size:9.5pt;border-radius:0 4px 4px 0;color:${SDA_NAVY};">${htmlContent}</div>`
}

/** Box légale (références juridiques, mentions L.214-8 etc.) */
export function renderSdaLegalBox(title: string, htmlContent: string): string {
  return `<div style="background:${SDA_LEGAL_BG};border:1px solid ${SDA_BORDER};border-radius:4px;padding:3mm 4mm;margin:3mm 0 4mm 0;font-size:9pt;color:${SDA_NAVY_LIGHT};line-height:1.5;">
    <div style="font-weight:700;color:${SDA_NAVY};font-size:9.5pt;margin-bottom:1.5mm;">${escapeHtml(title)}</div>
    ${htmlContent}
  </div>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
