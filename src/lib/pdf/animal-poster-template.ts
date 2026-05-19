// Template HTML pour l'affiche d'un animal — Direction B (photo immersive).
// Format social 1080x1350 (ratio 4:5), optimisé Facebook + Instagram fil.
// Typo : Fraunces (serif moderne, charte portail refuge) + Inter (UI).

import type { Animal, AnimalOrigin } from '@/lib/types/database'

export interface AnimalPosterData {
  animal: Pick<
    Animal,
    | 'id' | 'name' | 'species' | 'breed' | 'breed_cross' | 'sex' | 'birth_date'
    | 'color' | 'chip_number' | 'tattoo_number' | 'medal_number' | 'sterilized'
    | 'capture_location' | 'capture_circumstances' | 'pound_entry_date'
    | 'origin_type' | 'status' | 'description_external' | 'adoptable'
  >
  photoDataUrl: string | null
  logoDataUrl?: string
  establishmentPhone?: string
  // Si true, la valeur passée dans establishmentPhone est en fait un email
  establishmentContactIsEmail?: boolean
}

const SPECIES_LABEL: Record<string, string> = {
  cat: 'Chat',
  dog: 'Chien',
  rabbit: 'Lapin',
  rodent: 'Rongeur',
  bird: 'Oiseau',
  ferret: 'Furet',
}

const SEX_LABEL: Record<string, string> = {
  male: 'Mâle',
  female: 'Femelle',
  unknown: 'Sexe inconnu',
}

function calculateAgeFr(birthDate: string | null): string {
  if (!birthDate) return 'Âge inconnu'
  const birth = new Date(birthDate)
  const now = new Date()
  let years = now.getFullYear() - birth.getFullYear()
  let months = now.getMonth() - birth.getMonth()
  if (months < 0) { years--; months += 12 }
  if (years === 0 && months === 0) return 'Quelques semaines'
  if (years === 0) return `${months} mois`
  if (years === 1 && months === 0) return '1 an'
  if (years === 1) return `1 an et ${months} mois`
  if (months === 0) return `${years} ans`
  return `~${years} ans`
}

function isLookingForOwner(origin: AnimalOrigin, status: string): boolean {
  return (origin === 'found' || origin === 'divagation') && (status === 'pound' || status === 'shelter')
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function buildIdentificationLine(a: AnimalPosterData['animal']): string {
  if (a.chip_number) return `Puce •••${a.chip_number.slice(-4)}`
  if (a.tattoo_number) return `Tatouage ${a.tattoo_number}`
  if (a.medal_number) return `Médaille ${a.medal_number}`
  return 'Sans identification'
}

export function buildAnimalPosterHtml(data: AnimalPosterData): string {
  const a = data.animal
  const isFound = isLookingForOwner(a.origin_type, a.status)

  const eyebrow = isFound ? 'AVIS · CHERCHONS PROPRIÉTAIRE' : (a.adoptable ? 'À L\'ADOPTION' : 'NOUVEAU PENSIONNAIRE')
  const headline = isFound ? 'Trouvé(e)' : 'Rencontrez'

  const species = SPECIES_LABEL[a.species] ?? a.species
  const sex = SEX_LABEL[a.sex ?? 'unknown']
  const age = calculateAgeFr(a.birth_date)

  const breedLine = [a.breed, a.breed_cross && 'croisé'].filter(Boolean).join(' ')
  const colorLine = a.color ? a.color.trim() : null
  const identificationLine = buildIdentificationLine(a)
  const sterilizedLine = a.sterilized === true ? 'Stérilisé(e)' : null

  const captureLocation = a.capture_location
  const captureCirc = a.capture_circumstances && isFound ? a.capture_circumstances : null

  const contactValue = data.establishmentPhone ?? ''
  const contactIsEmail = data.establishmentContactIsEmail ?? false
  const hasContact = contactValue.length > 0

  const photoBlock = data.photoDataUrl
    ? `<img src="${escapeHtml(data.photoDataUrl)}" alt="" class="hero-photo" />`
    : `<div class="hero-photo placeholder"><div class="placeholder-emoji">${a.species === 'cat' ? '🐈' : '🐕'}</div></div>`

  const logoBlock = data.logoDataUrl
    ? `<img src="${escapeHtml(data.logoDataUrl)}" alt="" class="logo-img" />`
    : ''

  const displayName = a.name && a.name.toUpperCase() !== 'INCONNU' ? a.name : ''

  // Lignes meta secondaires (race / couleur / identification)
  const metaSecondary: string[] = []
  if (breedLine) metaSecondary.push(breedLine)
  if (colorLine) metaSecondary.push(colorLine)
  metaSecondary.push(identificationLine)
  if (sterilizedLine) metaSecondary.push(sterilizedLine)

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>Affiche - ${escapeHtml(a.name ?? 'Animal')}</title>
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

  .poster {
    position: relative;
    width: 1080px; height: 1350px;
    overflow: hidden;
  }

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

  /* === OVERLAY GRADIENT BAS — un poil plus marqué pour lisibilité sur fonds clairs (chiens blancs) === */
  .gradient-overlay {
    position: absolute; inset: 0;
    background: linear-gradient(
      to bottom,
      transparent 0%,
      transparent 32%,
      rgba(15, 27, 42, 0.55) 50%,
      rgba(15, 27, 42, 0.92) 78%,
      rgba(15, 27, 42, 1) 100%
    );
    z-index: 2;
  }

  /* === HEADER (logo + bandeau) === */
  .header {
    position: absolute;
    top: 0; left: 0; right: 0;
    z-index: 3;
    padding: 36px 48px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: linear-gradient(to bottom, rgba(15, 27, 42, 0.7), transparent);
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
    background: var(--terracotta);
    color: var(--white);
    padding: 16px 28px;
    border-radius: 999px;
    font-family: 'Baloo 2', system-ui, sans-serif;
    font-size: 22px;
    letter-spacing: 0.14em;
    font-weight: 700;
    text-transform: uppercase;
    box-shadow: 0 8px 24px rgba(201, 107, 60, 0.55), 0 0 0 4px rgba(255, 255, 255, 0.12);
  }

  /* === CONTENU BAS === */
  .content {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    z-index: 3;
    padding: 60px 64px 72px 64px;
  }

  .headline-prefix {
    font-family: 'Baloo 2', system-ui, sans-serif;
    font-size: 22px;
    letter-spacing: 0.22em;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--teal);
    margin-bottom: 12px;
    text-shadow: 0 2px 10px rgba(0,0,0,0.4);
  }

  .headline {
    font-family: 'Baloo 2', system-ui, sans-serif;
    font-size: 108px;
    line-height: 0.95;
    font-weight: 800;
    letter-spacing: -0.015em;
    margin-bottom: 8px;
    color: var(--white);
    text-shadow: 0 4px 28px rgba(0,0,0,0.55), 0 2px 6px rgba(0,0,0,0.4);
  }
  .headline .name {
    font-weight: 800;
    color: var(--teal);
  }

  .location {
    font-family: 'Baloo 2', system-ui, sans-serif;
    font-size: 28px;
    font-weight: 600;
    color: rgba(255,255,255,0.95);
    margin-top: 18px;
    margin-bottom: 28px;
    letter-spacing: 0.02em;
    text-shadow: 0 2px 8px rgba(0,0,0,0.35);
  }
  .location-pin { color: var(--terracotta); font-weight: 700; margin-right: 6px; }
  .location strong {
    font-weight: 700;
    color: var(--white);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  /* Meta principale : espèce · sexe · âge */
  .meta-main {
    font-family: 'Baloo 2', system-ui, sans-serif;
    font-size: 26px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--white);
    margin-bottom: 8px;
    padding-bottom: 18px;
    border-bottom: 1px solid rgba(255,255,255,0.22);
    text-shadow: 0 2px 8px rgba(0,0,0,0.35);
  }
  .meta-main-sep { color: var(--teal); margin: 0 12px; }

  .meta-secondary {
    font-family: 'Baloo 2', system-ui, sans-serif;
    font-size: 19px;
    color: rgba(255,255,255,0.9);
    line-height: 1.5;
    margin-top: 14px;
    margin-bottom: 18px;
    font-weight: 500;
  }
  .meta-secondary span { display: inline-block; }
  .meta-secondary .sep { color: var(--teal); margin: 0 10px; opacity: 0.6; }

  .circumstances {
    font-family: 'Baloo 2', system-ui, sans-serif;
    font-style: italic;
    font-size: 20px;
    color: rgba(255,255,255,0.78);
    line-height: 1.4;
    margin-bottom: 24px;
    padding-left: 14px;
    border-left: 2px solid var(--teal);
    font-weight: 500;
  }

  /* === CTA Phone === */
  .cta {
    margin-top: 28px;
    display: flex;
    align-items: center;
    gap: 20px;
  }
  .cta-icon {
    flex: 0 0 64px;
    width: 64px; height: 64px;
    border-radius: 50%;
    background: var(--teal);
    display: flex; align-items: center; justify-content: center;
    color: var(--white);
    box-shadow: 0 4px 20px rgba(91, 168, 160, 0.4);
  }
  .cta-icon svg { width: 28px; height: 28px; }
  .cta-content {
    flex: 1;
  }
  .cta-label {
    font-family: 'Baloo 2', system-ui, sans-serif;
    font-size: 14px;
    letter-spacing: 0.18em;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--teal);
    margin-bottom: 4px;
  }
  .cta-phone {
    font-family: 'Baloo 2', system-ui, sans-serif;
    font-size: 48px;
    font-weight: 700;
    color: var(--white);
    line-height: 1;
    letter-spacing: -0.005em;
    text-shadow: 0 2px 10px rgba(0,0,0,0.4);
  }
</style>
</head>
<body>
  <div class="poster">
    ${photoBlock}
    <div class="gradient-overlay"></div>

    <header class="header">
      ${logoBlock}
      <div class="badge-eyebrow">${escapeHtml(eyebrow)}</div>
    </header>

    <div class="content">
      <div class="headline-prefix">${escapeHtml(headline)}</div>
      <h1 class="headline">
        ${displayName ? `<span class="name">${escapeHtml(displayName)}</span>` : (isFound ? '<span class="name">cet animal</span>' : '<span class="name">notre pensionnaire</span>')}
      </h1>

      ${captureLocation ? `
        <div class="location">
          <span class="location-pin">●</span>À <strong>${escapeHtml(captureLocation)}</strong>
        </div>
      ` : ''}

      <div class="meta-main">
        ${escapeHtml(species)}<span class="meta-main-sep">·</span>${escapeHtml(sex)}<span class="meta-main-sep">·</span>${escapeHtml(age)}
      </div>

      ${metaSecondary.length > 0 ? `
        <div class="meta-secondary">
          ${metaSecondary.map((s, i) => `<span>${escapeHtml(s)}</span>${i < metaSecondary.length - 1 ? '<span class="sep">/</span>' : ''}`).join('')}
        </div>
      ` : ''}

      ${captureCirc ? `<div class="circumstances">« ${escapeHtml(captureCirc)} »</div>` : ''}

      ${hasContact ? `
      <div class="cta">
        <div class="cta-icon">
          ${contactIsEmail
            ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/></svg>`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`
          }
        </div>
        <div class="cta-content">
          <div class="cta-label">${isFound ? 'Vous le reconnaissez ?' : 'Pour le rencontrer'}</div>
          <div class="cta-phone">${escapeHtml(contactValue)}</div>
        </div>
      </div>
      ` : ''}
    </div>
  </div>
</body>
</html>`
}
