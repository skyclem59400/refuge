// Template HTML pour l'affiche d'un animal (entrée fourrière / à l'adoption).
// Format A4 portrait, design éditorial sobre type "magazine".
// Destiné à l'impression + publication réseaux sociaux (PDF puis screenshot).

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
  establishmentName?: string
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
  if (months < 0) {
    years--
    months += 12
  }
  if (years === 0 && months === 0) return 'Quelques semaines'
  if (years === 0) return `${months} mois`
  if (years === 1 && months === 0) return '1 an'
  if (years === 1) return `1 an et ${months} mois`
  if (months === 0) return `${years} ans`
  return `~${years} ans`
}

function formatDateFr(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return ''
  }
}

function isLookingForOwner(origin: AnimalOrigin, status: string): boolean {
  // Cas "cherche propriétaire" : trouvé / divagation ET encore dans le délai
  // (status pound = fourrière en cours)
  return (origin === 'found' || origin === 'divagation') && (status === 'pound' || status === 'shelter')
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildIdentificationLine(a: AnimalPosterData['animal']): string {
  const parts: string[] = []
  if (a.chip_number) parts.push(`Puce ${a.chip_number.slice(-6)}`)
  else if (a.tattoo_number) parts.push(`Tatouage ${a.tattoo_number}`)
  else if (a.medal_number) parts.push(`Médaille ${a.medal_number}`)
  else parts.push('Aucune identification')
  return parts.join(' · ')
}

export function buildAnimalPosterHtml(data: AnimalPosterData): string {
  const a = data.animal
  const isFound = isLookingForOwner(a.origin_type, a.status)
  const eyebrow = isFound ? 'AVIS · CHERCHONS PROPRIÉTAIRE' : (a.adoptable ? 'À L\'ADOPTION' : 'NOUVEAU PENSIONNAIRE')
  const headline = isFound ? 'Trouvé(e)' : 'À adopter'

  const species = SPECIES_LABEL[a.species] ?? a.species
  const sex = SEX_LABEL[a.sex ?? 'unknown']
  const age = calculateAgeFr(a.birth_date)

  const breedLine = [a.breed, a.breed_cross && 'croisé(e)'].filter(Boolean).join(' ')
  const colorLine = a.color ? `Robe : ${a.color}` : null
  const identificationLine = buildIdentificationLine(a)
  const sterilizedLine = a.sterilized === true ? 'Stérilisé(e)' : (a.sterilized === false ? 'Non stérilisé(e)' : null)

  const captureLocation = a.capture_location
  const captureCirc = a.capture_circumstances
  const entryDate = a.pound_entry_date ? formatDateFr(a.pound_entry_date) : null

  const phone = data.establishmentPhone ?? '03 27 83 32 70'
  const orgName = data.establishmentName ?? 'Société de Défense des Animaux du Nord'

  const photoBlock = data.photoDataUrl
    ? `<img src="${escapeHtml(data.photoDataUrl)}" alt="" class="photo" />`
    : `<div class="photo placeholder"><div class="placeholder-emoji">${a.species === 'cat' ? '🐈' : '🐕'}</div></div>`

  const logoBlock = data.logoDataUrl
    ? `<img src="${escapeHtml(data.logoDataUrl)}" alt="" class="logo" />`
    : `<div class="logo-text">SDA</div>`

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>Affiche - ${escapeHtml(a.name ?? 'Animal')}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@400;500;600;700&display=swap');

  @page {
    size: A4 portrait;
    margin: 0;
  }

  :root {
    --navy: #1e3a5f;
    --navy-deep: #15293f;
    --teal: #5ba8a0;
    --paper: #faf8f2;
    --stone-200: #e7e5e4;
    --stone-500: #78716c;
    --stone-700: #44403c;
    --stone-900: #1c1917;
    --accent: #c96b3c;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  html, body {
    width: 210mm;
    height: 297mm;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    background: var(--paper);
    color: var(--stone-900);
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .page {
    width: 210mm;
    height: 297mm;
    display: flex;
    flex-direction: column;
    background: var(--paper);
  }

  /* === HEADER BANDEAU NAVY === */
  .header {
    background: var(--navy);
    color: var(--paper);
    padding: 8mm 12mm;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 3px solid var(--teal);
  }

  .header-left { display: flex; align-items: center; gap: 4mm; }
  .logo { width: 14mm; height: 14mm; object-fit: contain; }
  .logo-text {
    width: 14mm; height: 14mm;
    background: var(--paper); color: var(--navy);
    display: flex; align-items: center; justify-content: center;
    font-family: 'Cormorant Garamond', serif;
    font-weight: 600; font-size: 7mm; border-radius: 50%;
  }
  .header-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 4.2mm; line-height: 1.1; letter-spacing: 0.01em;
  }
  .header-subtitle {
    font-size: 2.6mm; letter-spacing: 0.18em;
    color: var(--teal); text-transform: uppercase;
    margin-top: 0.8mm; font-weight: 600;
  }

  .header-right {
    text-align: right;
    font-size: 3mm; letter-spacing: 0.22em; font-weight: 700;
    text-transform: uppercase; color: var(--paper);
  }
  .header-eyebrow { color: var(--teal); margin-bottom: 1mm; }
  .header-date { font-size: 2.4mm; color: var(--paper); opacity: 0.7; font-weight: 500; letter-spacing: 0.1em; }

  /* === PHOTO === */
  .photo-wrap {
    flex: 0 0 130mm;
    width: 210mm;
    background: var(--stone-200);
    overflow: hidden;
    position: relative;
  }
  .photo {
    width: 100%; height: 100%; object-fit: cover; display: block;
  }
  .photo.placeholder {
    display: flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, var(--stone-200), #d6d3d1);
  }
  .placeholder-emoji {
    font-size: 60mm; opacity: 0.4;
  }

  /* === BLOC INFO === */
  .info {
    flex: 1;
    padding: 10mm 14mm 8mm 14mm;
    display: flex; flex-direction: column;
    background: var(--paper);
  }

  .info-headline {
    font-family: 'Cormorant Garamond', serif;
    font-size: 16mm;
    line-height: 1;
    color: var(--navy);
    margin-bottom: 1mm;
  }
  .info-headline .accent {
    font-style: italic; color: var(--teal); font-weight: 400;
  }
  .info-divider {
    width: 18mm; height: 1px;
    background: var(--accent);
    margin: 4mm 0 5mm 0;
  }
  .info-location {
    font-size: 4mm; letter-spacing: 0.05em;
    color: var(--stone-700); font-weight: 500;
    margin-bottom: 5mm;
  }
  .info-location strong {
    color: var(--navy); font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .info-meta {
    font-size: 3.4mm; letter-spacing: 0.06em;
    color: var(--stone-700);
    text-transform: uppercase; font-weight: 600;
    margin-bottom: 3.5mm;
  }
  .info-meta-detail {
    font-size: 3.3mm; color: var(--stone-700);
    margin-bottom: 1.8mm; font-weight: 400; line-height: 1.4;
  }
  .info-meta-detail strong { color: var(--navy); font-weight: 600; }

  /* === CTA TÉLÉPHONE === */
  .cta {
    margin-top: auto;
    padding-top: 6mm;
    border-top: 1px solid var(--stone-200);
  }
  .cta-label {
    font-size: 2.8mm; letter-spacing: 0.15em;
    color: var(--stone-500); text-transform: uppercase;
    margin-bottom: 2mm; font-weight: 600;
  }
  .cta-phone {
    font-family: 'Cormorant Garamond', serif;
    font-size: 11mm; color: var(--navy);
    line-height: 1; font-weight: 500;
  }
  .cta-org {
    font-size: 3mm; color: var(--stone-500);
    margin-top: 2mm; letter-spacing: 0.02em;
  }
</style>
</head>
<body>
  <div class="page">
    <header class="header">
      <div class="header-left">
        ${logoBlock}
        <div>
          <div class="header-title">Société de Défense<br/>des Animaux du Nord</div>
          <div class="header-subtitle">Estourmel · depuis 1864</div>
        </div>
      </div>
      <div class="header-right">
        <div class="header-eyebrow">${escapeHtml(eyebrow)}</div>
        ${entryDate ? `<div class="header-date">Entrée le ${escapeHtml(entryDate)}</div>` : ''}
      </div>
    </header>

    <div class="photo-wrap">
      ${photoBlock}
    </div>

    <main class="info">
      <h1 class="info-headline">
        ${escapeHtml(headline)}<span class="accent"> ${escapeHtml(a.name && a.name !== 'INCONNU' ? `· ${a.name}` : '')}</span>
      </h1>
      <div class="info-divider"></div>

      ${captureLocation ? `<div class="info-location">À <strong>${escapeHtml(captureLocation)}</strong></div>` : ''}

      <div class="info-meta">
        ${escapeHtml(species)} · ${escapeHtml(sex)} · ${escapeHtml(age)}
      </div>

      ${breedLine ? `<div class="info-meta-detail"><strong>Race :</strong> ${escapeHtml(breedLine)}</div>` : ''}
      ${colorLine ? `<div class="info-meta-detail">${escapeHtml(colorLine)}</div>` : ''}
      <div class="info-meta-detail">${escapeHtml(identificationLine)}${sterilizedLine ? ` · ${escapeHtml(sterilizedLine)}` : ''}</div>
      ${captureCirc && isFound ? `<div class="info-meta-detail" style="margin-top: 3mm; font-style: italic; color: var(--stone-500);">${escapeHtml(captureCirc)}</div>` : ''}

      <div class="cta">
        <div class="cta-label">${isFound ? 'Vous reconnaissez cet animal ?' : 'Pour en savoir plus'}</div>
        <div class="cta-phone">☎ ${escapeHtml(phone)}</div>
        <div class="cta-org">${escapeHtml(orgName)} · 28 rue du Marais, 59400 Estourmel</div>
      </div>
    </main>
  </div>
</body>
</html>`
}
