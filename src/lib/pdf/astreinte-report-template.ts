import { SDA_NAVY, SDA_TEAL, SDA_ORANGE, SDA_BORDER, SDA_MUTED } from './sda-brand'

export interface AstreinteReportData {
  ticketNumber: string
  createdAt: string
  acknowledgedAt: string | null
  onRouteAt: string | null
  onSiteAt: string | null
  completedAt: string | null
  agentName: string | null
  declarantName: string | null
  declarantOrganization: string | null
  declarantEmail: string
  declarantPhone: string | null
  municipalityName: string | null
  locationAddress: string | null
  interventionType: string
  animalSpecies: string | null
  animalCount: number
  animalBreed: string | null
  animalSize: string | null
  animalColor: string | null
  animalInjured: boolean | null
  animalDangerous: boolean | null
  description: string | null
  outcome: string | null
  destination: string | null
  comments: string | null
  isNightIntervention: boolean
  logoBase64: string | undefined
  photoBase64s: string[]
}

const INTERVENTION_TYPE_LABELS: Record<string, string> = {
  divagation: 'Divagation animal',
  dangerous: 'Animal dangereux',
  requisition: 'Réquisition judiciaire',
  veterinary_emergency: 'Urgence vétérinaire',
}

const SPECIES_LABELS: Record<string, string> = {
  dog: 'Chien',
  cat: 'Chat',
  other: 'Autre',
  unknown: 'Inconnue',
}

const SIZE_LABELS: Record<string, string> = {
  small: 'Petit',
  medium: 'Moyen',
  large: 'Grand',
  unknown: 'Inconnu',
}

const OUTCOME_LABELS: Record<string, string> = {
  animal_recovered: 'Animal pris en charge',
  not_found: 'Animal non trouvé',
  refused: 'Prise en charge refusée',
  deceased: 'Animal décédé',
  transferred_owner: 'Restitué au propriétaire',
  other: 'Autre',
}

const DESTINATION_LABELS: Record<string, string> = {
  refuge_sda: 'Refuge SDA d’Estourmel',
  veterinary: 'Clinique vétérinaire',
  owner_returned: 'Restitué au propriétaire',
  euthanasia: 'Euthanasie',
  on_site_release: 'Relâché sur place',
  other: 'Autre',
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  })
}

function fmtDuration(fromIso: string | null, toIso: string | null): string {
  if (!fromIso || !toIso) return '—'
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime()
  if (ms < 0) return '—'
  const totalMin = Math.round(ms / 60000)
  if (totalMin < 60) return `${totalMin} min`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return m === 0 ? `${h} h` : `${h} h ${m.toString().padStart(2, '0')}`
}

function escape(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatMultiline(s: string | null | undefined): string {
  if (!s) return '<em style="color:' + SDA_MUTED + '">Aucune observation.</em>'
  return escape(s).replace(/\n/g, '<br/>')
}

export function buildAstreinteReportHtml(data: AstreinteReportData): string {
  const interventionLabel = INTERVENTION_TYPE_LABELS[data.interventionType] ?? data.interventionType
  const speciesLabel = data.animalSpecies ? SPECIES_LABELS[data.animalSpecies] ?? data.animalSpecies : '—'
  const sizeLabel = data.animalSize ? SIZE_LABELS[data.animalSize] ?? data.animalSize : null
  const outcomeLabel = data.outcome ? OUTCOME_LABELS[data.outcome] ?? data.outcome : '—'
  const destinationLabel = data.destination ? DESTINATION_LABELS[data.destination] ?? data.destination : '—'

  const mobilizationDuration = fmtDuration(data.acknowledgedAt, data.onSiteAt)
  const interventionDuration = fmtDuration(data.onSiteAt, data.completedAt)
  const totalDuration = fmtDuration(data.acknowledgedAt, data.completedAt)

  const animalAttrs: string[] = []
  if (sizeLabel) animalAttrs.push(`Taille : ${sizeLabel}`)
  if (data.animalColor) animalAttrs.push(`Couleur/robe : ${escape(data.animalColor)}`)
  if (data.animalBreed) animalAttrs.push(`Race : ${escape(data.animalBreed)}`)
  if (data.animalInjured) animalAttrs.push('Animal blessé')
  if (data.animalDangerous) animalAttrs.push('Animal signalé dangereux')

  const photosHtml = data.photoBase64s.length
    ? `<div class="photos">
        ${data.photoBase64s
          .map((src) => `<div class="photo"><img src="${src}" alt="Photo intervention" /></div>`)
          .join('')}
       </div>`
    : ''

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>Compte-rendu intervention ${escape(data.ticketNumber)}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: ${SDA_NAVY}; margin: 0; padding: 0; font-size: 10pt; line-height: 1.45; }
  .page { padding: 28pt 32pt 36pt 32pt; }
  header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 14pt; border-bottom: 2px solid ${SDA_NAVY}; }
  header .brand { display: flex; align-items: center; gap: 10pt; }
  header .brand img { height: 42pt; width: auto; }
  header .brand-text .name { font-size: 13pt; font-weight: 800; letter-spacing: 0.5pt; }
  header .brand-text .sub { font-size: 8pt; color: ${SDA_TEAL}; text-transform: uppercase; letter-spacing: 1.4pt; font-weight: 700; }
  header .ref { text-align: right; font-size: 8pt; color: ${SDA_MUTED}; }
  header .ref .num { font-size: 11pt; color: ${SDA_NAVY}; font-weight: 700; letter-spacing: 0.4pt; }
  h1 { font-size: 20pt; font-weight: 800; margin: 22pt 0 4pt; letter-spacing: 0.3pt; }
  .lede { color: ${SDA_MUTED}; font-size: 9pt; margin: 0 0 18pt; }
  .badge { display: inline-block; font-size: 8pt; font-weight: 700; letter-spacing: 0.6pt; text-transform: uppercase; padding: 3pt 8pt; border-radius: 999px; background: ${SDA_TEAL}; color: white; }
  .badge.night { background: ${SDA_ORANGE}; }
  section { margin-top: 16pt; page-break-inside: avoid; }
  h2 { font-size: 9pt; font-weight: 800; text-transform: uppercase; letter-spacing: 1.2pt; color: ${SDA_TEAL}; margin: 0 0 8pt; padding-bottom: 4pt; border-bottom: 1px solid ${SDA_BORDER}; }
  .kv { display: grid; grid-template-columns: 110pt 1fr; gap: 4pt 14pt; font-size: 9.5pt; }
  .kv dt { color: ${SDA_MUTED}; font-weight: 600; }
  .kv dd { margin: 0; color: ${SDA_NAVY}; font-weight: 500; }
  .timeline { margin: 8pt 0 0; padding: 0; list-style: none; border-left: 2px solid ${SDA_TEAL}; padding-left: 12pt; }
  .timeline li { margin-bottom: 8pt; font-size: 9.5pt; position: relative; }
  .timeline li::before { content: ""; position: absolute; left: -17pt; top: 4pt; width: 8pt; height: 8pt; border-radius: 50%; background: ${SDA_TEAL}; }
  .timeline li.completed::before { background: ${SDA_NAVY}; }
  .timeline .label { font-weight: 700; }
  .timeline .ts { color: ${SDA_MUTED}; margin-left: 6pt; }
  .durations { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8pt; margin-top: 14pt; }
  .duration { background: #f6fafa; border: 1px solid ${SDA_BORDER}; border-radius: 6pt; padding: 10pt; text-align: center; }
  .duration .label { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 1pt; color: ${SDA_MUTED}; font-weight: 700; }
  .duration .value { font-size: 14pt; color: ${SDA_NAVY}; font-weight: 800; margin-top: 4pt; }
  .observations { background: #fff7f1; border-left: 4px solid ${SDA_ORANGE}; padding: 10pt 14pt; border-radius: 4pt; font-size: 9.5pt; }
  .photos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8pt; margin-top: 8pt; }
  .photo img { width: 100%; height: 110pt; object-fit: cover; border-radius: 4pt; border: 1px solid ${SDA_BORDER}; }
  footer { margin-top: 26pt; padding-top: 12pt; border-top: 1px solid ${SDA_BORDER}; font-size: 8pt; color: ${SDA_MUTED}; display: flex; justify-content: space-between; }
</style>
</head>
<body>
<div class="page">
  <header>
    <div class="brand">
      ${data.logoBase64 ? `<img src="${data.logoBase64}" alt="SDA" />` : ''}
      <div class="brand-text">
        <div class="name">SDA d'Estourmel</div>
        <div class="sub">Compte-rendu d'astreinte</div>
      </div>
    </div>
    <div class="ref">
      <div class="num">${escape(data.ticketNumber)}</div>
      <div>Émis le ${fmtDateTime(new Date().toISOString())}</div>
    </div>
  </header>

  <h1>Compte-rendu d'intervention</h1>
  <p class="lede">${interventionLabel}${data.isNightIntervention ? ' &middot; <span class="badge night">Intervention de nuit</span>' : ''}</p>

  <section>
    <h2>1 · Signalement initial</h2>
    <dl class="kv">
      <dt>Reçu le</dt><dd>${fmtDateTime(data.createdAt)}</dd>
      <dt>Déclarant</dt><dd>${escape(data.declarantName) || '—'}${data.declarantOrganization ? ` <span style="color:${SDA_MUTED}">— ${escape(data.declarantOrganization)}</span>` : ''}</dd>
      <dt>Email</dt><dd>${escape(data.declarantEmail)}</dd>
      <dt>Téléphone</dt><dd>${escape(data.declarantPhone) || '—'}</dd>
      <dt>Commune</dt><dd>${escape(data.municipalityName) || '—'}</dd>
      <dt>Adresse</dt><dd>${escape(data.locationAddress) || '—'}</dd>
    </dl>
  </section>

  <section>
    <h2>2 · Animal concerné</h2>
    <dl class="kv">
      <dt>Espèce</dt><dd>${speciesLabel}${data.animalCount > 1 ? ` (×${data.animalCount})` : ''}</dd>
      ${animalAttrs.length ? `<dt>Caractéristiques</dt><dd>${animalAttrs.map(escape).join(' &middot; ')}</dd>` : ''}
      ${data.description ? `<dt>Description</dt><dd>${formatMultiline(data.description)}</dd>` : ''}
    </dl>
  </section>

  <section>
    <h2>3 · Chronologie de l'intervention</h2>
    <ul class="timeline">
      <li><span class="label">Signalement reçu</span><span class="ts">${fmtDateTime(data.createdAt)}</span></li>
      <li><span class="label">Prise en charge</span><span class="ts">${fmtDateTime(data.acknowledgedAt)}${data.agentName ? ` — ${escape(data.agentName)}` : ''}</span></li>
      <li><span class="label">En route</span><span class="ts">${fmtDateTime(data.onRouteAt)}</span></li>
      <li><span class="label">Sur place</span><span class="ts">${fmtDateTime(data.onSiteAt)}</span></li>
      <li class="completed"><span class="label">Intervention terminée</span><span class="ts">${fmtDateTime(data.completedAt)}</span></li>
    </ul>
    <div class="durations">
      <div class="duration"><div class="label">Temps de mobilisation</div><div class="value">${mobilizationDuration}</div></div>
      <div class="duration"><div class="label">Temps sur place</div><div class="value">${interventionDuration}</div></div>
      <div class="duration"><div class="label">Durée totale</div><div class="value">${totalDuration}</div></div>
    </div>
  </section>

  <section>
    <h2>4 · Issue et destination</h2>
    <dl class="kv">
      <dt>Issue</dt><dd>${outcomeLabel}</dd>
      <dt>Destination</dt><dd>${destinationLabel}</dd>
    </dl>
  </section>

  <section>
    <h2>5 · Observations terrain</h2>
    <div class="observations">${formatMultiline(data.comments)}</div>
  </section>

  ${data.photoBase64s.length ? `<section><h2>6 · Photos</h2>${photosHtml}</section>` : ''}

  <footer>
    <div>Société de Défense des Animaux du Nord — 11 route nationale, 59400 Estourmel</div>
    <div>fourriere@sda-nord.com</div>
  </footer>
</div>
</body>
</html>`
}
