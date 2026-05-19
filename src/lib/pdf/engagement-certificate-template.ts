import type { CompanyInfo } from '@/lib/types/database'
import { getSpeciesLabel } from '@/lib/species'

interface EngagementCertificatePdfData {
  certificate_number: string
  created_at: string
  notes: string | null
}

interface EngagementPdfAnimal {
  name: string
  species: string
  breed: string | null
  sex: string
  birth_date: string | null
  chip_number: string | null
  color?: string | null
}

interface EngagementPdfClient {
  kind: 'person' | 'organization'
  name: string
  first_name: string | null
  email: string | null
  phone: string | null
  address: string | null
  postal_code: string | null
  city: string | null
}

// === Charte SDA officielle ===
const NAVY = '#1e3a5f'
const NAVY_LIGHT = '#3d5a80'
const TEAL = '#5ba8a0'
const TEAL_BG = '#f0f7fa'
const ORANGE = '#c96b3c'
const ORANGE_BG = '#fdf4ee'
const STONE_300 = '#d9e6ed'
const STONE_500 = '#6b7f96'

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

function fullName(client: EngagementPdfClient): string {
  if (client.kind === 'organization') return client.name
  return client.first_name ? `${client.first_name} ${client.name}` : client.name
}

/**
 * Bloc d'engagements spécifiques à l'espèce.
 * Adapté selon les recommandations de l'arrêté du 30 mai 2022.
 */
function speciesSpecificBlock(species: string): string {
  if (species === 'dog') {
    return `
      <li><strong>Besoins du chien</strong> : promenades quotidiennes, contacts sociaux réguliers (humains et autres chiens), stimulation mentale, éducation positive. Une activité physique adaptée à la race, l'âge et l'état de santé est indispensable.</li>
      <li><strong>Durée de vie</strong> : 10 à 16 ans selon la race. Engagement long terme.</li>
      <li><strong>Identification</strong> : obligatoire dès l'âge de 4 mois (puce électronique ou tatouage), inscrite au fichier I-CAD.</li>
    `
  }
  if (species === 'cat') {
    return `
      <li><strong>Besoins du chat</strong> : un espace de vie suffisant, des points en hauteur, un griffoir, une litière propre, des moments de jeu et d'interactions. Le chat est un animal sensible au stress et aux changements d'environnement.</li>
      <li><strong>Durée de vie</strong> : 12 à 18 ans en moyenne. Engagement long terme.</li>
      <li><strong>Identification</strong> : obligatoire dès l'âge de 7 mois (puce électronique ou tatouage), inscrite au fichier I-CAD.</li>
    `
  }
  // NAC / ferme / autres
  return `
      <li><strong>Besoins spécifiques à l'espèce</strong> : se renseigner sur les besoins comportementaux, alimentaires, sociaux et environnementaux propres à l'espèce avant l'accueil de l'animal.</li>
      <li><strong>Durée de vie</strong> : variable selon l'espèce — engagement à anticiper sur toute la vie de l'animal.</li>
      <li><strong>Identification</strong> : se conformer aux obligations légales propres à l'espèce (puce, bague, tatouage, document d'accompagnement).</li>
  `
}

export function buildEngagementCertificateHtml(
  certificate: EngagementCertificatePdfData,
  animal: EngagementPdfAnimal,
  adopter: EngagementPdfClient,
  company: CompanyInfo | undefined,
  logoBase64: string | undefined
): string {
  const adopterAddressLines = [
    htmlEscape(adopter.address) || '',
    [adopter.postal_code, adopter.city].filter(Boolean).map(htmlEscape).join(' '),
  ].filter((l) => l.trim())

  const companyName = company?.name || "SDA d'Estourmel"
  const companyLegalName = company?.legal_name || companyName
  const companyAddress = company?.address || '11 route nationale, 59400 Estourmel, France'
  const companyEmail = company?.email || 'accueil@sda-nord.com'
  const companySiret = company?.siret || '32110272500025'

  const adopterFullName = fullName(adopter)

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Certificat d'engagement — ${certificate.certificate_number}</title>
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

    h1 { font-size: 20pt; font-weight: 700; color: ${NAVY}; margin: 4mm 0 2mm; letter-spacing: 0.4pt; }
    .legal-ref {
      font-size: 9pt;
      color: ${STONE_500};
      font-style: italic;
      margin-bottom: 3mm;
    }
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
      font-size: 11pt;
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

    ol.engagements { padding-left: 0; counter-reset: clause; list-style: none; margin: 3mm 0; }
    ol.engagements > li {
      position: relative;
      margin-bottom: 2.5mm;
      padding-left: 8mm;
      counter-increment: clause;
      font-size: 9.5pt;
      line-height: 1.55;
      text-align: justify;
    }
    ol.engagements > li::before {
      content: counter(clause);
      position: absolute;
      left: 0;
      top: 0;
      font-weight: 700;
      color: white;
      background: ${TEAL};
      width: 5.5mm;
      height: 5.5mm;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 8.5pt;
    }
    ol.engagements > li strong.heading { color: ${NAVY}; display: block; margin-bottom: 1mm; }
    ol.engagements ul { margin: 1.5mm 0 0; padding-left: 4mm; }
    ol.engagements ul li { margin-bottom: 1mm; font-size: 9pt; }

    .highlight {
      margin: 2mm 0;
      padding: 2.5mm 3mm;
      background: ${ORANGE_BG};
      border-left: 3px solid ${ORANGE};
      border-radius: 0 4px 4px 0;
      font-size: 9pt;
    }
    .highlight strong { color: ${ORANGE}; }

    .delay-box {
      margin: 5mm 0 3mm;
      padding: 4mm 4mm;
      background: ${ORANGE_BG};
      border: 2px solid ${ORANGE};
      border-radius: 6px;
      page-break-inside: avoid;
    }
    .delay-box-title {
      font-size: 11pt;
      font-weight: 700;
      color: ${ORANGE};
      letter-spacing: 0.5pt;
      text-transform: uppercase;
      margin-bottom: 2mm;
    }
    .delay-box p { margin: 0; font-size: 9.5pt; line-height: 1.55; }
    .delay-box strong { color: ${NAVY}; }

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
    .sigbox-body { min-height: 32mm; padding: 3mm 4mm; font-size: 8.5pt; color: ${STONE_500}; }

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
      ${logoBase64 ? `<img src="${logoBase64}" class="header-logo" alt="Logo" />` : ''}
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

  <h1>Certificat d'engagement et de connaissance</h1>
  <div class="legal-ref">Loi du 30 novembre 2021 — arrêté du 30 mai 2022 — article L214-8 du Code rural et de la pêche maritime</div>
  <span class="ref">N° ${htmlEscape(certificate.certificate_number)}</span>

  <div class="preamble">
    Je soussigné(e) <strong>${htmlEscape(adopterFullName)}</strong>${adopter.address ? `, demeurant ${htmlEscape(adopter.address)}${adopter.postal_code || adopter.city ? `, ${[adopter.postal_code, adopter.city].filter(Boolean).join(' ')}` : ''}` : ''},
    m'engage à accueillir <strong>${htmlEscape(animal.name)}</strong>
    (${htmlEscape(getSpeciesLabel(animal.species))}, ${sexLabel(animal.sex)})
    actuellement hébergé(e) par <strong>${htmlEscape(companyName)}</strong>.
  </div>

  <!-- ============== Identification ============== -->
  <div class="cards">
    <div class="card">
      <div class="card-title">Adoptant</div>
      <div class="card-body">
        <div class="name">${htmlEscape(adopterFullName)}</div>
        ${adopterAddressLines.length ? adopterAddressLines.map((l) => `<div>${l}</div>`).join('') : '<div class="muted">Adresse à compléter</div>'}
        ${adopter.phone ? `<div><span class="field-label">Téléphone :</span> <span class="field-value">${htmlEscape(adopter.phone)}</span></div>` : ''}
        ${adopter.email ? `<div><span class="field-label">Email :</span> <span class="field-value">${htmlEscape(adopter.email)}</span></div>` : ''}
      </div>
    </div>

    <div class="card">
      <div class="card-title">L'animal</div>
      <div class="card-body">
        <div class="name">${htmlEscape(animal.name)}</div>
        <div><span class="field-label">Espèce :</span> <span class="field-value">${htmlEscape(getSpeciesLabel(animal.species))}</span></div>
        ${animal.breed ? `<div><span class="field-label">Race :</span> <span class="field-value">${htmlEscape(animal.breed)}</span></div>` : ''}
        ${animal.color ? `<div><span class="field-label">Robe :</span> <span class="field-value">${htmlEscape(animal.color)}</span></div>` : ''}
        <div><span class="field-label">Sexe :</span> <span class="field-value">${sexLabel(animal.sex)}</span></div>
        <div><span class="field-label">Date de naissance :</span> <span class="field-value">${formatDateShort(animal.birth_date)}</span></div>
        ${animal.chip_number ? `<div><span class="field-label">Identification :</span> <span class="field-value">${htmlEscape(animal.chip_number)}</span></div>` : ''}
      </div>
    </div>
  </div>

  <!-- ============== Atteste avoir pris connaissance ============== -->
  <div class="section">
    <span class="section-icon">§</span>
    <span class="section-title-text">J'atteste avoir pris connaissance</span>
  </div>

  <ol class="engagements">
    <li>
      <strong class="heading">1. Des besoins physiologiques, médicaux et comportementaux de l'animal</strong>
      <ul>
        <li>Nourriture adaptée et accès permanent à de l'eau propre.</li>
        <li>Sorties, exercice physique et stimulation mentale réguliers, adaptés à l'espèce et l'individu.</li>
        <li>Soins vétérinaires : vaccinations, vermifuges, antiparasitaires, stérilisation lorsqu'elle est recommandée.</li>
        <li>Identification obligatoire (puce ou tatouage) et déclaration au fichier I-CAD.</li>
        <li>Conditions de vie compatibles avec la nature de l'espèce (espace, abri, calme, contacts sociaux).</li>
      </ul>
    </li>

    <li>
      <strong class="heading">2. Des implications financières liées à l'accueil de l'animal</strong>
      <ul>
        <li>Alimentation : <strong>30 à 60 €</strong> par mois selon l'espèce, la taille et l'âge.</li>
        <li>Frais vétérinaires courants : <strong>100 à 800 €</strong> par an (vaccins, antiparasitaires, contrôles).</li>
        <li>Frais imprévus (urgences, opérations, maladies chroniques) : <strong>jusqu'à plusieurs milliers d'euros</strong>. L'adhésion à une assurance santé animale est vivement recommandée.</li>
        <li>Autres frais : matériel (couchage, gamelles, transport), garde pendant les absences, toilettage selon la race.</li>
      </ul>
    </li>

    <li>
      <strong class="heading">3. Des obligations légales du propriétaire d'un animal</strong>
      <ul>
        <li><strong>Article L214-1</strong> du Code rural : tout animal étant un être sensible, il doit être placé par son propriétaire dans des conditions compatibles avec les impératifs biologiques de son espèce.</li>
        <li><strong>Article L215-11</strong> : les sévices graves, actes de cruauté ou d'abandon sont punis de <strong>5 ans d'emprisonnement et 75 000 € d'amende</strong>.</li>
        <li>Obligation d'identification : <strong>chien dès l'âge de 4 mois, chat dès l'âge de 7 mois</strong>.</li>
        <li>Responsabilité civile du propriétaire en cas de dommage causé par l'animal à un tiers ou à ses biens.</li>
        <li>Obligation de déclarer tout changement de propriétaire ou de domicile auprès de l'I-CAD.</li>
      </ul>
    </li>

    <li>
      <strong class="heading">4. Des besoins spécifiques à l'espèce de l'animal accueilli</strong>
      <ul>
        ${speciesSpecificBlock(animal.species)}
      </ul>
    </li>
  </ol>

  <!-- ============== Délai de réflexion ============== -->
  <div class="delay-box">
    <div class="delay-box-title">5. Délai légal de réflexion — 7 jours</div>
    <p>
      Je reconnais avoir été informé(e) que, conformément à l'<strong>article L214-8 du Code rural</strong>,
      <strong>aucune adoption ne peut être finalisée avant un délai de 7 jours calendaires</strong> à compter
      de la signature du présent certificat. Ce délai me permet de confirmer ma décision de manière éclairée
      et responsable.
    </p>
  </div>

  ${certificate.notes ? `<div class="highlight" style="margin-top:5mm;"><strong>Note :</strong> ${htmlEscape(certificate.notes)}</div>` : ''}

  <div class="signed-at">
    Fait à ${adopter.city ? htmlEscape(adopter.city) : 'Estourmel'}, le ${formatDateLong(certificate.created_at)}.
  </div>

  <div class="signatures">
    <div class="sigbox">
      <div class="sigbox-head">Signature de l'adoptant</div>
      <div class="sigbox-body">Mention manuscrite « Lu et approuvé »<br/>puis signature</div>
    </div>
    <div class="sigbox">
      <div class="sigbox-head">Signature du Refuge</div>
      <div class="sigbox-body">Pour ${htmlEscape(companyName)}</div>
    </div>
  </div>

  <div class="footer">
    <div>
      <strong>${htmlEscape(companyLegalName)}</strong><br/>
      ${htmlEscape(companyAddress)}
    </div>
    <div style="text-align:right;">
      ${htmlEscape(companyEmail)}<br/>
      Certificat ${htmlEscape(certificate.certificate_number)}
    </div>
  </div>
  <div class="footer-accent"></div>

</body>
</html>`
}
