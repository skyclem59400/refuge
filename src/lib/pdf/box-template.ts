import type { Animal, Box } from '@/lib/types/database'

interface BoxAnimal extends Pick<Animal,
  'id' | 'name' | 'species' | 'breed' | 'breed_cross' | 'sex' | 'birth_date' |
  'color' | 'chip_number' | 'sterilized' | 'photo_url' | 'status' | 'description' |
  'description_external' | 'adoptable' | 'reserved' | 'shelter_entry_date' | 'pound_entry_date'
> {
  primary_photo?: string | null
}

interface BuildArgs {
  box: Box
  animals: BoxAnimal[]
  establishmentName: string
  establishmentAddress: string
  establishmentPhone: string
  logoBase64?: string
  generatedAt: Date
}

// ---------------------------------------------------------------------------
// Charte graphique SDA — bleu marine + teal + orange terracotta
// ---------------------------------------------------------------------------

const SDA = {
  navy: '#0F2340',
  navyLight: '#1B3556',
  teal: '#0E7C7B',
  tealLight: '#14B8A6',
  terracotta: '#C2410C',
  terracottaLight: '#EA580C',
  cream: '#FAF7F2',
  paper: '#FFFFFF',
  text: '#1C1C1C',
  muted: '#6B6B6B',
  line: '#E5E1DA',
  // Statuts animaux
  shelter: '#0E7C7B',
  pound: '#D97706',
  fosterFamily: '#7C3AED',
  boarding: '#0891B2',
  adoptable: '#0E7C7B',
  reserved: '#D97706',
}

// ---------------------------------------------------------------------------
// Helpers d'affichage
// ---------------------------------------------------------------------------

function speciesLabel(s: string) {
  if (s === 'cat') return 'Chat'
  if (s === 'dog') return 'Chien'
  if (s === 'mixed') return 'Mixte'
  return s
}

function speciesEmoji(s: string) {
  if (s === 'cat') return '🐱'
  if (s === 'dog') return '🐶'
  return '🐾'
}

function sexLabel(s: string) {
  if (s === 'male') return 'Mâle'
  if (s === 'female') return 'Femelle'
  return 'Inconnu'
}

function sexSymbol(s: string) {
  if (s === 'male') return '♂'
  if (s === 'female') return '♀'
  return ''
}

function statusBadge(s: string): { label: string; color: string } {
  switch (s) {
    case 'shelter': return { label: 'Refuge', color: SDA.shelter }
    case 'pound': return { label: 'Fourrière', color: SDA.pound }
    case 'foster_family': return { label: 'Famille d’accueil', color: SDA.fosterFamily }
    case 'boarding': return { label: 'Pension', color: SDA.boarding }
    default: return { label: s || '—', color: SDA.muted }
  }
}

function boxStatusLabel(s: string) {
  if (s === 'available') return 'Disponible'
  if (s === 'occupied') return 'Occupé'
  if (s === 'maintenance') return 'Maintenance'
  return s
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function ageLabel(birthDate: string | null): string {
  if (!birthDate) return 'Âge inconnu'
  const birth = new Date(birthDate)
  const now = new Date()
  const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
  if (months < 1) return 'Moins d’1 mois'
  if (months < 12) return `${months} mois`
  const years = Math.floor(months / 12)
  return `${years} an${years > 1 ? 's' : ''}`
}

// ---------------------------------------------------------------------------
// CSS partagé charte SDA
// ---------------------------------------------------------------------------

function sdaStyles(): string {
  return `
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      color: ${SDA.text};
      font-size: 11pt;
      background: ${SDA.cream};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 0;
      background: ${SDA.cream};
      position: relative;
    }
    /* Header bleu marine */
    .sda-header {
      background: ${SDA.navy};
      color: white;
      padding: 16mm 14mm 12mm;
      position: relative;
      overflow: hidden;
    }
    .sda-header::before {
      content: '';
      position: absolute;
      top: -40mm; right: -30mm;
      width: 100mm; height: 100mm;
      border-radius: 50%;
      background: rgba(255,255,255,0.04);
    }
    .sda-header::after {
      content: '';
      position: absolute;
      bottom: -20mm; left: -20mm;
      width: 60mm; height: 60mm;
      border-radius: 50%;
      background: ${SDA.teal};
      opacity: 0.18;
    }
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 14mm;
      position: relative;
      z-index: 1;
    }
    .logo-block { display: flex; align-items: center; gap: 4mm; }
    .logo-img { width: 18mm; height: 18mm; object-fit: contain; background: white; border-radius: 3mm; padding: 2mm; }
    .estab-name { font-size: 13pt; font-weight: 700; letter-spacing: 0.5px; }
    .estab-meta { font-size: 8.5pt; opacity: 0.8; line-height: 1.5; margin-top: 1mm; }
    .doc-label {
      text-align: right;
      font-size: 8.5pt;
      letter-spacing: 4px;
      text-transform: uppercase;
      opacity: 0.6;
      margin-bottom: 2mm;
    }
    .doc-title-right {
      text-align: right;
      font-size: 11pt;
      font-weight: 600;
    }
    /* Bandeau orange : titre du box */
    .box-banner {
      background: ${SDA.terracotta};
      color: white;
      padding: 8mm 14mm;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10mm;
    }
    .box-banner .left h1 {
      font-size: 28pt;
      font-weight: 800;
      letter-spacing: -0.5px;
      line-height: 1;
    }
    .box-banner .left .sub {
      font-size: 10pt;
      opacity: 0.9;
      margin-top: 2mm;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .box-banner .badges {
      display: flex;
      gap: 3mm;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .pill {
      display: inline-block;
      padding: 2mm 4mm;
      border-radius: 999px;
      font-size: 9pt;
      font-weight: 700;
      letter-spacing: 0.5px;
      background: rgba(255,255,255,0.18);
      color: white;
      backdrop-filter: blur(4px);
    }
    .pill.solid {
      background: white;
      color: ${SDA.terracotta};
    }
    /* Footer */
    .sda-footer {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: ${SDA.navy};
      color: white;
      padding: 5mm 14mm;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 8.5pt;
    }
    .sda-footer .accent {
      width: 6mm;
      height: 1px;
      background: ${SDA.terracotta};
      display: inline-block;
      margin: 0 3mm;
      vertical-align: middle;
    }
    /* Contenu principal */
    .main { padding: 8mm 14mm 25mm; }
  `
}

// ---------------------------------------------------------------------------
// Fiche d'un box (1 page complète, charte SDA)
// ---------------------------------------------------------------------------

export function buildBoxSheetHtml(args: BuildArgs): string {
  const {
    box,
    animals,
    establishmentName,
    establishmentAddress,
    establishmentPhone,
    logoBase64,
    generatedAt,
  } = args
  const today = generatedAt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const animalCards = animals.length === 0
    ? `<div class="empty">
         <div class="empty-icon">${speciesEmoji(box.species_type)}</div>
         <div class="empty-title">Box disponible</div>
         <div class="empty-sub">Capacité ${box.capacity} place${box.capacity > 1 ? 's' : ''} · ${speciesLabel(box.species_type)}</div>
       </div>`
    : animals.map((a) => animalCard(a)).join('')

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<title>Fiche box ${box.name} — ${establishmentName}</title>
<style>
  ${sdaStyles()}

  .empty {
    text-align: center;
    padding: 30mm 0;
    color: ${SDA.muted};
  }
  .empty-icon { font-size: 60pt; }
  .empty-title { font-size: 24pt; font-weight: 800; color: ${SDA.navy}; margin-top: 4mm; }
  .empty-sub { font-size: 11pt; margin-top: 2mm; }

  .animal-card {
    background: white;
    border: 1px solid ${SDA.line};
    border-radius: 4mm;
    overflow: hidden;
    margin-bottom: 6mm;
    page-break-inside: avoid;
    display: grid;
    grid-template-columns: 70mm 1fr;
    min-height: 70mm;
  }
  .animal-card.solo { grid-template-columns: 90mm 1fr; min-height: 90mm; }

  .animal-photo {
    background: ${SDA.cream};
    position: relative;
    overflow: hidden;
  }
  .animal-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .animal-photo.empty-photo {
    background: linear-gradient(135deg, ${SDA.navy} 0%, ${SDA.navyLight} 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 60pt;
  }
  .animal-photo .corner-tag {
    position: absolute;
    top: 3mm; left: 3mm;
    background: ${SDA.terracotta};
    color: white;
    font-size: 8pt;
    font-weight: 800;
    padding: 1.5mm 3mm;
    border-radius: 1mm;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .animal-photo .corner-tag.adoptable { background: ${SDA.teal}; }
  .animal-photo .corner-tag.reserved { background: ${SDA.terracotta}; }

  .animal-info {
    padding: 6mm 7mm;
    display: flex;
    flex-direction: column;
    gap: 3mm;
  }
  .animal-name {
    display: flex;
    align-items: baseline;
    gap: 3mm;
    margin-bottom: 1mm;
  }
  .animal-name h2 {
    font-size: 22pt;
    font-weight: 800;
    color: ${SDA.navy};
    letter-spacing: -0.5px;
    line-height: 1;
  }
  .animal-name .sex {
    font-size: 18pt;
    font-weight: 700;
    line-height: 1;
  }
  .sex.male { color: ${SDA.boarding}; }
  .sex.female { color: ${SDA.terracotta}; }

  .animal-row {
    display: grid;
    grid-template-columns: 28mm 1fr;
    gap: 2mm;
    font-size: 10pt;
    padding: 1.5mm 0;
    border-bottom: 1px solid ${SDA.line};
  }
  .animal-row:last-child { border-bottom: none; }
  .animal-row .lbl {
    color: ${SDA.muted};
    text-transform: uppercase;
    font-size: 8pt;
    letter-spacing: 0.8px;
    font-weight: 700;
    align-self: center;
  }
  .animal-row .val {
    font-weight: 600;
    color: ${SDA.text};
  }
  .animal-row .val .status-pill {
    display: inline-block;
    padding: 1mm 2.5mm;
    border-radius: 999px;
    font-size: 8.5pt;
    font-weight: 700;
    color: white;
    letter-spacing: 0.5px;
  }

  .animal-flags {
    display: flex;
    gap: 2mm;
    margin-top: 1mm;
    flex-wrap: wrap;
  }
  .flag {
    background: ${SDA.cream};
    border: 1px solid ${SDA.line};
    border-radius: 1mm;
    padding: 1mm 2.5mm;
    font-size: 8pt;
    font-weight: 600;
    color: ${SDA.muted};
  }
  .flag.adoptable { background: ${SDA.teal}; color: white; border-color: ${SDA.teal}; }
  .flag.reserved { background: ${SDA.terracotta}; color: white; border-color: ${SDA.terracotta}; }
  .flag.sterile { background: ${SDA.navy}; color: white; border-color: ${SDA.navy}; }

  .description {
    margin-top: 2mm;
    padding-top: 2mm;
    border-top: 1px solid ${SDA.line};
    font-size: 9.5pt;
    line-height: 1.4;
    color: ${SDA.text};
    font-style: italic;
  }

  .meta-strip {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0;
    background: white;
    border: 1px solid ${SDA.line};
    border-radius: 3mm;
    margin-bottom: 6mm;
    overflow: hidden;
  }
  .meta-cell {
    padding: 4mm 5mm;
    border-right: 1px solid ${SDA.line};
  }
  .meta-cell:last-child { border-right: none; }
  .meta-cell .lbl {
    font-size: 7.5pt;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    color: ${SDA.terracotta};
    font-weight: 700;
    margin-bottom: 1.5mm;
  }
  .meta-cell .val {
    font-size: 14pt;
    font-weight: 800;
    color: ${SDA.navy};
  }
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
        <div class="doc-label">Fiche d'identité</div>
        <div class="doc-title-right">Box du refuge</div>
      </div>
    </div>
  </header>

  <div class="box-banner">
    <div class="left">
      <h1>${box.name}</h1>
      <div class="sub">${speciesEmoji(box.species_type)} ${speciesLabel(box.species_type)} · Capacité ${box.capacity}</div>
    </div>
    <div class="badges">
      <span class="pill solid">${animals.length} / ${box.capacity}</span>
      <span class="pill">${boxStatusLabel(box.status)}</span>
    </div>
  </div>

  <main class="main">
    <div class="meta-strip">
      <div class="meta-cell">
        <div class="lbl">Pensionnaires</div>
        <div class="val">${animals.length}</div>
      </div>
      <div class="meta-cell">
        <div class="lbl">Capacité</div>
        <div class="val">${box.capacity}</div>
      </div>
      <div class="meta-cell">
        <div class="lbl">Type</div>
        <div class="val">${speciesLabel(box.species_type)}</div>
      </div>
    </div>

    ${animalCards}
  </main>

  <footer class="sda-footer">
    <span><strong>${establishmentName}</strong><span class="accent"></span>${establishmentPhone || ''}</span>
    <span>Édité le ${today}</span>
  </footer>
</div>
</body>
</html>`
}

function animalCard(a: BoxAnimal): string {
  const photo = a.primary_photo || a.photo_url
  const status = statusBadge(a.status as string)
  const sex = sexSymbol(a.sex as string)
  const sexClass = a.sex === 'male' ? 'male' : a.sex === 'female' ? 'female' : ''
  const breed = [a.breed, a.breed_cross].filter(Boolean).join(' × ') || '—'
  const entryDate = a.shelter_entry_date || a.pound_entry_date
  const desc = a.description_external || a.description

  let cornerTag = ''
  if (a.adoptable) cornerTag = `<span class="corner-tag adoptable">Adoptable</span>`
  if (a.reserved) cornerTag = `<span class="corner-tag reserved">Réservé</span>`

  return `<div class="animal-card">
    <div class="animal-photo ${photo ? '' : 'empty-photo'}">
      ${photo ? `<img src="${photo}" alt="${a.name}" />` : speciesEmoji(a.species)}
      ${cornerTag}
    </div>
    <div class="animal-info">
      <div class="animal-name">
        <h2>${(a.name || '').toUpperCase()}</h2>
        ${sex ? `<span class="sex ${sexClass}">${sex}</span>` : ''}
      </div>

      <div class="animal-row">
        <span class="lbl">Espèce</span>
        <span class="val">${speciesLabel(a.species)} · ${breed}</span>
      </div>
      <div class="animal-row">
        <span class="lbl">Âge</span>
        <span class="val">${ageLabel(a.birth_date)}${a.color ? ` · ${a.color}` : ''}</span>
      </div>
      <div class="animal-row">
        <span class="lbl">Statut</span>
        <span class="val">
          <span class="status-pill" style="background:${status.color}">${status.label}</span>
        </span>
      </div>
      ${entryDate ? `<div class="animal-row">
        <span class="lbl">Arrivée</span>
        <span class="val">${formatDate(entryDate)}</span>
      </div>` : ''}
      ${a.chip_number ? `<div class="animal-row">
        <span class="lbl">N° puce</span>
        <span class="val" style="font-family: monospace; font-size: 9pt;">${a.chip_number}</span>
      </div>` : ''}

      <div class="animal-flags">
        ${a.adoptable ? `<span class="flag adoptable">À l'adoption</span>` : ''}
        ${a.reserved ? `<span class="flag reserved">Réservé</span>` : ''}
        ${a.sterilized ? `<span class="flag sterile">Stérilisé</span>` : ''}
      </div>

      ${desc ? `<div class="description">"${desc.length > 200 ? desc.slice(0, 200) + '…' : desc}"</div>` : ''}
    </div>
  </div>`
}

// ---------------------------------------------------------------------------
// Liste des box (charte SDA aussi)
// ---------------------------------------------------------------------------

interface BoxListPdfArgs {
  boxes: (Box & { animal_count: number; animals: { id: string; name: string; species: string }[] })[]
  establishmentName: string
  establishmentAddress: string
  establishmentPhone: string
  logoBase64?: string
  generatedAt: Date
}

export function buildBoxListHtml(args: BoxListPdfArgs): string {
  const { boxes, establishmentName, establishmentAddress, establishmentPhone, logoBase64, generatedAt } = args
  const today = generatedAt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const totalCapacity = boxes.reduce((s, b) => s + b.capacity, 0)
  const totalAnimals = boxes.reduce((s, b) => s + b.animal_count, 0)
  const occupied = boxes.filter((b) => b.animal_count > 0).length
  const available = boxes.filter((b) => b.animal_count === 0 && b.status === 'available').length

  const rows = boxes.length === 0
    ? `<tr><td colspan="5" style="text-align:center;color:${SDA.muted};padding:8mm;font-style:italic;">Aucun box enregistré</td></tr>`
    : boxes.map((b) => {
        const animalsTxt = b.animals.map((a) => a.name).join(', ') || '—'
        const isFull = b.animal_count >= b.capacity
        const fillRatio = b.capacity > 0 ? (b.animal_count / b.capacity) * 100 : 0
        return `<tr>
          <td><strong style="color:${SDA.navy};font-size:11pt;">${b.name}</strong></td>
          <td>${speciesEmoji(b.species_type)} ${speciesLabel(b.species_type)}</td>
          <td>
            <div style="display:flex;align-items:center;gap:2mm;">
              <span style="font-weight:700;color:${isFull ? SDA.terracotta : SDA.navy};">${b.animal_count} / ${b.capacity}</span>
              <div style="flex:1;height:2mm;background:${SDA.line};border-radius:1mm;overflow:hidden;max-width:20mm;">
                <div style="height:100%;width:${fillRatio}%;background:${isFull ? SDA.terracotta : SDA.teal};"></div>
              </div>
            </div>
          </td>
          <td><span class="badge ${b.status}">${boxStatusLabel(b.status)}</span></td>
          <td style="font-size:9pt;color:${SDA.muted};">${animalsTxt}</td>
        </tr>`
      }).join('')

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<title>Liste des box — ${establishmentName}</title>
<style>
  ${sdaStyles()}

  .stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4mm;
    margin-bottom: 6mm;
  }
  .stat-card {
    background: white;
    border: 1px solid ${SDA.line};
    border-radius: 3mm;
    padding: 5mm;
    text-align: center;
  }
  .stat-card.accent {
    background: ${SDA.navy};
    color: white;
    border-color: ${SDA.navy};
  }
  .stat-card.terracotta {
    background: ${SDA.terracotta};
    color: white;
    border-color: ${SDA.terracotta};
  }
  .stat-card .lbl {
    font-size: 7.5pt;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    font-weight: 700;
    margin-bottom: 2mm;
    opacity: 0.8;
  }
  .stat-card .val {
    font-size: 22pt;
    font-weight: 800;
    line-height: 1;
  }

  table { width: 100%; border-collapse: collapse; background: white; border-radius: 3mm; overflow: hidden; border: 1px solid ${SDA.line}; }
  th, td { padding: 3.5mm 4mm; text-align: left; vertical-align: middle; }
  thead th {
    background: ${SDA.navy};
    color: white;
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    font-weight: 700;
  }
  tbody tr { border-top: 1px solid ${SDA.line}; }
  tbody tr:nth-child(even) { background: ${SDA.cream}; }

  .badge {
    display: inline-block;
    padding: 1mm 3mm;
    border-radius: 999px;
    font-size: 8.5pt;
    font-weight: 700;
    letter-spacing: 0.5px;
  }
  .badge.available { background: ${SDA.teal}; color: white; }
  .badge.occupied { background: ${SDA.terracotta}; color: white; }
  .badge.maintenance { background: ${SDA.muted}; color: white; }
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
        <div class="doc-label">Inventaire</div>
        <div class="doc-title-right">Liste des box</div>
      </div>
    </div>
  </header>

  <div class="box-banner">
    <div class="left">
      <h1>Vue d'ensemble</h1>
      <div class="sub">${boxes.length} box · ${totalAnimals} animaux hébergés</div>
    </div>
  </div>

  <main class="main">
    <div class="stats">
      <div class="stat-card accent">
        <div class="lbl">Total box</div>
        <div class="val">${boxes.length}</div>
      </div>
      <div class="stat-card">
        <div class="lbl">Capacité totale</div>
        <div class="val">${totalCapacity}</div>
      </div>
      <div class="stat-card terracotta">
        <div class="lbl">Animaux hébergés</div>
        <div class="val">${totalAnimals}</div>
      </div>
      <div class="stat-card">
        <div class="lbl">Disponibles</div>
        <div class="val" style="color:${SDA.teal};">${available}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Box</th>
          <th>Type</th>
          <th>Occupation</th>
          <th>Statut</th>
          <th>Animaux</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </main>

  <footer class="sda-footer">
    <span><strong>${establishmentName}</strong><span class="accent"></span>${establishmentPhone || ''}</span>
    <span>Édité le ${today} · ${occupied} occupé${occupied !== 1 ? 's' : ''} sur ${boxes.length}</span>
  </footer>
</div>
</body>
</html>`
}
