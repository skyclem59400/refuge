import type { CompanyInfo } from '@/lib/types/database'
import { getSpeciesLabel } from '@/lib/species'
import { buildCachetSvg } from './cachet'

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
  name_secondary?: string | null
  species: string
  breed: string | null
  sex: string
  birth_date: string | null
  chip_number: string | null
  color?: string | null
  sterilized?: boolean
  tattoo_number?: string | null
  medal_number?: string | null
  loof_number?: string | null
}

interface FosterPdfClient {
  name: string
  email: string | null
  phone: string | null
  address: string | null
  postal_code: string | null
  city: string | null
}

// === Charte SDA officielle (cf. courrier-candidats-cambrai) ===
const NAVY = '#1e3a5f'
const NAVY_LIGHT = '#3d5a80'
const TEAL = '#5ba8a0'
const TEAL_BG = '#f0f7fa'
const ORANGE = '#c96b3c'
const ORANGE_BG = '#fdf4ee'
const STONE_300 = '#d9e6ed'
const STONE_500 = '#6b7f96'

// Coordonnées vétérinaire partenaire SDA
const VET_PARTNER_NAME = 'Mme Deltour'
const VET_PARTNER_ADDRESS = '94 rue Saint-Georges, 59400 Cambrai'
const VET_PARTNER_PHONE = '03 27 37 20 20'
const ON_CALL_NAME = 'Mme Désiré'
const ON_CALL_PHONE = '06 81 23 15 52'

function formatDateLong(dateStr: string | null | undefined): string {
  if (!dateStr) return '____ / ____ / _______'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return '____ / ____ / _______'
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return '__/__/____'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return '__/__/____'
  return d.toLocaleDateString('fr-FR')
}

function speciesLabel(species: string): string {
  return getSpeciesLabel(species)
}

function sexLabel(sex: string): string {
  if (sex === 'male') return 'Mâle'
  if (sex === 'female') return 'Femelle'
  return 'Inconnu'
}

function htmlEscape(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function field(label: string, value: string): string {
  return `<div class="field"><span class="field-label">${label}</span><span class="field-value">${value}</span></div>`
}

export function buildFosterContractHtml(
  contract: FosterContractPdfData,
  animal: FosterPdfAnimal,
  foster: FosterPdfClient,
  company: CompanyInfo | undefined,
  logoBase64: string | undefined,
  _animalPhotoBase64: string | undefined,
  createdByName?: string | null,
): string {
  const fosterAddressLines = [
    htmlEscape(foster.address) || '',
    [foster.postal_code, foster.city].filter(Boolean).map(htmlEscape).join(' '),
  ].filter((l) => l.trim())
  const companyName = company?.name || "SDA d'Estourmel"
  const companyLegalName = company?.legal_name || companyName
  const companyAddress = company?.address || '11 route nationale, 59400 Estourmel, France'
  const companyEmail = company?.email || 'accueil@sda-nord.com'
  const companySiret = company?.siret || '32110272500025'
  const refugeCachetSvg = buildCachetSvg(company || { name: companyName })

  const animalNameDisplay = htmlEscape(animal.name) +
    (animal.name_secondary ? ` <span class="muted">/ ${htmlEscape(animal.name_secondary)}</span>` : '')

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Contrat Famille d'Accueil — ${contract.contract_number}</title>
  <style>
    @page { size: A4; margin: 16mm 18mm 16mm 18mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.55;
      color: ${NAVY};
      margin: 0;
      padding: 0;
    }

    /* === Header === */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 4mm;
      border-bottom: 2.5px solid ${NAVY};
      margin-bottom: 6mm;
    }
    .header-left { display: flex; align-items: center; gap: 12px; }
    .header-logo { width: 70px; height: 70px; object-fit: contain; }
    .org-name { font-size: 16pt; font-weight: 700; color: ${NAVY}; letter-spacing: 0.6pt; line-height: 1.1; }
    .org-name .sda { color: ${TEAL}; }
    .org-subtitle { font-size: 8pt; color: ${TEAL}; font-weight: 700; text-transform: uppercase; letter-spacing: 1.8px; margin-top: 1pt; }
    .header-right { text-align: right; font-size: 8.5pt; color: ${STONE_500}; line-height: 1.5; }
    .header-right strong { color: ${NAVY}; font-size: 9.5pt; }

    h1 { font-size: 22pt; font-weight: 700; color: ${NAVY}; margin: 4mm 0 2mm; letter-spacing: 0.4pt; }
    .ref {
      display: inline-block;
      padding: 2pt 10pt;
      background: ${TEAL_BG};
      border: 1px solid ${STONE_300};
      border-radius: 999px;
      color: ${TEAL};
      font-size: 9pt;
      font-weight: 700;
      letter-spacing: 0.4pt;
    }

    .preamble {
      margin: 5mm 0 6mm;
      padding: 3mm 4mm;
      background: ${TEAL_BG};
      border-left: 3px solid ${TEAL};
      border-radius: 0 4px 4px 0;
      font-size: 9.5pt;
      line-height: 1.6;
    }
    .preamble strong { color: ${NAVY}; }

    /* === Identification cards === */
    .cards {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4mm;
      margin: 4mm 0 5mm;
    }
    .card { border: 1px solid ${STONE_300}; border-radius: 6px; overflow: hidden; page-break-inside: avoid; }
    .card-title { background: ${NAVY}; color: white; padding: 2mm 3mm; font-size: 8.5pt; font-weight: 700; letter-spacing: 1pt; text-transform: uppercase; text-align: center; }
    .card-body { padding: 3mm 4mm; font-size: 9pt; line-height: 1.7; }
    .card-body .name { font-weight: 700; font-size: 10pt; color: ${NAVY}; margin-bottom: 1mm; }
    .field { display: block; }
    .field-label { font-weight: 700; color: ${NAVY}; }
    .field-value { color: ${NAVY_LIGHT}; }
    .muted { color: ${STONE_500}; }

    /* === Section title === */
    .section {
      margin: 5mm 0 3mm;
      display: flex;
      align-items: center;
      gap: 3mm;
      padding-bottom: 1.5mm;
      border-bottom: 1px solid ${STONE_300};
    }
    .section-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22pt;
      height: 22pt;
      border-radius: 50%;
      background: ${ORANGE};
      color: white;
      font-size: 12pt;
      font-weight: 700;
      flex-shrink: 0;
    }
    .section-title-text {
      font-size: 11pt;
      font-weight: 700;
      color: ${NAVY};
      letter-spacing: 0.3pt;
      text-transform: uppercase;
    }

    /* === Engagements list === */
    ol.engagements { padding-left: 6mm; counter-reset: clause; list-style: none; }
    ol.engagements > li {
      position: relative;
      margin-bottom: 3mm;
      padding-left: 7mm;
      counter-increment: clause;
      font-size: 9.5pt;
      line-height: 1.55;
      text-align: justify;
    }
    ol.engagements > li::before {
      content: counter(clause) ")";
      position: absolute;
      left: 0;
      top: 0;
      font-weight: 700;
      color: ${TEAL};
      width: 6mm;
    }
    ol.engagements > li strong.heading { color: ${NAVY}; display: block; margin-bottom: 1mm; }
    ol.engagements ul { margin: 1.5mm 0 0; padding-left: 4mm; }
    ol.engagements ul li { margin-bottom: 1mm; font-size: 9pt; }

    /* === Highlight box === */
    .highlight {
      margin: 2mm 0;
      padding: 2.5mm 3mm;
      background: ${ORANGE_BG};
      border-left: 3px solid ${ORANGE};
      border-radius: 0 4px 4px 0;
      font-size: 9pt;
    }
    .highlight strong { color: ${ORANGE}; }

    .vet-block {
      margin: 1.5mm 0;
      padding: 2.5mm 3mm;
      background: ${TEAL_BG};
      border-left: 3px solid ${TEAL};
      border-radius: 0 4px 4px 0;
      font-size: 9pt;
    }
    .vet-block strong { color: ${TEAL}; }

    /* === Note === */
    .note {
      margin: 5mm 0 3mm;
      border: 1px solid ${STONE_300};
      border-radius: 6px;
      overflow: hidden;
      page-break-inside: avoid;
    }
    .note-title {
      background: ${NAVY};
      color: white;
      padding: 2mm 3mm;
      font-size: 8.5pt;
      font-weight: 700;
      letter-spacing: 1pt;
      text-transform: uppercase;
      text-align: center;
    }
    .note-body { padding: 3mm 4mm; font-size: 9.5pt; line-height: 1.55; min-height: 18mm; white-space: pre-line; }
    .note-body em { color: ${STONE_500}; }

    /* === Signatures === */
    .signed-at {
      margin: 6mm 0 3mm;
      font-size: 9.5pt;
      font-weight: 700;
      color: ${NAVY};
    }
    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 5mm;
      margin-top: 3mm;
      page-break-inside: avoid;
    }
    .sigbox { border: 1px solid ${STONE_300}; border-radius: 6px; overflow: hidden; }
    .sigbox-head { background: ${NAVY}; color: white; text-align: center; padding: 2mm; font-size: 8.5pt; letter-spacing: 1pt; font-weight: 700; text-transform: uppercase; }
    .sigbox-body { min-height: 30mm; padding: 3mm 4mm; font-size: 8.5pt; color: ${STONE_500}; }
    .sigbox-body.is-refuge {
      display: flex;
      align-items: center;
      gap: 3mm;
      padding: 2mm 3mm;
      color: ${NAVY};
    }
    .sigbox-body.is-refuge .cachet {
      width: 26mm;
      height: 26mm;
      flex-shrink: 0;
    }
    .sigbox-body.is-refuge .cachet svg { display: block; width: 100%; height: 100%; }
    .sigbox-body.is-refuge .signer-name {
      flex: 1;
      font-size: 9pt;
      font-weight: 700;
      color: ${NAVY};
      line-height: 1.3;
    }
    .sigbox-body.is-refuge .signer-label {
      font-size: 7.5pt;
      font-weight: 400;
      color: ${STONE_500};
      text-transform: uppercase;
      letter-spacing: 0.5pt;
      display: block;
      margin-bottom: 1mm;
    }

    /* === Footer === */
    .footer {
      margin-top: 8mm;
      padding-top: 3mm;
      border-top: 2px solid ${NAVY};
      display: flex;
      justify-content: space-between;
      font-size: 7.5pt;
      color: ${STONE_500};
      line-height: 1.4;
    }
    .footer-accent { height: 3px; background: linear-gradient(90deg, ${ORANGE} 0%, ${TEAL} 50%, ${NAVY} 100%); margin-top: 2mm; border-radius: 2px; }
  </style>
</head>
<body>

  <header class="header">
    <div class="header-left">
      ${logoBase64 ? `<img src="${logoBase64}" class="header-logo" alt="Logo SDA" />` : ''}
      <div>
        <div class="org-name"><span class="sda">SDA</span> d'Estourmel</div>
        <div class="org-subtitle">Défendons les animaux</div>
      </div>
    </div>
    <div class="header-right">
      <strong>${htmlEscape(companyLegalName)}</strong><br/>
      SIRET : ${htmlEscape(companySiret)}<br/>
      ${htmlEscape(companyAddress)}<br/>
      ${htmlEscape(companyEmail)}
    </div>
  </header>

  <h1>Contrat Famille d'Accueil</h1>
  <span class="ref">N° ${htmlEscape(contract.contract_number)}</span>

  <div class="preamble">
    Je soussigné(e) <strong>${htmlEscape(foster.name)}</strong> m'engage envers le Refuge SDA d'Estourmel
    à être famille d'accueil pour l'animal décrit ci-dessous à partir du
    <strong>${formatDateLong(contract.start_date)}</strong>${contract.expected_end_date ? ` et jusqu'au <strong>${formatDateLong(contract.expected_end_date)}</strong> (date prévisionnelle)` : ''}.
  </div>

  <!-- ============== Identification ============== -->
  <div class="cards">
    <div class="card">
      <div class="card-title">Famille d'accueil (FA)</div>
      <div class="card-body">
        <div class="name">${htmlEscape(foster.name)}</div>
        ${fosterAddressLines.length ? fosterAddressLines.map((l) => `<div>${l}</div>`).join('') : '<div class="muted">Adresse non renseignée</div>'}
        ${foster.phone ? field('Téléphone&nbsp;:', ' ' + htmlEscape(foster.phone)) : ''}
        ${foster.email ? field('Email&nbsp;:', ' ' + htmlEscape(foster.email)) : ''}
        <div class="muted" style="margin-top:1mm;">Numéro de carte d'identité&nbsp;:</div>
        <div class="muted">Numéro de passeport&nbsp;:</div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">L'animal</div>
      <div class="card-body">
        <div class="name">${animalNameDisplay}</div>
        ${field('Espèce&nbsp;:', ' ' + speciesLabel(animal.species))}
        ${field('Race&nbsp;:', ' ' + (animal.breed ? htmlEscape(animal.breed) : ''))}
        ${field('Robe&nbsp;:', ' ' + (animal.color ? htmlEscape(animal.color) : ''))}
        ${field('Sexe&nbsp;:', ' ' + sexLabel(animal.sex))}
        ${field('Stérilisé(e)&nbsp;:', ' ' + (animal.sterilized ? 'Oui' : 'Non'))}
        ${field('Date de naissance&nbsp;:', ' ' + formatDateShort(animal.birth_date))}
        ${field('Numéro de puce&nbsp;:', ' ' + (animal.chip_number ? htmlEscape(animal.chip_number) : ''))}
        ${field('Numéro LOF&nbsp;:', ' ' + (animal.loof_number ? htmlEscape(animal.loof_number) : ''))}
        ${field('Numéro de tatouage&nbsp;:', ' ' + (animal.tattoo_number ? htmlEscape(animal.tattoo_number) : ''))}
        ${field('Médaille&nbsp;:', ' ' + (animal.medal_number ? htmlEscape(animal.medal_number) : ''))}
      </div>
    </div>
  </div>

  <!-- ============== Engagements ============== -->
  <div class="section">
    <span class="section-icon">§</span>
    <span class="section-title-text">Engagements réciproques</span>
  </div>

  <ol class="engagements">
    <li>La famille accueillante doit être <strong>membre adhérente</strong> de la SDA.</li>

    <li>La famille accueillante s'engage à accueillir le chien ou le chat <strong>jusqu'à son adoption</strong> ou jusqu'à la date convenue avec le refuge. Aucune somme d'argent ne pourra être réclamée à l'association pour la garde de l'animal ou pour quelque motif que ce soit.</li>

    <li>La <strong>SDA demeure seule et unique propriétaire</strong> de l'animal confié, sauf en cas d'adoption de l'animal par la famille accueillante.</li>

    <li>
      <strong class="heading">La SDA assume les frais vétérinaires (soins, vaccins, médicaments) de l'animal accueilli.</strong>
      <div class="vet-block">
        <strong>Consultations vétérinaires (sauf urgence vitale)&nbsp;:</strong>
        <ul style="margin-top:1mm; padding-left:4mm;">
          <li>Doivent au préalable être <strong>validées par l'association</strong>. Pour cela, contacter la SDA, ou en dehors des heures d'ouverture du refuge ${ON_CALL_NAME} au <strong>${ON_CALL_PHONE}</strong>.</li>
          <li>Doivent <strong>impérativement</strong> être effectuées chez notre vétérinaire partenaire&nbsp;: ${VET_PARTNER_NAME}, ${VET_PARTNER_ADDRESS} (${VET_PARTNER_PHONE}).</li>
        </ul>
      </div>
      <div style="margin-top:1.5mm;">Aucun frais ne sera à avancer. ${VET_PARTNER_NAME} est seule décisionnaire des soins et actes médicaux à réaliser. Les frais engagés sans l'accord de l'association et/ou chez un vétérinaire autre que celui mentionné ci-dessus ne donneront lieu à aucun remboursement.</div>
      <div class="highlight">
        <strong>En cas de décès</strong> de l'animal, l'association doit être informée et son corps devra lui être restitué. L'association s'engage à assumer les frais d'incinération collective. Pour une incinération individuelle, les frais seront à votre charge.
      </div>
    </li>

    <li>
      La famille accueillante s'engage à <strong>garder l'animal accueilli à son domicile</strong>, à le traiter comme un membre de la famille, à lui fournir à ses frais de l'eau fraîche, une nourriture adaptée, une litière s'il s'agit d'un chat, à lui prodiguer l'attention, l'affection et les soins dont il a besoin.
      <ul>
        <li>La famille accueillant un <strong>chien</strong> s'engage, si cela est compatible avec son état de santé, à lui offrir des moments de promenade hors du domicile.</li>
        <li>La famille accueillant un <strong>chat</strong> peut lui laisser, après un temps d'adaptation, accès à l'extérieur, et ce à condition qu'il n'y ait pas de danger notoire (axe routier passant à proximité, etc.).</li>
      </ul>
    </li>

    <li>
      <strong class="heading">La famille accueillante s'engage à&nbsp;:</strong>
      <ul>
        <li>Donner régulièrement à l'association des nouvelles de l'animal confié.</li>
        <li>Accepter la visite des représentants de l'association aussi souvent que celle-ci le jugera utile.</li>
        <li>Répondre aux appels de la SDA.</li>
      </ul>
      <div style="margin-top:1.5mm;">La SDA se réserve le droit de <strong>reprendre l'animal confié à tout moment</strong> si elle estime que les conditions de vie ne sont pas satisfaisantes.</div>
    </li>

    <li>La famille d'accueil peut chercher dans son entourage un adoptant pour l'animal accueilli et présenter l'adoptant potentiel au refuge. La SDA se réserve le droit de valider ou d'invalider la proposition. La SDA se chargera d'effectuer l'adoption. Les modalités et frais d'adoption restent identiques à ceux pratiqués pour les animaux présents au refuge.</li>

    <li>Les éventuels dégâts causés par l'animal sont couverts par la <strong>responsabilité civile de l'accueillant</strong>. Une copie de la responsabilité civile est à joindre au contrat à sa signature.</li>

    <li>La famille accueillante s'engage à informer la SDA dans les plus brefs délais si l'animal accueilli est <strong>volé ou perdu</strong>.</li>

    <li>En cas d'accident ou de dommages causés à l'animal par un tiers à l'extérieur du domicile (par exemple une agression par un autre chien), il convient de prendre les coordonnées de la personne responsable et de nous les communiquer.</li>

    <li>La famille accueillante s'engage à prévenir la SDA en cas de <strong>déménagement</strong> et à lui communiquer ses nouvelles coordonnées.</li>

    <li>La famille accueillante a <strong>l'interdiction de céder à titre onéreux ou gratuit</strong> l'animal accueilli à une tierce personne.</li>

    <li>La famille accueillante s'engage, lorsqu'elle part en <strong>vacances</strong>, à trouver une solution de garde pour l'animal accueilli et à nous prévenir en amont.</li>

    <li>Si pour une raison ou une autre la famille accueillante doit se séparer de son protégé avant son adoption ou avant la date convenue avec la SDA, elle doit <strong>(sauf cas d'urgence&nbsp;: hospitalisation, entrée en maison de retraite, etc.)</strong> prévenir la SDA <strong>au minimum un mois à l'avance</strong>. L'association s'engage alors à reprendre l'animal confié.</li>

    <li>Si vous ne pouvez plus garder l'animal accueilli, il est <strong>interdit de publier toutes photos ou commentaires</strong> le concernant sur vos réseaux sociaux afin de lui trouver une nouvelle famille. Cela relève de la responsabilité du refuge.</li>

    <li>En cas de <strong>retour de l'animal à la SDA</strong>, l'adoption vous sera remboursée moins les <strong>50&nbsp;€</strong> qui resteront à la SDA.</li>
  </ol>

  ${(contract.notes || contract.special_conditions) ? `<div class="note">
    <div class="note-title">Note</div>
    <div class="note-body">${contract.notes ? htmlEscape(contract.notes) : ''}${contract.special_conditions ? `${contract.notes ? '\n\n' : ''}${htmlEscape(contract.special_conditions)}` : ''}</div>
  </div>` : ''}

  <div class="signed-at">
    Fait en double exemplaire à ${htmlEscape(contract.signed_at_location) || 'Estourmel'},
    le ${formatDateLong(contract.signed_at || contract.start_date)}.
  </div>

  <div class="signatures">
    <div class="sigbox">
      <div class="sigbox-head">Signature de la famille d'accueil</div>
      <div class="sigbox-body">Mention manuscrite « Lu et approuvé »<br/>puis signature</div>
    </div>
    <div class="sigbox">
      <div class="sigbox-head">Signature du Refuge SDA</div>
      <div class="sigbox-body is-refuge">
        <div class="cachet">${refugeCachetSvg}</div>
        <div class="signer-name">
          <span class="signer-label">Pour ${htmlEscape(companyName)}</span>
          ${createdByName ? htmlEscape(createdByName) : 'Le représentant'}
        </div>
      </div>
    </div>
  </div>

  <div class="footer">
    <div>
      <strong>Société de Défense des Animaux du Nord</strong><br/>
      ${htmlEscape(companyAddress)}
    </div>
    <div style="text-align:right;">
      ${htmlEscape(companyEmail)}<br/>
      Contrat ${htmlEscape(contract.contract_number)}
    </div>
  </div>
  <div class="footer-accent"></div>

</body>
</html>`
}
