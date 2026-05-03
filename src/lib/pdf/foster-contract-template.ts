import type { CompanyInfo } from '@/lib/types/database'

interface FosterContractPdfData {
  contract_number: string
  start_date: string
  expected_end_date: string | null
  signed_at_location: string | null
  signed_at: string | null
  vet_costs_covered_by_shelter: boolean
  food_provided_by_shelter: boolean
  insurance_required: boolean
  household_consent: boolean
  other_animals_at_home: string | null
  special_conditions: string | null
  notes: string | null
}

interface FosterPdfAnimal {
  name: string
  species: string
  breed: string | null
  sex: string
  birth_date: string | null
  chip_number: string | null
}

interface FosterPdfClient {
  name: string
  email: string | null
  phone: string | null
  address: string | null
  postal_code: string | null
  city: string | null
}

const PRIMARY = '#1d9997'
const PRIMARY_DARK = '#0F6B69'
const PRIMARY_LIGHT = '#E6F5F4'
const INK = '#0A0A0A'
const STONE_500 = '#8A8678'
const STONE_300 = '#C9C4B6'

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '____ / ____ / _______'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return '____ / ____ / _______'
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function speciesLabel(species: string): string {
  if (species === 'cat') return 'Chat'
  if (species === 'dog') return 'Chien'
  return species
}

function speciesEmoji(species: string): string {
  if (species === 'cat') return '🐱'
  if (species === 'dog') return '🐶'
  return '🐾'
}

function sexLabel(sex: string): string {
  if (sex === 'male') return 'Mâle'
  if (sex === 'female') return 'Femelle'
  return 'Inconnu'
}

function sexSymbol(sex: string): string {
  if (sex === 'male') return '♂'
  if (sex === 'female') return '♀'
  return '⚧'
}

function clauseRow(active: boolean, title: string, body: string): string {
  const accent = active ? PRIMARY : STONE_300
  const opacity = active ? '1' : '0.55'
  return `<div class="clause" style="border-left-color: ${accent}; opacity: ${opacity};">
    <div class="clause-title"><span class="check">${active ? '✓' : '○'}</span>${title}</div>
    <div class="clause-body">${body}</div>
  </div>`
}

export function buildFosterContractHtml(
  contract: FosterContractPdfData,
  animal: FosterPdfAnimal,
  foster: FosterPdfClient,
  company: CompanyInfo | undefined,
  logoBase64: string | undefined,
  animalPhotoBase64: string | undefined
): string {
  const fosterAddress = [foster.address, foster.postal_code, foster.city].filter(Boolean).join(', ') || '____________________________________________________'
  const companyName = company?.name || 'Refuge'
  const companyAddress = company?.address || ''
  const companyPhone = company?.phone || ''
  const companyEmail = company?.email || ''
  const companySiret = company?.siret || ''

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Convention de placement en famille d'accueil — ${contract.contract_number}</title>
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 10.5pt;
      line-height: 1.55;
      color: ${INK};
      margin: 0;
    }

    .cover {
      background: linear-gradient(135deg, ${PRIMARY} 0%, ${PRIMARY_DARK} 100%);
      color: white;
      padding: 22mm 18mm 18mm;
      position: relative;
    }
    .cover::after {
      content: '';
      position: absolute;
      bottom: -1px; left: 0; right: 0;
      height: 18px;
      background: radial-gradient(circle at 12px -2px, white 12px, transparent 13px) 0 0 / 24px 18px repeat-x;
    }
    .cover-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18pt; }
    .cover-org { font-size: 9pt; line-height: 1.4; max-width: 60%; }
    .cover-org strong { font-size: 13pt; letter-spacing: 0.3pt; }
    .cover-logo { background: rgba(255,255,255,0.95); padding: 8pt 12pt; border-radius: 8pt; }
    .cover-logo img { max-height: 50pt; max-width: 130pt; display: block; }
    .cover-title { font-size: 24pt; font-weight: 800; letter-spacing: 0.6pt; margin: 0; text-transform: uppercase; }
    .cover-subtitle { font-size: 11pt; opacity: 0.92; margin: 6pt 0 0; letter-spacing: 0.4pt; }
    .cover-ref { display: inline-block; margin-top: 14pt; padding: 6pt 14pt; background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.4); border-radius: 999px; font-size: 10pt; font-weight: 600; letter-spacing: 0.5pt; }

    .content { padding: 16mm 18mm 24mm; }
    h2 {
      font-size: 12.5pt;
      color: ${PRIMARY_DARK};
      margin: 22pt 0 8pt;
      padding-bottom: 4pt;
      border-bottom: 2px solid ${PRIMARY};
      display: flex;
      align-items: baseline;
      gap: 8pt;
    }
    h2 .num {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22pt; height: 22pt;
      border-radius: 50%;
      background: ${PRIMARY};
      color: white;
      font-size: 11pt;
      font-weight: 700;
    }
    p { margin: 6pt 0; text-align: justify; }
    ul { margin: 6pt 0; padding-left: 18pt; }
    li { margin-bottom: 5pt; }

    .id-row { display: grid; grid-template-columns: ${animalPhotoBase64 ? '120pt 1fr' : '1fr'}; gap: 14pt; align-items: stretch; margin: 6pt 0 4pt; }
    .animal-photo { width: 120pt; height: 120pt; border-radius: 12pt; object-fit: cover; border: 3pt solid ${PRIMARY_LIGHT}; box-shadow: 0 2pt 6pt rgba(29,153,151,0.18); }
    .id-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8pt 14pt; padding: 12pt 14pt; background: ${PRIMARY_LIGHT}; border-radius: 10pt; align-content: center; }
    .id-field { font-size: 10pt; line-height: 1.3; }
    .id-field .label { color: ${STONE_500}; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.4pt; font-weight: 600; margin-bottom: 2pt; }
    .id-field .value { font-weight: 700; color: ${INK}; }

    .person-card { padding: 10pt 14pt; border: 1px solid ${STONE_300}; border-left: 4px solid ${PRIMARY}; border-radius: 8pt; margin: 6pt 0; }
    .person-card .name { font-weight: 700; font-size: 11.5pt; color: ${INK}; }
    .person-card .meta { color: ${STONE_500}; font-size: 9.5pt; margin-top: 2pt; }

    .date-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12pt; margin: 6pt 0; }
    .date-card { padding: 10pt 14pt; background: ${PRIMARY_LIGHT}; border-radius: 8pt; }
    .date-card .label { color: ${STONE_500}; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.4pt; font-weight: 600; margin-bottom: 2pt; }
    .date-card .value { font-weight: 700; font-size: 11pt; color: ${INK}; }

    .clauses { margin: 6pt 0; }
    .clause { padding: 8pt 12pt; margin: 6pt 0; background: #fafaf7; border-left: 4px solid ${PRIMARY}; border-radius: 6pt; }
    .clause-title { font-weight: 700; font-size: 10.5pt; color: ${INK}; display: flex; align-items: center; gap: 6pt; }
    .clause-title .check { display: inline-flex; align-items: center; justify-content: center; width: 14pt; height: 14pt; border-radius: 50%; background: ${PRIMARY}; color: white; font-size: 9pt; font-weight: 700; }
    .clause-body { font-size: 9.5pt; margin-top: 3pt; color: #2d2d2d; }

    .note-block { padding: 8pt 12pt; background: #fff8e6; border-left: 4px solid #d4a800; border-radius: 6pt; font-size: 9.5pt; }
    .note-block strong { color: #846a00; }

    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 18pt; margin-top: 28pt; }
    .sigbox { border: 1px solid ${STONE_300}; border-radius: 10pt; padding: 12pt 14pt; min-height: 110pt; font-size: 9pt; background: white; page-break-inside: avoid; }
    .sigbox .who { display: inline-block; padding: 3pt 8pt; background: ${PRIMARY}; color: white; border-radius: 4pt; font-size: 8.5pt; font-weight: 700; letter-spacing: 0.4pt; text-transform: uppercase; margin-bottom: 8pt; }
    .sigbox .meta { color: ${STONE_500}; font-size: 9pt; margin-bottom: 22pt; }
    .sigbox .hint { color: ${STONE_500}; font-size: 8.5pt; font-style: italic; }

    .footer { margin-top: 22pt; padding-top: 8pt; border-top: 1px solid ${STONE_300}; font-size: 8pt; color: ${STONE_500}; text-align: center; }
  </style>
</head>
<body>
  <div class="cover">
    <div class="cover-top">
      <div class="cover-org">
        <strong>${companyName}</strong><br/>
        ${companyAddress ? companyAddress + '<br/>' : ''}
        ${companyPhone ? 'Tél : ' + companyPhone : ''}${companyPhone && companyEmail ? ' · ' : ''}${companyEmail || ''}<br/>
        ${companySiret ? 'SIRET : ' + companySiret : ''}
      </div>
      ${logoBase64 ? `<div class="cover-logo"><img src="${logoBase64}" alt="Logo" /></div>` : ''}
    </div>
    <h1 class="cover-title">Convention famille d'accueil</h1>
    <p class="cover-subtitle">Placement temporaire — débute le ${formatDate(contract.start_date)}</p>
    <span class="cover-ref">N° ${contract.contract_number}</span>
  </div>

  <div class="content">
    <p style="margin-top: 6pt;"><strong>Entre les soussignés :</strong></p>

    <h2><span class="num">1</span>Le refuge</h2>
    <div class="person-card">
      <div class="name">${companyName}</div>
      <div class="meta">
        ${companyAddress ? companyAddress + ' · ' : ''}
        ${companyPhone ? 'Tél : ' + companyPhone : ''}
        ${companyEmail ? ' · ' + companyEmail : ''}
      </div>
    </div>
    <p>Ci-après désigné « le refuge ».</p>

    <h2><span class="num">2</span>La famille d'accueil</h2>
    <div class="person-card">
      <div class="name">${foster.name}</div>
      <div class="meta">${fosterAddress}</div>
      <div class="meta">${[foster.phone, foster.email].filter(Boolean).join(' · ') || ''}</div>
    </div>
    <p>Ci-après désignée « la famille d'accueil ».</p>

    <h2><span class="num">3</span>Animal confié</h2>
    <div class="id-row">
      ${animalPhotoBase64 ? `<img class="animal-photo" src="${animalPhotoBase64}" alt="${animal.name}" />` : ''}
      <div class="id-grid">
        <div class="id-field"><div class="label">Nom</div><div class="value">${animal.name} ${speciesEmoji(animal.species)}</div></div>
        <div class="id-field"><div class="label">Espèce</div><div class="value">${speciesLabel(animal.species)}</div></div>
        <div class="id-field"><div class="label">Race</div><div class="value">${animal.breed || '—'}</div></div>
        <div class="id-field"><div class="label">Sexe</div><div class="value">${sexSymbol(animal.sex)} ${sexLabel(animal.sex)}</div></div>
        <div class="id-field"><div class="label">Naissance</div><div class="value">${formatDate(animal.birth_date)}</div></div>
        <div class="id-field"><div class="label">Puce / I-CAD</div><div class="value">${animal.chip_number || '—'}</div></div>
      </div>
    </div>

    <h2><span class="num">4</span>Durée et conditions</h2>
    <div class="date-row">
      <div class="date-card">
        <div class="label">Date de début</div>
        <div class="value">${formatDate(contract.start_date)}</div>
      </div>
      <div class="date-card">
        <div class="label">Fin prévisionnelle</div>
        <div class="value">${formatDate(contract.expected_end_date)}</div>
      </div>
    </div>
    <p>
      Le refuge confie à la famille d'accueil l'animal désigné ci-dessus dans les conditions
      précisées ci-après. Le placement est <strong>temporaire et révocable à tout moment</strong>
      par le refuge. L'animal demeure en toutes circonstances la <strong>propriété du refuge</strong>.
    </p>

    <h2><span class="num">5</span>Engagements de la famille d'accueil</h2>
    <ul>
      <li>Héberger l'animal dans des conditions décentes, hygiéniques et adaptées à son espèce et à son comportement.</li>
      <li>Lui apporter les soins quotidiens nécessaires (alimentation, hydratation, sorties, attention).</li>
      <li>Ne jamais le céder, le vendre ni le donner à un tiers sans autorisation écrite du refuge.</li>
      <li>Informer immédiatement le refuge en cas de problème de santé, comportement, fugue ou incident.</li>
      <li>Transporter l'animal aux rendez-vous vétérinaires fixés par le refuge.</li>
      <li>Restituer l'animal au refuge à la première demande de celui-ci.</li>
    </ul>

    <h2><span class="num">6</span>Engagements du refuge</h2>
    <ul>
      <li>Fournir un suivi sanitaire et vétérinaire adapté à l'animal.</li>
      <li>Couvrir les frais vétérinaires prescrits ou validés par lui-même.</li>
      <li>Reprendre l'animal sur simple demande de la famille d'accueil dans un délai raisonnable.</li>
      <li>Tenir la famille d'accueil informée des décisions concernant l'avenir de l'animal.</li>
    </ul>

    <h2><span class="num">7</span>Modalités particulières</h2>
    <div class="clauses">
      ${clauseRow(contract.vet_costs_covered_by_shelter, 'Frais vétérinaires', 'Pris en charge par le refuge sur prescription validée.')}
      ${clauseRow(contract.food_provided_by_shelter, 'Alimentation', 'Fournie par le refuge.')}
      ${clauseRow(contract.insurance_required, 'Assurance RC', 'Une responsabilité civile à jour est requise pour le foyer.')}
      ${clauseRow(contract.household_consent, 'Accord du foyer', "L'ensemble du foyer est informé et consentant pour l'accueil.")}
    </div>

    ${contract.other_animals_at_home ? `<div class="note-block" style="margin-top: 8pt;"><strong>Autres animaux du foyer :</strong> ${contract.other_animals_at_home}</div>` : ''}
    ${contract.special_conditions ? `<div class="note-block" style="margin-top: 8pt;"><strong>Conditions particulières :</strong> ${contract.special_conditions}</div>` : ''}
    ${contract.notes ? `<div class="note-block" style="margin-top: 8pt;"><strong>Notes complémentaires :</strong> ${contract.notes}</div>` : ''}

    <h2><span class="num">8</span>I-CAD / Identification</h2>
    <p>
      Le placement en famille d'accueil n'entraîne pas de changement de propriétaire au fichier
      national I-CAD. L'animal reste identifié au nom du refuge ou de la structure détentrice.
    </p>

    <div class="signatures">
      <div class="sigbox">
        <span class="who">Le refuge</span>
        <div class="meta">Fait à ${contract.signed_at_location || '_____________________'}, le ${formatDate(contract.signed_at)}</div>
        <div class="hint">Signature, nom et qualité</div>
      </div>
      <div class="sigbox">
        <span class="who">La famille d'accueil</span>
        <div class="meta">Fait à ${contract.signed_at_location || '_____________________'}, le ${formatDate(contract.signed_at)}</div>
        <div class="hint">Mention manuscrite « Lu et approuvé »<br/>puis signature</div>
      </div>
    </div>

    <div class="footer">
      Convention établie le ${formatDate(new Date().toISOString())} — ${companyName} — N° ${contract.contract_number}
    </div>
  </div>
</body>
</html>`
}
