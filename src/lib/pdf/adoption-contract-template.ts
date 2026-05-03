import type { CompanyInfo } from '@/lib/types/database'

interface AdoptionContractPdfData {
  contract_number: string
  adoption_date: string
  adoption_fee: number
  sterilization_required: boolean
  sterilization_deadline: string | null
  sterilization_deposit: number | null
  visit_right_clause: boolean
  non_resale_clause: boolean
  shelter_return_clause: boolean
  household_acknowledgment: boolean
  special_conditions: string | null
  signed_at_location: string | null
  signed_at: string | null
  notes: string | null
}

interface AdoptionPdfAnimal {
  name: string
  species: string
  breed: string | null
  sex: string
  birth_date: string | null
  chip_number: string | null
}

interface AdoptionPdfClient {
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

function formatEuros(amount: number | null | undefined): string {
  if (amount == null) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)
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

export function buildAdoptionContractHtml(
  contract: AdoptionContractPdfData,
  animal: AdoptionPdfAnimal,
  adopter: AdoptionPdfClient,
  company: CompanyInfo | undefined,
  logoBase64: string | undefined,
  animalPhotoBase64: string | undefined
): string {
  const adopterAddress = [adopter.address, adopter.postal_code, adopter.city].filter(Boolean).join(', ') || '____________________________________________________'
  const companyName = company?.name || 'Refuge'
  const companyAddress = company?.address || ''
  const companyPhone = company?.phone || ''
  const companyEmail = company?.email || ''
  const companySiret = company?.siret || ''

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Contrat d'adoption — ${contract.contract_number}</title>
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

    /* === Cover banner === */
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
      background:
        radial-gradient(circle at 12px -2px, white 12px, transparent 13px) 0 0 / 24px 18px repeat-x;
    }
    .cover-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 18pt;
    }
    .cover-org {
      font-size: 9pt;
      line-height: 1.4;
      max-width: 60%;
    }
    .cover-org strong { font-size: 13pt; letter-spacing: 0.3pt; }
    .cover-logo {
      background: rgba(255,255,255,0.95);
      padding: 8pt 12pt;
      border-radius: 8pt;
    }
    .cover-logo img { max-height: 50pt; max-width: 130pt; display: block; }
    .cover-title {
      font-size: 26pt;
      font-weight: 800;
      letter-spacing: 1pt;
      margin: 0;
      text-transform: uppercase;
    }
    .cover-subtitle {
      font-size: 11pt;
      opacity: 0.92;
      margin: 6pt 0 0;
      letter-spacing: 0.5pt;
    }
    .cover-ref {
      display: inline-block;
      margin-top: 14pt;
      padding: 6pt 14pt;
      background: rgba(255,255,255,0.18);
      border: 1px solid rgba(255,255,255,0.4);
      border-radius: 999px;
      font-size: 10pt;
      font-weight: 600;
      letter-spacing: 0.5pt;
    }

    /* === Content === */
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

    /* === Animal & adopter cards === */
    .id-row {
      display: grid;
      grid-template-columns: ${animalPhotoBase64 ? '120pt 1fr' : '1fr'};
      gap: 14pt;
      align-items: stretch;
      margin: 6pt 0 4pt;
    }
    .animal-photo {
      width: 120pt;
      height: 120pt;
      border-radius: 12pt;
      object-fit: cover;
      border: 3pt solid ${PRIMARY_LIGHT};
      box-shadow: 0 2pt 6pt rgba(29,153,151,0.18);
    }
    .id-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8pt 14pt;
      padding: 12pt 14pt;
      background: ${PRIMARY_LIGHT};
      border-radius: 10pt;
      align-content: center;
    }
    .id-field { font-size: 10pt; line-height: 1.3; }
    .id-field .label {
      color: ${STONE_500};
      font-size: 8.5pt;
      text-transform: uppercase;
      letter-spacing: 0.4pt;
      font-weight: 600;
      margin-bottom: 2pt;
    }
    .id-field .value { font-weight: 700; color: ${INK}; }

    .person-card {
      padding: 10pt 14pt;
      border: 1px solid ${STONE_300};
      border-left: 4px solid ${PRIMARY};
      border-radius: 8pt;
      margin: 6pt 0;
    }
    .person-card .name { font-weight: 700; font-size: 11.5pt; color: ${INK}; }
    .person-card .meta { color: ${STONE_500}; font-size: 9.5pt; margin-top: 2pt; }

    /* === Fee box === */
    .fee-box {
      margin: 8pt 0 4pt;
      padding: 14pt 16pt;
      background: linear-gradient(135deg, ${PRIMARY} 0%, ${PRIMARY_DARK} 100%);
      color: white;
      border-radius: 12pt;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .fee-box .fee-label {
      font-size: 10pt;
      text-transform: uppercase;
      letter-spacing: 0.6pt;
      opacity: 0.9;
    }
    .fee-box .fee-amount {
      font-size: 22pt;
      font-weight: 800;
      letter-spacing: 0.3pt;
    }

    /* === Clauses === */
    .clauses { margin: 6pt 0; }
    .clause {
      padding: 8pt 12pt;
      margin: 6pt 0;
      background: #fafaf7;
      border-left: 4px solid ${PRIMARY};
      border-radius: 6pt;
    }
    .clause-title {
      font-weight: 700;
      font-size: 10.5pt;
      color: ${INK};
      display: flex;
      align-items: center;
      gap: 6pt;
    }
    .clause-title .check {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 14pt; height: 14pt;
      border-radius: 50%;
      background: ${PRIMARY};
      color: white;
      font-size: 9pt;
      font-weight: 700;
    }
    .clause-body { font-size: 9.5pt; margin-top: 3pt; color: #2d2d2d; }

    /* === Notes === */
    .note-block {
      padding: 8pt 12pt;
      background: #fff8e6;
      border-left: 4px solid #d4a800;
      border-radius: 6pt;
      font-size: 9.5pt;
    }
    .note-block strong { color: #846a00; }

    /* === Signatures === */
    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18pt;
      margin-top: 28pt;
    }
    .sigbox {
      border: 1px solid ${STONE_300};
      border-radius: 10pt;
      padding: 12pt 14pt;
      min-height: 110pt;
      font-size: 9pt;
      background: white;
      page-break-inside: avoid;
    }
    .sigbox .who {
      display: inline-block;
      padding: 3pt 8pt;
      background: ${PRIMARY};
      color: white;
      border-radius: 4pt;
      font-size: 8.5pt;
      font-weight: 700;
      letter-spacing: 0.4pt;
      text-transform: uppercase;
      margin-bottom: 8pt;
    }
    .sigbox .meta { color: ${STONE_500}; font-size: 9pt; margin-bottom: 22pt; }
    .sigbox .hint { color: ${STONE_500}; font-size: 8.5pt; font-style: italic; }

    /* === Footer === */
    .footer {
      margin-top: 22pt;
      padding-top: 8pt;
      border-top: 1px solid ${STONE_300};
      font-size: 8pt;
      color: ${STONE_500};
      text-align: center;
    }
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
    <h1 class="cover-title">Contrat d'adoption</h1>
    <p class="cover-subtitle">Cession définitive d'un animal — ${formatDate(contract.adoption_date)}</p>
    <span class="cover-ref">N° ${contract.contract_number}</span>
  </div>

  <div class="content">
    <p style="margin-top: 6pt;"><strong>Entre les soussignés :</strong></p>

    <h2><span class="num">1</span>Le cédant</h2>
    <div class="person-card">
      <div class="name">${companyName}</div>
      <div class="meta">
        ${companyAddress ? companyAddress + ' · ' : ''}
        ${companyPhone ? 'Tél : ' + companyPhone : ''}
        ${companyEmail ? ' · ' + companyEmail : ''}
      </div>
    </div>
    <p>Ci-après désigné « le refuge ».</p>

    <h2><span class="num">2</span>L'adoptant</h2>
    <div class="person-card">
      <div class="name">${adopter.name}</div>
      <div class="meta">${adopterAddress}</div>
      <div class="meta">${[adopter.phone, adopter.email].filter(Boolean).join(' · ') || ''}</div>
    </div>
    <p>Ci-après désigné « l'adoptant ».</p>

    <h2><span class="num">3</span>Animal cédé</h2>
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

    <h2><span class="num">4</span>Frais d'adoption</h2>
    <p>
      Le refuge cède définitivement l'animal désigné ci-dessus à l'adoptant en contrepartie d'une
      participation aux frais engagés (identification, vaccinations, soins vétérinaires, stérilisation
      le cas échéant) :
    </p>
    <div class="fee-box">
      <span class="fee-label">Participation aux frais</span>
      <span class="fee-amount">${formatEuros(contract.adoption_fee)}</span>
    </div>
    <p style="font-size: 9.5pt; color: ${STONE_500}; margin-top: 6pt;">
      Le règlement de cette somme conditionne la cession effective de l'animal.
      Cette participation n'est pas un prix de vente : l'adoption d'un animal n'est pas un acte commercial.
    </p>

    <h2><span class="num">5</span>Engagements de l'adoptant</h2>
    <p>L'adoptant s'engage solennellement à :</p>
    <ul>
      <li>Considérer l'animal comme un membre de son foyer et lui assurer une vie digne.</li>
      <li>Lui apporter les soins quotidiens nécessaires (alimentation, eau propre, sorties, attention, suivi vétérinaire).</li>
      <li>Le faire identifier et déclarer à son nom auprès du fichier I-CAD.</li>
      <li>Souscrire ou maintenir une assurance responsabilité civile couvrant l'animal.</li>
      <li>Ne jamais l'abandonner, le maltraiter, ni le confier à un usage incompatible avec son bien-être.</li>
    </ul>

    <h2><span class="num">6</span>Clauses particulières</h2>
    <div class="clauses">
      ${clauseRow(
        contract.sterilization_required,
        'Stérilisation obligatoire',
        contract.sterilization_required
          ? `Si l'animal n'est pas déjà stérilisé, l'adoptant s'engage à le faire stériliser avant le <strong>${formatDate(contract.sterilization_deadline)}</strong>${contract.sterilization_deposit ? `, contre une caution remboursable de <strong>${formatEuros(contract.sterilization_deposit)}</strong> sur présentation du certificat vétérinaire.` : '.'}`
          : "Stérilisation laissée à l'appréciation de l'adoptant."
      )}
      ${clauseRow(
        contract.non_resale_clause,
        'Non-cession à un tiers',
        "L'adoptant s'engage à ne pas vendre, donner ou céder l'animal sans accord écrit préalable du refuge."
      )}
      ${clauseRow(
        contract.shelter_return_clause,
        'Reprise par le refuge',
        "Si l'adoptant ne peut plus assumer la garde de l'animal, il s'engage à le restituer au refuge plutôt qu'à l'abandonner ou le placer sans concertation."
      )}
      ${clauseRow(
        contract.visit_right_clause,
        'Droit de visite et de suivi',
        "L'adoptant accepte que le refuge puisse, sur rendez-vous, s'enquérir des conditions de vie de l'animal pendant la première année."
      )}
      ${clauseRow(
        contract.household_acknowledgment,
        'Accord du foyer',
        "L'adoptant atteste que l'ensemble du foyer (conjoint, enfants, autres animaux) est informé et consentant pour cette adoption."
      )}
    </div>

    ${contract.special_conditions ? `<div class="note-block" style="margin-top: 8pt;"><strong>Conditions particulières :</strong> ${contract.special_conditions}</div>` : ''}
    ${contract.notes ? `<div class="note-block" style="margin-top: 8pt;"><strong>Notes complémentaires :</strong> ${contract.notes}</div>` : ''}

    <h2><span class="num">7</span>Identification I-CAD</h2>
    <p>
      Le refuge se charge de la déclaration de changement de propriétaire auprès du fichier
      national d'identification I-CAD. L'adoptant en deviendra le titulaire officiel après enregistrement.
    </p>

    <h2><span class="num">8</span>Résiliation et litiges</h2>
    <p>
      En cas de manquement grave aux engagements ci-dessus, le refuge se réserve le droit de
      reprendre l'animal sans indemnité, après mise en demeure. À défaut d'accord amiable,
      tout litige sera soumis aux tribunaux français compétents.
    </p>

    <div class="signatures">
      <div class="sigbox">
        <span class="who">Le refuge</span>
        <div class="meta">Fait à ${contract.signed_at_location || '_____________________'}, le ${formatDate(contract.signed_at)}</div>
        <div class="hint">Signature, nom et qualité</div>
      </div>
      <div class="sigbox">
        <span class="who">L'adoptant</span>
        <div class="meta">Fait à ${contract.signed_at_location || '_____________________'}, le ${formatDate(contract.signed_at)}</div>
        <div class="hint">Mention manuscrite « Lu et approuvé »<br/>puis signature</div>
      </div>
    </div>

    <div class="footer">
      Contrat d'adoption établi le ${formatDate(new Date().toISOString())} — ${companyName} — N° ${contract.contract_number}
    </div>
  </div>
</body>
</html>`
}
