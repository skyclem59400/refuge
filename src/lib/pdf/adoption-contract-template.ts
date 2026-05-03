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

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '____ / ____ / _______'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return '____ / ____ / _______'
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
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

function sexLabel(sex: string): string {
  if (sex === 'male') return 'Mâle'
  if (sex === 'female') return 'Femelle'
  return 'Inconnu'
}

function checkbox(checked: boolean): string {
  return checked ? '☒' : '☐'
}

export function buildAdoptionContractHtml(
  contract: AdoptionContractPdfData,
  animal: AdoptionPdfAnimal,
  adopter: AdoptionPdfClient,
  company: CompanyInfo | undefined,
  logoBase64: string | undefined
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
    @page { size: A4; margin: 18mm 16mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #1a1a1a;
      margin: 0;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #1a1a1a;
      padding-bottom: 12pt;
      margin-bottom: 16pt;
    }
    .header .company { font-size: 9.5pt; line-height: 1.4; }
    .header .company strong { font-size: 11pt; }
    .header .logo img { max-height: 60pt; max-width: 130pt; }
    h1 {
      font-size: 16pt;
      text-align: center;
      margin: 0 0 4pt 0;
      letter-spacing: 0.5pt;
      text-transform: uppercase;
    }
    .subtitle {
      text-align: center;
      font-size: 10pt;
      color: #555;
      margin-bottom: 18pt;
    }
    .ref {
      text-align: right;
      font-size: 9.5pt;
      color: #555;
      margin-bottom: 14pt;
    }
    h2 {
      font-size: 11pt;
      text-transform: uppercase;
      letter-spacing: 0.5pt;
      border-bottom: 1px solid #ccc;
      padding-bottom: 3pt;
      margin: 16pt 0 8pt 0;
    }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8pt 16pt; }
    .field { font-size: 10pt; }
    .field .label { color: #666; font-size: 9pt; }
    .field .value { font-weight: 600; }
    p { margin: 6pt 0; text-align: justify; }
    ul { margin: 6pt 0; padding-left: 18pt; }
    li { margin-bottom: 4pt; }
    .checklist { font-size: 10pt; line-height: 1.7; }
    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24pt;
      margin-top: 26pt;
    }
    .sigbox {
      border-top: 1px solid #1a1a1a;
      padding-top: 6pt;
      min-height: 90pt;
      font-size: 9pt;
    }
    .sigbox .who { font-weight: 600; margin-bottom: 4pt; }
    .footer {
      position: fixed;
      bottom: 8mm;
      left: 16mm;
      right: 16mm;
      font-size: 8pt;
      color: #777;
      text-align: center;
      border-top: 1px solid #ddd;
      padding-top: 4pt;
    }
    .fee-box {
      border: 1px solid #1a1a1a;
      padding: 6pt 12pt;
      margin: 8pt 0;
      font-weight: 600;
      font-size: 11pt;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="company">
      <strong>${companyName}</strong><br/>
      ${companyAddress ? companyAddress + '<br/>' : ''}
      ${companyPhone ? 'Tél : ' + companyPhone + '<br/>' : ''}
      ${companyEmail ? companyEmail + '<br/>' : ''}
      ${companySiret ? 'SIRET : ' + companySiret : ''}
    </div>
    <div class="logo">
      ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" />` : ''}
    </div>
  </div>

  <div class="ref">N° ${contract.contract_number}</div>

  <h1>Contrat d'adoption</h1>
  <div class="subtitle">Cession définitive d'un animal — document à signer en deux exemplaires</div>

  <p><strong>Entre les soussignés :</strong></p>

  <h2>1. Le cédant (le refuge)</h2>
  <p>
    <strong>${companyName}</strong>${companyAddress ? ', situé ' + companyAddress : ''}${companyPhone ? ', téléphone ' + companyPhone : ''}${companyEmail ? ', courriel ' + companyEmail : ''}.
    Ci-après désigné « le refuge ».
  </p>

  <h2>2. L'adoptant</h2>
  <div class="grid-2">
    <div class="field"><div class="label">Nom et prénom</div><div class="value">${adopter.name}</div></div>
    <div class="field"><div class="label">Téléphone</div><div class="value">${adopter.phone || '—'}</div></div>
    <div class="field"><div class="label">Courriel</div><div class="value">${adopter.email || '—'}</div></div>
    <div class="field"><div class="label">Adresse</div><div class="value">${adopterAddress}</div></div>
  </div>
  <p style="margin-top:8pt">Ci-après désigné « l'adoptant ».</p>

  <h2>3. Animal cédé</h2>
  <div class="grid-2">
    <div class="field"><div class="label">Nom de l'animal</div><div class="value">${animal.name}</div></div>
    <div class="field"><div class="label">Espèce</div><div class="value">${speciesLabel(animal.species)}</div></div>
    <div class="field"><div class="label">Race</div><div class="value">${animal.breed || '—'}</div></div>
    <div class="field"><div class="label">Sexe</div><div class="value">${sexLabel(animal.sex)}</div></div>
    <div class="field"><div class="label">Date de naissance</div><div class="value">${formatDate(animal.birth_date)}</div></div>
    <div class="field"><div class="label">N° de puce / I-CAD</div><div class="value">${animal.chip_number || '—'}</div></div>
  </div>

  <h2>4. Frais d'adoption</h2>
  <p>
    Le refuge cède définitivement l'animal désigné ci-dessus à l'adoptant en date du
    <strong>${formatDate(contract.adoption_date)}</strong>, en contrepartie d'une participation
    aux frais engagés (identification, vaccinations, soins vétérinaires, stérilisation
    le cas échéant) dont le montant est fixé à :
  </p>
  <div class="fee-box">${formatEuros(contract.adoption_fee)}</div>
  <p>
    Le règlement de cette somme conditionne la cession effective de l'animal.
    Cette participation n'est pas un prix de vente : l'adoption d'un animal n'est pas
    un acte commercial.
  </p>

  <h2>5. Engagements de l'adoptant</h2>
  <p>L'adoptant s'engage solennellement à :</p>
  <ul>
    <li>Considérer l'animal comme un membre de son foyer et lui assurer une vie digne, dans des conditions adaptées à son espèce, sa race et son comportement.</li>
    <li>Lui apporter les soins quotidiens nécessaires (alimentation équilibrée, eau propre, sorties, attention, suivi vétérinaire régulier).</li>
    <li>Le faire identifier (puce ou tatouage) et déclarer à son nom auprès du fichier I-CAD si ce n'est pas déjà fait.</li>
    <li>Souscrire ou maintenir une assurance responsabilité civile couvrant l'animal.</li>
    <li>Ne jamais l'abandonner, le maltraiter, ni le confier à un laboratoire ou à un usage incompatible avec son bien-être.</li>
  </ul>

  <h2>6. Clauses particulières</h2>
  <div class="checklist">
    ${contract.sterilization_required ? `
    <div>${checkbox(true)} <strong>Stérilisation obligatoire</strong> : si l'animal n'est pas déjà stérilisé, l'adoptant s'engage à le faire stériliser avant le ${formatDate(contract.sterilization_deadline)}${contract.sterilization_deposit ? `, contre une caution remboursable de ${formatEuros(contract.sterilization_deposit)} sur présentation du certificat vétérinaire` : ''}.</div>
    ` : `<div>${checkbox(false)} Stérilisation laissée à l'appréciation de l'adoptant.</div>`}
    <div>${checkbox(contract.non_resale_clause)} <strong>Clause de non-cession</strong> : l'adoptant s'engage à ne pas vendre, donner ou céder l'animal à un tiers sans accord écrit préalable du refuge.</div>
    <div>${checkbox(contract.shelter_return_clause)} <strong>Clause de reprise</strong> : si l'adoptant ne peut plus assumer la garde de l'animal, il s'engage à le restituer au refuge plutôt qu'à l'abandonner ou le placer ailleurs sans concertation.</div>
    <div>${checkbox(contract.visit_right_clause)} <strong>Droit de visite et de suivi</strong> : l'adoptant accepte que le refuge puisse, sur rendez-vous, s'enquérir des conditions de vie de l'animal pendant la première année.</div>
    <div>${checkbox(contract.household_acknowledgment)} L'adoptant atteste que l'ensemble du foyer (conjoint, enfants, autres animaux) est informé et consentant pour cette adoption.</div>
  </div>

  ${contract.special_conditions ? `<p style="margin-top:10pt"><strong>Conditions particulières :</strong> ${contract.special_conditions}</p>` : ''}
  ${contract.notes ? `<p><strong>Notes complémentaires :</strong> ${contract.notes}</p>` : ''}

  <h2>7. I-CAD / Identification</h2>
  <p>
    Le refuge se charge de la déclaration de changement de propriétaire auprès du fichier
    national d'identification I-CAD. L'adoptant en deviendra le titulaire officiel après
    enregistrement.
  </p>

  <h2>8. Résiliation et litiges</h2>
  <p>
    En cas de manquement grave aux engagements ci-dessus, le refuge se réserve le droit de
    reprendre l'animal sans indemnité, après mise en demeure. À défaut d'accord amiable,
    tout litige sera soumis aux tribunaux français compétents.
  </p>

  <div class="signatures">
    <div class="sigbox">
      <div class="who">Le refuge</div>
      <div>Fait à ${contract.signed_at_location || '_____________________'}, le ${formatDate(contract.signed_at)}</div>
      <div style="margin-top: 24pt; color: #888; font-size: 8.5pt;">Signature, nom et qualité</div>
    </div>
    <div class="sigbox">
      <div class="who">L'adoptant</div>
      <div>Fait à ${contract.signed_at_location || '_____________________'}, le ${formatDate(contract.signed_at)}</div>
      <div style="margin-top: 8pt; font-size: 8.5pt;">Mention manuscrite « Lu et approuvé »<br/>puis signature</div>
    </div>
  </div>

  <div class="footer">
    Contrat d'adoption établi le ${formatDate(new Date().toISOString())} — ${companyName} — N° ${contract.contract_number}
  </div>
</body>
</html>`
}
