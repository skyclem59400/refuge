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

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '____ / ____ / _______'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return '____ / ____ / _______'
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function speciesLabel(species: string): string {
  if (species === 'cat') return 'Chat'
  if (species === 'dog') return 'Chien'
  return species
}

function sexLabel(sex: string): string {
  if (sex === 'male') return 'Male'
  if (sex === 'female') return 'Femelle'
  return 'Inconnu'
}

function checkbox(checked: boolean): string {
  return checked ? '☒' : '☐'
}

export function buildFosterContractHtml(
  contract: FosterContractPdfData,
  animal: FosterPdfAnimal,
  foster: FosterPdfClient,
  company: CompanyInfo | undefined,
  logoBase64: string | undefined
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
  </style>
</head>
<body>
  <div class="header">
    <div class="company">
      <strong>${companyName}</strong><br/>
      ${companyAddress ? companyAddress + '<br/>' : ''}
      ${companyPhone ? 'Tel : ' + companyPhone + '<br/>' : ''}
      ${companyEmail ? companyEmail + '<br/>' : ''}
      ${companySiret ? 'SIRET : ' + companySiret : ''}
    </div>
    <div class="logo">
      ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" />` : ''}
    </div>
  </div>

  <div class="ref">N° ${contract.contract_number}</div>

  <h1>Convention de placement en famille d'accueil</h1>
  <div class="subtitle">Document a signer en deux exemplaires — un pour chaque partie</div>

  <p><strong>Entre les soussignes :</strong></p>

  <h2>1. Le refuge / la structure d'accueil</h2>
  <p>
    <strong>${companyName}</strong>${companyAddress ? ', situee ' + companyAddress : ''}${companyPhone ? ', telephone ' + companyPhone : ''}${companyEmail ? ', courriel ' + companyEmail : ''}.
    Ci-apres designe « le refuge ».
  </p>

  <h2>2. La famille d'accueil</h2>
  <div class="grid-2">
    <div class="field"><div class="label">Nom et prenom</div><div class="value">${foster.name}</div></div>
    <div class="field"><div class="label">Telephone</div><div class="value">${foster.phone || '—'}</div></div>
    <div class="field"><div class="label">Courriel</div><div class="value">${foster.email || '—'}</div></div>
    <div class="field"><div class="label">Adresse</div><div class="value">${fosterAddress}</div></div>
  </div>
  <p style="margin-top:8pt">Ci-apres designee « la famille d'accueil ».</p>

  <h2>3. Animal confie</h2>
  <div class="grid-2">
    <div class="field"><div class="label">Nom de l'animal</div><div class="value">${animal.name}</div></div>
    <div class="field"><div class="label">Espece</div><div class="value">${speciesLabel(animal.species)}</div></div>
    <div class="field"><div class="label">Race</div><div class="value">${animal.breed || '—'}</div></div>
    <div class="field"><div class="label">Sexe</div><div class="value">${sexLabel(animal.sex)}</div></div>
    <div class="field"><div class="label">Date de naissance</div><div class="value">${formatDate(animal.birth_date)}</div></div>
    <div class="field"><div class="label">N° de puce / I-CAD</div><div class="value">${animal.chip_number || '—'}</div></div>
  </div>

  <h2>4. Duree et conditions de placement</h2>
  <div class="grid-2">
    <div class="field"><div class="label">Date de debut</div><div class="value">${formatDate(contract.start_date)}</div></div>
    <div class="field"><div class="label">Fin previsionnelle</div><div class="value">${formatDate(contract.expected_end_date)}</div></div>
  </div>
  <p>
    Le refuge confie a la famille d'accueil l'animal designe ci-dessus, dans les conditions
    suivantes. Le placement est temporaire et revocable a tout moment par le refuge.
    L'animal demeure en toutes circonstances la propriete du refuge.
  </p>

  <h2>5. Engagements de la famille d'accueil</h2>
  <p>La famille d'accueil s'engage a :</p>
  <ul>
    <li>Heberger l'animal dans des conditions decentes, hygieniques et adaptees a son espece et a son comportement.</li>
    <li>Lui apporter les soins quotidiens necessaires (alimentation, hydratation, sorties, attention).</li>
    <li>Ne jamais le ceder, le vendre ni le donner a un tiers sans autorisation ecrite du refuge.</li>
    <li>Informer immediatement le refuge en cas de probleme de sante, comportement, fugue ou incident.</li>
    <li>Transporter l'animal aux rendez-vous veterinaires fixes par le refuge.</li>
    <li>Restituer l'animal au refuge a la premiere demande de celui-ci.</li>
    <li>Ne pas laisser l'animal seul sur de longues periodes au-dela du raisonnable.</li>
  </ul>

  <h2>6. Engagements du refuge</h2>
  <p>Le refuge s'engage a :</p>
  <ul>
    <li>Fournir un suivi sanitaire et veterinaire adapte a l'animal.</li>
    <li>Couvrir les frais veterinaires prescrits ou valides par lui-meme.</li>
    <li>Reprendre l'animal sur simple demande de la famille d'accueil dans un delai raisonnable.</li>
    <li>Tenir la famille d'accueil informee des decisions concernant l'avenir de l'animal (adoption, retour refuge, etc.).</li>
  </ul>

  <h2>7. Modalites particulieres</h2>
  <div class="checklist">
    <div>${checkbox(contract.vet_costs_covered_by_shelter)} Frais veterinaires pris en charge par le refuge (sur prescription validee).</div>
    <div>${checkbox(contract.food_provided_by_shelter)} Alimentation fournie par le refuge.</div>
    <div>${checkbox(contract.insurance_required)} Assurance responsabilite civile a jour requise pour le foyer.</div>
    <div>${checkbox(contract.household_consent)} Accord ecrit ou oral de l'ensemble du foyer sur l'accueil de l'animal.</div>
  </div>

  ${contract.other_animals_at_home ? `<p><strong>Autres animaux presents au foyer :</strong> ${contract.other_animals_at_home}</p>` : ''}
  ${contract.special_conditions ? `<p><strong>Conditions particulieres :</strong> ${contract.special_conditions}</p>` : ''}
  ${contract.notes ? `<p><strong>Notes complementaires :</strong> ${contract.notes}</p>` : ''}

  <h2>8. I-CAD / Identification</h2>
  <p>
    Le placement en famille d'accueil n'entraine pas de changement de proprietaire au fichier
    national I-CAD. L'animal reste identifie au nom du refuge ou de la structure detentrice.
  </p>

  <div class="signatures">
    <div class="sigbox">
      <div class="who">Le refuge</div>
      <div>Fait a ${contract.signed_at_location || '_____________________'}, le ${formatDate(contract.signed_at)}</div>
      <div style="margin-top: 24pt; color: #888; font-size: 8.5pt;">Signature, nom et qualite</div>
    </div>
    <div class="sigbox">
      <div class="who">La famille d'accueil</div>
      <div>Fait a ${contract.signed_at_location || '_____________________'}, le ${formatDate(contract.signed_at)}</div>
      <div style="margin-top: 8pt; font-size: 8.5pt;">Mention manuscrite « Lu et approuve »<br/>puis signature</div>
    </div>
  </div>

  <div class="footer">
    Convention etablie le ${formatDate(new Date().toISOString())} — ${companyName} — N° ${contract.contract_number}
  </div>
</body>
</html>`
}
