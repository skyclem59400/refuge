// Template HTML pour le visuel "Quelques nouvelles de nos anciens" — MOSAÏQUE.
// Format social 1080x1350 (ratio 4:5). Grille 2x2 (2-4 animaux) ou 2x3 (5-6 animaux).

import type { Animal } from '@/lib/types/database'

export interface MosaicItem {
  animal: Pick<Animal, 'id' | 'name' | 'species' | 'status' | 'exit_date'>
  photoDataUrl: string | null
}

export interface AnimalNewsMosaicData {
  items: MosaicItem[]
  title?: string | null
  logoDataUrl?: string
  /** URL ou handle social affiché en footer. */
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

function buildSinceShort(exitDate: string | null, status: string): string {
  if (!exitDate) {
    if (status === 'foster_family') return 'En FA'
    if (status === 'adopted') return 'Adopté'
    return ''
  }
  const exit = new Date(exitDate)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - exit.getTime()) / (1000 * 60 * 60 * 24))
  const prefix = status === 'foster_family' ? 'En FA depuis' : 'Adopté il y a'

  if (diffDays < 30) {
    const weeks = Math.max(1, Math.floor(diffDays / 7))
    return `${prefix} ${weeks} sem.`
  }
  const months = Math.floor(diffDays / 30)
  if (months < 12) return `${prefix} ${months} mois`
  const years = Math.floor(diffDays / 365)
  return `${prefix} ${years} an${years > 1 ? 's' : ''}`
}

export function buildAnimalNewsMosaicHtml(data: AnimalNewsMosaicData): string {
  const items = data.items.slice(0, 6) // Max 6
  // Grille : 2x2 si 2-4, 2x3 si 5-6
  const isWideGrid = items.length >= 5
  const cols = 2
  const rows = isWideGrid ? 3 : 2

  // Padding pour aligner si moins d'items que de cases
  const totalCells = cols * rows
  const padded: (MosaicItem | null)[] = [...items]
  while (padded.length < totalCells && padded.length < 4) {
    padded.push(null) // Garder 2x2 min, ne pas padder au-delà
  }

  const handle = data.socialHandle?.trim() || 'sda-nord.com'
  const title = data.title?.trim() || 'QUELQUES NOUVELLES DE NOS ANCIENS'

  const logoBlock = data.logoDataUrl
    ? `<img src="${escapeHtml(data.logoDataUrl)}" alt="" class="logo-img" />`
    : ''

  const cellsHtml = padded
    .map((it) => {
      if (!it) {
        return `<div class="cell placeholder"></div>`
      }
      const photo = it.photoDataUrl
        ? `<img src="${escapeHtml(it.photoDataUrl)}" alt="" />`
        : `<div class="cell-emoji">${it.animal.species === 'cat' ? '🐈' : '🐕'}</div>`
      const since = buildSinceShort(it.animal.exit_date, it.animal.status)
      const name = it.animal.name && it.animal.name.toUpperCase() !== 'INCONNU' ? it.animal.name : ''
      return `
        <div class="cell">
          <div class="cell-photo">${photo}</div>
          <div class="cell-overlay">
            <div class="cell-name">${escapeHtml(name)}</div>
            ${since ? `<div class="cell-since">${escapeHtml(since)}</div>` : ''}
          </div>
        </div>`
    })
    .join('')

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>Nouvelles de nos anciens</title>
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
    background: var(--paper);
    color: var(--navy);
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .poster {
    position: relative;
    width: 1080px; height: 1350px;
    background: var(--paper);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .header {
    padding: 36px 48px 24px 48px;
    display: flex; align-items: center; gap: 22px;
    border-bottom: 1px solid rgba(30, 58, 95, 0.10);
  }
  .logo-img {
    width: 84px; height: 84px;
    object-fit: contain;
    background: var(--white);
    border-radius: 50%;
    padding: 8px;
    box-shadow: 0 2px 10px rgba(30,58,95,0.10);
    border: 1px solid rgba(30,58,95,0.10);
    flex-shrink: 0;
  }
  .header-text { flex: 1; }
  .header-eyebrow {
    font-family: 'Baloo 2', system-ui, sans-serif;
    font-size: 16px;
    letter-spacing: 0.20em;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--terracotta);
    margin-bottom: 4px;
  }
  .header-title {
    font-family: 'Baloo 2', system-ui, sans-serif;
    font-size: ${isWideGrid ? '34px' : '40px'};
    font-weight: 800;
    color: var(--navy);
    letter-spacing: -0.01em;
    line-height: 1.05;
  }

  .grid {
    flex: 1;
    padding: 24px 28px 8px 28px;
    display: grid;
    grid-template-columns: repeat(${cols}, 1fr);
    grid-template-rows: repeat(${rows}, 1fr);
    gap: 16px;
  }

  .cell {
    position: relative;
    border-radius: 18px;
    overflow: hidden;
    background: var(--navy);
    box-shadow: 0 6px 18px rgba(30, 58, 95, 0.12);
  }
  .cell.placeholder {
    background: rgba(30, 58, 95, 0.06);
    box-shadow: none;
  }
  .cell-photo { position: absolute; inset: 0; }
  .cell-photo img {
    width: 100%; height: 100%; object-fit: cover;
  }
  .cell-emoji {
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    font-size: 140px; opacity: 0.4;
    background: linear-gradient(135deg, #2a3b4d, var(--navy));
  }
  .cell-overlay {
    position: absolute;
    left: 0; right: 0; bottom: 0;
    padding: 18px 18px 16px 18px;
    background: linear-gradient(
      to bottom,
      transparent 0%,
      rgba(15, 27, 42, 0.55) 40%,
      rgba(15, 27, 42, 0.92) 100%
    );
    color: var(--white);
  }
  .cell-name {
    font-family: 'Baloo 2', system-ui, sans-serif;
    font-size: ${isWideGrid ? '26px' : '32px'};
    font-weight: 800;
    line-height: 1;
    margin-bottom: 4px;
    text-shadow: 0 2px 8px rgba(0,0,0,0.5);
  }
  .cell-since {
    font-family: 'Baloo 2', system-ui, sans-serif;
    font-size: ${isWideGrid ? '13px' : '15px'};
    font-weight: 600;
    color: rgba(255,255,255,0.92);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .footer {
    padding: 24px 48px 36px 48px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-top: 1px solid rgba(30, 58, 95, 0.10);
  }
  .footer-cta {
    font-family: 'Baloo 2', system-ui, sans-serif;
    font-size: 22px;
    font-weight: 700;
    color: var(--navy);
  }
  .footer-cta .accent { color: var(--terracotta); }
  .footer-handle {
    font-family: 'Baloo 2', system-ui, sans-serif;
    font-size: 22px;
    font-weight: 800;
    color: var(--teal);
    padding: 10px 20px;
    background: var(--white);
    border-radius: 999px;
    border: 2px solid var(--teal);
  }

  /* === BANDE SIGNATURE SDA (orange → teal → navy) === */
  .signature-strip {
    position: absolute;
    left: 0; right: 0; bottom: 0;
    height: 8px;
    z-index: 5;
    background: linear-gradient(90deg, var(--terracotta) 0%, var(--teal) 50%, var(--navy) 100%);
  }
</style>
</head>
<body>
  <div class="poster">
    <header class="header">
      ${logoBlock}
      <div class="header-text">
        <div class="header-eyebrow">Les retrouvailles</div>
        <div class="header-title">${escapeHtml(title)}</div>
      </div>
    </header>

    <div class="grid">
      ${cellsHtml}
    </div>

    <footer class="footer">
      <div class="footer-cta">Adoptez vous aussi <span class="accent">→</span></div>
      <div class="footer-handle">${escapeHtml(handle)}</div>
    </footer>

    <div class="signature-strip"></div>
  </div>
</body>
</html>`
}
