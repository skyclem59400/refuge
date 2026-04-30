import type { Animal, Box } from '@/lib/types/database'

interface BoxAnimal extends Pick<Animal,
  'id' | 'name' | 'species' | 'breed' | 'breed_cross' | 'sex' | 'birth_date' |
  'color' | 'chip_number' | 'sterilized' | 'photo_url'
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

function speciesLabel(s: string) {
  if (s === 'cat') return 'Chat'
  if (s === 'dog') return 'Chien'
  if (s === 'mixed') return 'Mixte'
  return s
}

function sexLabel(s: string) {
  if (s === 'male') return 'Mâle'
  if (s === 'female') return 'Femelle'
  return 'Inconnu'
}

function statusLabel(s: string) {
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
  if (!birthDate) return '—'
  const birth = new Date(birthDate)
  const now = new Date()
  const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
  if (months < 1) return "< 1 mois"
  if (months < 12) return `${months} mois`
  const years = Math.floor(months / 12)
  return `${years} an${years > 1 ? 's' : ''}`
}

export function buildBoxSheetHtml(args: BuildArgs): string {
  const { box, animals, establishmentName, establishmentAddress, establishmentPhone, logoBase64, generatedAt } = args
  const today = generatedAt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const animalRows = animals.length === 0
    ? `<tr><td colspan="6" style="text-align:center;color:#888;padding:24px;">Aucun animal dans ce box</td></tr>`
    : animals.map((a) => {
        const photo = a.primary_photo || a.photo_url
        const photoCell = photo
          ? `<img src="${photo}" alt="${a.name}" style="width:60px;height:60px;object-fit:cover;border-radius:6px;border:1px solid #ddd;" />`
          : `<div style="width:60px;height:60px;border-radius:6px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:10px;">—</div>`
        const breedTxt = [a.breed, a.breed_cross].filter(Boolean).join(' × ') || '—'
        return `<tr>
          <td>${photoCell}</td>
          <td><strong>${a.name}</strong></td>
          <td>${speciesLabel(a.species)} — ${sexLabel(a.sex)}</td>
          <td>${breedTxt}</td>
          <td>${ageLabel(a.birth_date)}</td>
          <td>${a.chip_number || '—'}</td>
        </tr>`
      }).join('')

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<title>Fiche box ${box.name}</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#111; font-size:11pt; margin:0; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:14px; border-bottom:2px solid #111; margin-bottom:18px; }
  .logo { width:90px; height:auto; }
  .establishment { font-size:9.5pt; color:#444; line-height:1.4; }
  .title { text-align:center; margin-bottom:18px; }
  .title h1 { margin:0; font-size:22pt; }
  .meta { display:grid; grid-template-columns: 1fr 1fr 1fr; gap:14px; padding:14px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; margin-bottom:18px; }
  .meta-item .label { font-size:8.5pt; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; margin-bottom:3px; }
  .meta-item .value { font-size:13pt; font-weight:600; }
  .badge { display:inline-block; padding:3px 10px; border-radius:999px; font-size:9pt; font-weight:600; }
  .badge.available { background:#d1fae5; color:#065f46; }
  .badge.occupied { background:#fef3c7; color:#92400e; }
  .badge.maintenance { background:#fee2e2; color:#991b1b; }
  table { width:100%; border-collapse:collapse; }
  th, td { padding:10px 8px; border-bottom:1px solid #e5e7eb; vertical-align:middle; font-size:10pt; }
  th { background:#f9fafb; text-align:left; font-size:9pt; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; }
  .footer { position:fixed; bottom:6mm; left:14mm; right:14mm; display:flex; justify-content:space-between; font-size:8.5pt; color:#9ca3af; border-top:1px solid #e5e7eb; padding-top:6px; }
</style>
</head>
<body>
  <div class="header">
    <div>
      ${logoBase64 ? `<img class="logo" src="${logoBase64}" alt="Logo" />` : `<div style="font-weight:700;font-size:14pt;">${establishmentName}</div>`}
    </div>
    <div class="establishment">
      <strong>${establishmentName}</strong><br />
      ${establishmentAddress || ''}<br />
      ${establishmentPhone || ''}
    </div>
  </div>

  <div class="title">
    <h1>Fiche du box ${box.name}</h1>
  </div>

  <div class="meta">
    <div class="meta-item">
      <div class="label">Type</div>
      <div class="value">${speciesLabel(box.species_type)}</div>
    </div>
    <div class="meta-item">
      <div class="label">Capacité</div>
      <div class="value">${animals.length} / ${box.capacity}</div>
    </div>
    <div class="meta-item">
      <div class="label">Statut</div>
      <div class="value"><span class="badge ${box.status}">${statusLabel(box.status)}</span></div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Photo</th>
        <th>Nom</th>
        <th>Espèce / Sexe</th>
        <th>Race / Croisement</th>
        <th>Âge</th>
        <th>N° puce</th>
      </tr>
    </thead>
    <tbody>${animalRows}</tbody>
  </table>

  <div class="footer">
    <span>Imprimé le ${today}</span>
    <span>${establishmentName}</span>
  </div>
</body>
</html>`
}

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
  const occupied = boxes.filter((b) => b.status === 'occupied').length
  const available = boxes.filter((b) => b.status === 'available').length

  const rows = boxes.length === 0
    ? `<tr><td colspan="5" style="text-align:center;color:#888;padding:24px;">Aucun box</td></tr>`
    : boxes.map((b) => {
        const animalsTxt = b.animals.map((a) => a.name).join(', ') || '—'
        return `<tr>
          <td><strong>${b.name}</strong></td>
          <td>${speciesLabel(b.species_type)}</td>
          <td>${b.animal_count} / ${b.capacity}</td>
          <td><span class="badge ${b.status}">${statusLabel(b.status)}</span></td>
          <td style="font-size:9.5pt;">${animalsTxt}</td>
        </tr>`
      }).join('')

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<title>Liste des box — ${establishmentName}</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#111; font-size:11pt; margin:0; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:14px; border-bottom:2px solid #111; margin-bottom:18px; }
  .logo { width:90px; height:auto; }
  .establishment { font-size:9.5pt; color:#444; line-height:1.4; text-align:right; }
  .title { text-align:center; margin-bottom:18px; }
  .title h1 { margin:0; font-size:20pt; }
  .stats { display:grid; grid-template-columns: repeat(4,1fr); gap:12px; margin-bottom:16px; }
  .stat { padding:10px 12px; border:1px solid #e5e7eb; border-radius:8px; background:#f9fafb; }
  .stat .label { font-size:8.5pt; text-transform:uppercase; color:#6b7280; }
  .stat .value { font-size:16pt; font-weight:700; margin-top:2px; }
  table { width:100%; border-collapse:collapse; }
  th, td { padding:8px; border-bottom:1px solid #e5e7eb; font-size:10pt; }
  th { background:#f9fafb; text-align:left; font-size:9pt; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; }
  .badge { display:inline-block; padding:2px 8px; border-radius:999px; font-size:9pt; font-weight:600; }
  .badge.available { background:#d1fae5; color:#065f46; }
  .badge.occupied { background:#fef3c7; color:#92400e; }
  .badge.maintenance { background:#fee2e2; color:#991b1b; }
  .footer { position:fixed; bottom:6mm; left:14mm; right:14mm; display:flex; justify-content:space-between; font-size:8.5pt; color:#9ca3af; border-top:1px solid #e5e7eb; padding-top:6px; }
</style>
</head>
<body>
  <div class="header">
    <div>
      ${logoBase64 ? `<img class="logo" src="${logoBase64}" alt="Logo" />` : `<div style="font-weight:700;font-size:14pt;">${establishmentName}</div>`}
    </div>
    <div class="establishment">
      <strong>${establishmentName}</strong><br />
      ${establishmentAddress || ''}<br />
      ${establishmentPhone || ''}
    </div>
  </div>

  <div class="title">
    <h1>Liste des box</h1>
  </div>

  <div class="stats">
    <div class="stat"><div class="label">Total box</div><div class="value">${boxes.length}</div></div>
    <div class="stat"><div class="label">Capacité totale</div><div class="value">${totalCapacity}</div></div>
    <div class="stat"><div class="label">Animaux hébergés</div><div class="value">${totalAnimals}</div></div>
    <div class="stat"><div class="label">Disponibles / Occupés</div><div class="value">${available} / ${occupied}</div></div>
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

  <div class="footer">
    <span>Imprimé le ${today}</span>
    <span>${establishmentName}</span>
  </div>
</body>
</html>`
}
