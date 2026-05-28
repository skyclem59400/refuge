import type { CompanyInfo } from '@/lib/types/database'

/**
 * Cachet rond officiel (style "tampon administratif") généré en SVG à partir
 * des infos de l'établissement. Utilisé dans les contrats (FA, adoption,
 * abandon, annulation) à la place de l'encart de signature vide du refuge.
 *
 * Pourquoi un SVG plutôt qu'une image PNG : pas d'asset à maintenir par
 * établissement, le cachet s'adapte automatiquement si le nom/adresse change.
 */
export function buildCachetSvg(company: Partial<CompanyInfo>): string {
  const name = (company.name || '').toUpperCase()
  const legalName = (company.legal_name || '').toUpperCase()
  const address = company.address || ''
  const email = company.email || ''

  const topText = legalName || name
  const centerName = name
  const bottomText = email || address

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
    <defs>
      <path id="cachetTopArc" d="M 16,120 a 104,104 0 0,1 208,0" fill="none" />
      <path id="cachetBottomArc" d="M 224,120 a 104,104 0 0,1 -208,0" fill="none" />
    </defs>

    <circle cx="120" cy="120" r="112" fill="none" stroke="#1e3a6e" stroke-width="3" />
    <circle cx="120" cy="120" r="102" fill="none" stroke="#1e3a6e" stroke-width="1.5" />

    <text x="22" y="124" font-size="10" fill="#1e3a6e" text-anchor="middle">★</text>
    <text x="218" y="124" font-size="10" fill="#1e3a6e" text-anchor="middle">★</text>

    <text font-family="Helvetica, Arial, sans-serif" font-size="10" font-weight="700" fill="#1e3a6e" letter-spacing="1">
      <textPath href="#cachetTopArc" startOffset="50%" text-anchor="middle">${topText}</textPath>
    </text>

    <text font-family="Helvetica, Arial, sans-serif" font-size="9" fill="#1e3a6e" letter-spacing="0.5">
      <textPath href="#cachetBottomArc" startOffset="50%" text-anchor="middle">${bottomText}</textPath>
    </text>

    <line x1="48" y1="100" x2="192" y2="100" stroke="#1e3a6e" stroke-width="0.7" />
    <line x1="48" y1="142" x2="192" y2="142" stroke="#1e3a6e" stroke-width="0.7" />

    <text x="120" y="118" font-family="Helvetica, Arial, sans-serif" font-size="22" font-weight="800" fill="#1e3a6e" text-anchor="middle">${centerName}</text>

    <text x="120" y="134" font-family="Helvetica, Arial, sans-serif" font-size="7" fill="#1e3a6e" opacity="0.8" text-anchor="middle">${address}</text>
  </svg>`
}
