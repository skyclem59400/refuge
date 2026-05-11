import type { Box, Animal } from '@/lib/types/database'

interface ZoneAnimal extends Pick<Animal,
  'id' | 'name' | 'species' | 'breed' | 'breed_cross' | 'sex' | 'birth_date' |
  'color' | 'chip_number' | 'sterilized' | 'photo_url' | 'status' | 'adoptable' | 'reserved'
> {
  primary_photo?: string | null
}

interface ZoneBox extends Box {
  animals: ZoneAnimal[]
  zone_label?: string
}

interface BuildArgs {
  zoneName: string
  zoneDescription?: string | null
  subzoneGroups: { label: string; boxes: ZoneBox[] }[]
  totalBoxes: number
  totalAnimals: number
  totalCapacity: number
  establishmentName: string
  establishmentAddress: string
  establishmentPhone: string
  logoBase64?: string
  generatedAt: Date
}

// Charte SDA
const SDA = {
  navy: '#0F2340',
  teal: '#0E7C7B',
  terracotta: '#C2410C',
  cream: '#FAF7F2',
  text: '#1C1C1C',
  muted: '#6B6B6B',
  line: '#E5E1DA',
  shelter: '#0E7C7B',
  pound: '#D97706',
  fosterFamily: '#7C3AED',
  boarding: '#0891B2',
}

function speciesLabel(s: string) {
  if (s === 'cat') return 'Chats'
  if (s === 'dog') return 'Chiens'
  if (s === 'mixed') return 'Mixte'
  return s
}
function speciesEmoji(s: string) {
  if (s === 'cat') return '🐱'
  if (s === 'dog') return '🐶'
  return '🐾'
}
function sexSymbol(s: string) {
  if (s === 'male') return '♂'
  if (s === 'female') return '♀'
  return ''
}
function animalStatus(s: string | null) {
  switch (s) {
    case 'shelter': return { label: 'Refuge', color: SDA.shelter }
    case 'pound': return { label: 'Fourrière', color: SDA.pound }
    case 'foster_family': return { label: 'FA', color: SDA.fosterFamily }
    case 'boarding': return { label: 'Pension', color: SDA.boarding }
    default: return { label: s ?? '—', color: SDA.muted }
  }
}
function ageLabel(birth: string | null): string {
  if (!birth) return '—'
  const bd = new Date(birth)
  if (Number.isNaN(bd.getTime())) return '—'
  const now = new Date()
  let years = now.getFullYear() - bd.getFullYear()
  const m = now.getMonth() - bd.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < bd.getDate())) years--
  if (years < 1) {
    const months = Math.max(
      0,
      (now.getFullYear() - bd.getFullYear()) * 12 + (now.getMonth() - bd.getMonth())
    )
    return `${months}m`
  }
  return `${years}a`
}

export function buildZoneSheetHtml(args: BuildArgs): string {
  const {
    zoneName,
    zoneDescription,
    subzoneGroups,
    totalBoxes,
    totalAnimals,
    totalCapacity,
    establishmentName,
    establishmentAddress,
    establishmentPhone,
    logoBase64,
    generatedAt,
  } = args
  const today = generatedAt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const subzonesHtml = subzoneGroups.map((g) => `
    <section class="subzone">
      <h3 class="subzone-title">${g.label} <span class="count">· ${g.boxes.length} box · ${g.boxes.reduce((s, b) => s + b.animals.length, 0)} animaux</span></h3>
      <div class="boxes-row">
        ${g.boxes.map((b) => renderBoxTile(b)).join('')}
      </div>
    </section>
  `).join('')

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8" />
<title>Fiche chenil ${zoneName} — ${establishmentName}</title>
<style>
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    color: ${SDA.text};
    font-size: 10pt;
    background: ${SDA.cream};
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page { width: 297mm; min-height: 210mm; padding: 0; position: relative; }

  .sda-header {
    background: ${SDA.navy};
    color: white;
    padding: 10mm 14mm 8mm;
    position: relative;
    overflow: hidden;
  }
  .sda-header::after {
    content: '';
    position: absolute;
    top: -20mm; right: -20mm;
    width: 60mm; height: 60mm;
    border-radius: 50%;
    background: ${SDA.teal};
    opacity: 0.18;
  }
  .header-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 14mm; position: relative; z-index: 1; }
  .logo-block { display: flex; align-items: center; gap: 4mm; }
  .logo-img { width: 14mm; height: 14mm; object-fit: contain; background: white; border-radius: 2mm; padding: 1.5mm; }
  .estab-name { font-size: 11pt; font-weight: 700; letter-spacing: 0.5px; }
  .estab-meta { font-size: 7.5pt; opacity: 0.8; line-height: 1.4; }
  .doc-label { text-align: right; font-size: 7.5pt; letter-spacing: 4px; text-transform: uppercase; opacity: 0.6; }
  .doc-title-right { text-align: right; font-size: 10pt; font-weight: 600; }

  .zone-banner {
    background: ${SDA.terracotta};
    color: white;
    padding: 6mm 14mm;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10mm;
  }
  .zone-banner h1 {
    font-size: 24pt;
    font-weight: 800;
    letter-spacing: -0.5px;
    line-height: 1;
  }
  .zone-banner .sub { font-size: 9pt; opacity: 0.9; margin-top: 1.5mm; letter-spacing: 1px; text-transform: uppercase; }
  .stats { display: flex; gap: 3mm; }
  .stat-pill {
    background: rgba(255,255,255,0.2);
    color: white;
    padding: 2mm 4mm;
    border-radius: 999px;
    font-size: 8.5pt;
    font-weight: 700;
    letter-spacing: 0.5px;
  }
  .stat-pill.solid { background: white; color: ${SDA.terracotta}; }

  .main { padding: 6mm 12mm 16mm; }

  .subzone { margin-bottom: 6mm; page-break-inside: avoid; }
  .subzone-title {
    font-size: 11pt;
    font-weight: 800;
    color: ${SDA.navy};
    text-transform: uppercase;
    letter-spacing: 1.5px;
    margin-bottom: 3mm;
    padding-bottom: 1.5mm;
    border-bottom: 2px solid ${SDA.terracotta};
    display: inline-block;
  }
  .subzone-title .count {
    font-size: 8.5pt;
    color: ${SDA.muted};
    font-weight: 500;
    letter-spacing: 0.5px;
    text-transform: none;
    margin-left: 2mm;
  }

  .boxes-row {
    display: flex;
    flex-wrap: wrap;
    gap: 3mm;
  }
  .box-tile {
    width: 50mm;
    background: white;
    border: 1px solid ${SDA.line};
    border-radius: 2mm;
    overflow: hidden;
    page-break-inside: avoid;
  }
  .box-tile .photo {
    width: 100%;
    height: 28mm;
    object-fit: cover;
    display: block;
    background: ${SDA.cream};
  }
  .box-tile .placeholder {
    width: 100%;
    height: 28mm;
    background: ${SDA.cream};
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22pt;
  }
  .box-tile .body {
    padding: 2mm 2.5mm;
  }
  .box-tile .box-name {
    font-size: 9pt;
    font-weight: 800;
    color: ${SDA.navy};
    text-transform: uppercase;
    letter-spacing: 0.5px;
    line-height: 1.1;
  }
  .box-tile .box-cap {
    font-size: 7.5pt;
    color: ${SDA.muted};
    margin-top: 0.5mm;
  }
  .box-tile .animal {
    margin-top: 1.5mm;
    padding-top: 1.5mm;
    border-top: 1px solid ${SDA.line};
  }
  .box-tile .animal-name {
    font-size: 8.5pt;
    font-weight: 700;
    color: ${SDA.text};
    line-height: 1.1;
  }
  .box-tile .animal-meta {
    font-size: 7pt;
    color: ${SDA.muted};
    margin-top: 0.5mm;
    line-height: 1.2;
  }
  .box-tile .status-pill {
    display: inline-block;
    padding: 0.5mm 1.5mm;
    border-radius: 999px;
    font-size: 6pt;
    font-weight: 700;
    color: white;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    margin-right: 1mm;
  }
  .box-tile .more {
    font-size: 7pt;
    color: ${SDA.muted};
    font-style: italic;
    margin-top: 0.5mm;
  }
  .box-tile.empty .body { background: ${SDA.cream}; }

  .sda-footer {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: ${SDA.navy};
    color: white;
    padding: 4mm 14mm;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 7.5pt;
  }
  .sda-footer .accent { width: 6mm; height: 1px; background: ${SDA.terracotta}; display: inline-block; margin: 0 3mm; vertical-align: middle; }
</style>
</head>
<body>
<div class="page">
  <header class="sda-header">
    <div class="header-row">
      <div class="logo-block">
        ${logoBase64 ? `<img class="logo-img" src="${logoBase64}" alt="Logo" />` : ''}
        <div>
          <div class="estab-name">${establishmentName}</div>
          ${establishmentAddress ? `<div class="estab-meta">${establishmentAddress}</div>` : ''}
          ${establishmentPhone ? `<div class="estab-meta">${establishmentPhone}</div>` : ''}
        </div>
      </div>
      <div>
        <div class="doc-label">Récapitulatif</div>
        <div class="doc-title-right">Fiche chenil</div>
      </div>
    </div>
  </header>

  <div class="zone-banner">
    <div>
      <h1>${zoneName}</h1>
      <div class="sub">${zoneDescription ?? ''}</div>
    </div>
    <div class="stats">
      <span class="stat-pill solid">${totalBoxes} box</span>
      <span class="stat-pill">${totalAnimals} / ${totalCapacity} animaux</span>
    </div>
  </div>

  <main class="main">
    ${subzoneGroups.length === 0
      ? `<p style="text-align:center;color:${SDA.muted};padding:30mm 0;font-style:italic;">Aucun box dans ce chenil.</p>`
      : subzonesHtml}
  </main>

  <footer class="sda-footer">
    <span><strong>${establishmentName}</strong><span class="accent"></span>${establishmentPhone || ''}</span>
    <span>Édité le ${today}</span>
  </footer>
</div>
</body>
</html>`
}

function renderBoxTile(b: ZoneBox): string {
  const isEmpty = b.animals.length === 0
  const first = b.animals[0]
  const photo = first?.primary_photo || first?.photo_url
  const status = animalStatus(first?.status ?? null)
  const sex = first ? sexSymbol(first.sex as string) : ''
  const more = b.animals.length > 1 ? b.animals.length - 1 : 0

  const photoBlock = !isEmpty && photo
    ? `<img class="photo" src="${photo}" alt="${first?.name ?? ''}" />`
    : `<div class="placeholder">${speciesEmoji(b.species_type)}</div>`

  return `<div class="box-tile ${isEmpty ? 'empty' : ''}">
    ${photoBlock}
    <div class="body">
      <div class="box-name">${b.name}</div>
      <div class="box-cap">${b.animals.length} / ${b.capacity} · ${speciesLabel(b.species_type)}</div>
      ${first ? `
        <div class="animal">
          <div class="animal-name">
            <span class="status-pill" style="background:${status.color}">${status.label}</span>
            ${first.name} ${sex}
          </div>
          <div class="animal-meta">
            ${[first.breed, ageLabel(first.birth_date as string)].filter(Boolean).join(' · ')}
            ${first.chip_number ? `<br/><span style="font-family:monospace;">${first.chip_number}</span>` : ''}
          </div>
          ${more > 0 ? `<div class="more">+ ${more} autre${more > 1 ? 's' : ''}</div>` : ''}
        </div>
      ` : ''}
    </div>
  </div>`
}
