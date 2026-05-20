// Template HTML pour le visuel "Nouvelles" en SOLO d'un animal sorti du refuge.
// Format social 1080x1350 (ratio 4:5). Typo Baloo 2 + Inter, charte SDA.

import type { Animal, AnimalNews } from '@/lib/types/database'

export interface AnimalNewsSoloData {
  animal: Pick<Animal, 'id' | 'name' | 'species' | 'sex' | 'status' | 'exit_date'>
  news: Pick<AnimalNews, 'text' | 'received_at' | 'received_from'>
  photoDataUrl: string | null
  logoDataUrl?: string
  /** Handle ou nom d'usage à afficher en CTA bas. */
  socialHandle?: string
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Calcule la durée écoulée depuis la sortie du refuge (exit_date).
 * Si pas d'exit_date, retourne null pour ne pas afficher l'eyebrow.
 */
function buildSinceExitLine(exitDate: string | null, status: string): string | null {
  if (!exitDate) return null
  const exit = new Date(exitDate)
  const now = new Date()
  const diffMs = now.getTime() - exit.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  const verb = (() => {
    switch (status) {
      case 'adopted': return 'Adopté'
      case 'foster_family': return 'En famille d’accueil depuis'
      case 'transferred': return 'Transféré'
      case 'returned': return 'Restitué'
      default: return 'Parti'
    }
  })()

  // Pour FA on n'utilise pas "il y a" mais "depuis"
  if (status === 'foster_family') {
    if (diffDays < 7) return `${verb} ${diffDays} jour${diffDays > 1 ? 's' : ''}`
    if (diffDays < 60) {
      const weeks = Math.floor(diffDays / 7)
      return `${verb} ${weeks} semaine${weeks > 1 ? 's' : ''}`
    }
    const months = Math.floor(diffDays / 30)
    if (months < 12) return `${verb} ${months} mois`
    const years = Math.floor(diffDays / 365)
    return `${verb} ${years} an${years > 1 ? 's' : ''}`
  }

  if (diffDays < 7) return `${verb} il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`
  if (diffDays < 60) {
    const weeks = Math.floor(diffDays / 7)
    return `${verb} il y a ${weeks} semaine${weeks > 1 ? 's' : ''}`
  }
  const months = Math.floor(diffDays / 30)
  if (months < 12) return `${verb} il y a ${months} mois`
  const years = Math.floor(diffDays / 365)
  return `${verb} il y a ${years} an${years > 1 ? 's' : ''}`
}

export function buildAnimalNewsSoloHtml(data: AnimalNewsSoloData): string {
  const a = data.animal
  const displayName = a.name && a.name.toUpperCase() !== 'INCONNU' ? a.name : 'lui'

  const sinceLine = buildSinceExitLine(a.exit_date, a.status)
  const text = data.news.text?.trim() || ''

  const photoBlock = data.photoDataUrl
    ? `<img src="${escapeHtml(data.photoDataUrl)}" alt="" class="hero-photo" />`
    : `<div class="hero-photo placeholder"><div class="placeholder-emoji">${a.species === 'cat' ? '🐈' : '🐕'}</div></div>`

  const logoBlock = data.logoDataUrl
    ? `<img src="${escapeHtml(data.logoDataUrl)}" alt="" class="logo-img" />`
    : ''

  const handle = data.socialHandle?.trim() || 'sda-nord.com'

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>Nouvelles de ${escapeHtml(a.name ?? 'Animal')}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap');

  @page { size: 1080px 1350px; margin: 0; }

  :root {
    --navy: #1e3a5f;
    --navy-deep: #15293f;
    --teal: #5ba8a0;
    --terracotta: #c96b3c;
    --paper: #faf8f2;
    --white: #ffffff;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  html, body {
    width: 1080px; height: 1350px;
    font-family: 'Inter', system-ui, sans-serif;
    background: #000;
    color: var(--white);
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .poster { position: relative; width: 1080px; height: 1350px; overflow: hidden; }

  /* === PHOTO PLEIN CADRE === */
  .hero-photo {
    position: absolute; inset: 0;
    width: 100%; height: 100%;
    object-fit: cover;
    z-index: 1;
  }
  .hero-photo.placeholder {
    background: linear-gradient(135deg, #2a3b4d, #1e3a5f);
    display: flex; align-items: center; justify-content: center;
  }
  .placeholder-emoji { font-size: 400px; opacity: 0.3; }

  /* === OVERLAY GRADIENT BAS === */
  .gradient-overlay {
    position: absolute; inset: 0;
    background: linear-gradient(
      to bottom,
      rgba(15, 27, 42, 0.30) 0%,
      transparent 22%,
      transparent 42%,
      rgba(15, 27, 42, 0.65) 58%,
      rgba(15, 27, 42, 0.95) 82%,
      rgba(15, 27, 42, 1) 100%
    );
    z-index: 2;
  }

  /* === HEADER === */
  .header {
    position: absolute; top: 0; left: 0; right: 0;
    z-index: 3;
    padding: 36px 48px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .logo-img {
    width: 96px; height: 96px;
    object-fit: contain;
    background: var(--white);
    border-radius: 50%;
    padding: 10px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.35), 0 0 0 3px rgba(255,255,255,0.15);
  }
  .badge-eyebrow {
    background: var(--teal);
    color: var(--white);
    padding: 16px 28px;
    border-radius: 999px;
    font-family: 'Baloo 2', system-ui, sans-serif;
    font-size: 22px;
    letter-spacing: 0.14em;
    font-weight: 700;
    text-transform: uppercase;
    box-shadow: 0 8px 24px rgba(91, 168, 160, 0.45), 0 0 0 4px rgba(255, 255, 255, 0.12);
  }

  /* === CONTENU BAS === */
  .content {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    z-index: 3;
    padding: 60px 64px 68px 64px;
  }

  .eyebrow {
    font-family: 'Baloo 2', system-ui, sans-serif;
    font-size: 22px;
    letter-spacing: 0.20em;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--terracotta);
    margin-bottom: 14px;
    text-shadow: 0 2px 10px rgba(0,0,0,0.4);
  }

  .headline {
    font-family: 'Baloo 2', system-ui, sans-serif;
    font-size: 86px;
    line-height: 0.95;
    font-weight: 800;
    letter-spacing: -0.015em;
    color: var(--white);
    text-shadow: 0 4px 28px rgba(0,0,0,0.55), 0 2px 6px rgba(0,0,0,0.4);
    font-style: italic;
  }
  .headline .name { font-weight: 800; color: var(--teal); font-style: normal; }

  .quote {
    font-family: 'Baloo 2', system-ui, sans-serif;
    font-style: italic;
    font-size: 28px;
    color: rgba(255,255,255,0.95);
    line-height: 1.4;
    margin-top: 28px;
    padding-left: 22px;
    border-left: 3px solid var(--teal);
    font-weight: 500;
    max-height: 220px;
    overflow: hidden;
  }
  .quote::before { content: '« '; opacity: 0.7; }
  .quote::after { content: ' »'; opacity: 0.7; }

  .cta {
    margin-top: 32px;
    display: flex;
    align-items: center;
    gap: 18px;
    padding-top: 22px;
    border-top: 1px solid rgba(255,255,255,0.18);
  }
  .cta-text {
    font-family: 'Baloo 2', system-ui, sans-serif;
    font-size: 22px;
    font-weight: 600;
    color: rgba(255,255,255,0.85);
    flex: 1;
  }
  .cta-text strong { color: var(--white); font-weight: 700; }
  .cta-handle {
    font-family: 'Baloo 2', system-ui, sans-serif;
    font-size: 22px;
    font-weight: 700;
    color: var(--teal);
    letter-spacing: 0.01em;
    white-space: nowrap;
  }

  /* === BANDE SIGNATURE SDA (orange → teal → navy) === */
  .signature-strip {
    position: absolute;
    left: 0; right: 0; bottom: 0;
    height: 8px;
    z-index: 4;
    background: linear-gradient(90deg, var(--terracotta) 0%, var(--teal) 50%, var(--navy) 100%);
  }
</style>
</head>
<body>
  <div class="poster">
    ${photoBlock}
    <div class="gradient-overlay"></div>

    <header class="header">
      ${logoBlock}
      <div class="badge-eyebrow">Des nouvelles</div>
    </header>

    <div class="content">
      ${sinceLine ? `<div class="eyebrow">${escapeHtml(sinceLine)}</div>` : ''}
      <h1 class="headline">Quoi de neuf,<br/><span class="name">${escapeHtml(displayName)}</span> ?</h1>
      ${text ? `<div class="quote">${escapeHtml(text)}</div>` : ''}
      <div class="cta">
        <div class="cta-text">Suivez nos <strong>anciens pensionnaires</strong></div>
        <div class="cta-handle">${escapeHtml(handle)}</div>
      </div>
    </div>

    <div class="signature-strip"></div>
  </div>
</body>
</html>`
}
