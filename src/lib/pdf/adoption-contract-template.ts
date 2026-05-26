import type { CompanyInfo } from '@/lib/types/database'
import { getSpeciesLabel } from '@/lib/species'

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
  pound_entry_date?: string | null
  description?: string | null
}

interface AdoptionPdfClient {
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
const ADHESION_FEE = 35

const ADOPTION_REFUND_AMOUNT = 50

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

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '__/__/____ à __h__'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return '__/__/____ à __h__'
  return `${d.toLocaleDateString('fr-FR')} à ${d.getHours().toString().padStart(2, '0')}h${d.getMinutes().toString().padStart(2, '0')}`
}

function formatEuros(amount: number | null | undefined): string {
  if (amount == null) return '— €'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)
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

export function buildAdoptionContractHtml(
  contract: AdoptionContractPdfData,
  animal: AdoptionPdfAnimal,
  adopter: AdoptionPdfClient,
  company: CompanyInfo | undefined,
  logoBase64: string | undefined,
  animalPhotoBase64: string | undefined
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

  const animalNameDisplay = htmlEscape(animal.name) +
    (animal.name_secondary ? ` <span class="muted">/ ${htmlEscape(animal.name_secondary)}</span>` : '')

  const adoptionLineAmount = Math.max(0, Number(contract.adoption_fee ?? 0) - ADHESION_FEE)
  const cautionAmount = contract.sterilization_required && contract.sterilization_deposit
    ? Number(contract.sterilization_deposit)
    : 0

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Contrat d'adoption — ${contract.contract_number}</title>
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

    /* === Title === */
    h1 {
      font-size: 22pt;
      font-weight: 700;
      color: ${NAVY};
      margin: 4mm 0 2mm;
      letter-spacing: 0.4pt;
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

    /* === Identification cards === */
    .cards {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4mm;
      margin: 4mm 0 5mm;
    }
    .card {
      border: 1px solid ${STONE_300};
      border-radius: 6px;
      overflow: hidden;
      page-break-inside: avoid;
    }
    .card-title {
      background: ${NAVY};
      color: white;
      padding: 2mm 3mm;
      font-size: 8.5pt;
      font-weight: 700;
      letter-spacing: 1pt;
      text-transform: uppercase;
      text-align: center;
    }
    .card-body { padding: 3mm 4mm; font-size: 9pt; line-height: 1.7; }
    .card-body .name { font-weight: 700; font-size: 10pt; color: ${NAVY}; margin-bottom: 1mm; }
    .field { display: block; }
    .field-label { font-weight: 700; color: ${NAVY}; }
    .field-value { color: ${NAVY_LIGHT}; }
    .muted { color: ${STONE_500}; }
    .animal-card { display: flex; gap: 0; }
    .animal-card .photo {
      width: 70pt; height: auto; min-height: 100%;
      object-fit: cover;
      border-right: 1px solid ${STONE_300};
    }
    .animal-card .body { flex: 1; padding: 3mm 4mm; }

    /* === Fees block === */
    .fees {
      margin: 4mm 0 6mm;
      padding: 4mm 5mm;
      background: ${TEAL_BG};
      border: 1px solid ${STONE_300};
      border-radius: 6px;
      page-break-inside: avoid;
    }
    .fees-title {
      font-size: 8.5pt;
      text-transform: uppercase;
      letter-spacing: 1.2pt;
      color: ${TEAL};
      font-weight: 700;
      margin-bottom: 2mm;
    }
    .fees-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding: 1mm 0;
      font-size: 9.5pt;
      border-bottom: 1px dashed ${STONE_300};
    }
    .fees-row:last-of-type { border-bottom: 0; }
    .fees-row .lbl { color: ${NAVY}; }
    .fees-row .lbl small { color: ${STONE_500}; font-size: 8.5pt; font-weight: normal; }
    .fees-row .amt { font-weight: 700; color: ${NAVY}; min-width: 80pt; text-align: right; }
    .fees-total {
      margin-top: 2mm;
      padding-top: 2mm;
      border-top: 2px solid ${NAVY};
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      font-weight: 700;
      font-size: 11pt;
    }
    .fees-total .amt { color: ${ORANGE}; font-size: 13pt; }

    /* === Articles === */
    section.article {
      margin: 5mm 0 4mm;
      page-break-inside: avoid;
    }
    section.article + section.article { margin-top: 6mm; }
    .article-title {
      display: flex;
      align-items: center;
      gap: 3mm;
      margin-bottom: 2mm;
      padding-bottom: 1.5mm;
      border-bottom: 1px solid ${STONE_300};
    }
    .article-num {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22pt;
      height: 22pt;
      border-radius: 50%;
      background: ${ORANGE};
      color: white;
      font-size: 10pt;
      font-weight: 700;
      flex-shrink: 0;
    }
    .article-name {
      font-size: 11pt;
      font-weight: 700;
      color: ${NAVY};
      letter-spacing: 0.3pt;
      text-transform: uppercase;
    }
    section.article p, section.article li { font-size: 9.5pt; line-height: 1.55; text-align: justify; }
    section.article p { margin: 1.5mm 0; }
    section.article ul { margin: 1.5mm 0; padding-left: 5mm; }
    section.article li { margin-bottom: 1mm; }
    section.article h3 {
      font-size: 9.5pt;
      font-weight: 700;
      color: ${TEAL};
      margin-top: 3mm;
      margin-bottom: 1mm;
    }
    .warning {
      margin: 2mm 0;
      padding: 2.5mm 3mm;
      background: ${ORANGE_BG};
      border-left: 3px solid ${ORANGE};
      border-radius: 0 4px 4px 0;
      font-size: 9pt;
    }
    .warning strong { color: ${ORANGE}; }

    /* === Annex (Conditions) === */
    .annex {
      page-break-before: always;
      padding-top: 4mm;
    }
    .annex-title {
      font-size: 18pt;
      font-weight: 700;
      color: ${NAVY};
      margin: 2mm 0 4mm;
      letter-spacing: 0.4pt;
    }
    .annex-intro {
      margin: 0 0 4mm;
      padding: 3mm 4mm;
      background: ${ORANGE_BG};
      border-left: 3px solid ${ORANGE};
      border-radius: 0 4px 4px 0;
      font-size: 9.5pt;
      line-height: 1.55;
    }
    .annex ol { padding-left: 6mm; counter-reset: clause; list-style: none; }
    .annex ol li {
      position: relative;
      margin-bottom: 2.5mm;
      font-size: 9.5pt;
      line-height: 1.55;
      text-align: justify;
      counter-increment: clause;
      padding-left: 7mm;
    }
    .annex ol li::before {
      content: counter(clause) ")";
      position: absolute;
      left: 0;
      top: 0;
      font-weight: 700;
      color: ${TEAL};
      width: 6mm;
    }
    .annex .closing {
      margin: 5mm 0 4mm;
      padding: 3mm 4mm;
      border-top: 1px solid ${STONE_300};
      font-size: 9pt;
      text-align: justify;
      color: ${NAVY_LIGHT};
    }

    /* === Signatures === */
    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 5mm;
      margin-top: 6mm;
      page-break-inside: avoid;
    }
    .sigbox {
      border: 1px solid ${STONE_300};
      border-radius: 6px;
      overflow: hidden;
    }
    .sigbox-head {
      background: ${NAVY};
      color: white;
      text-align: center;
      padding: 2mm;
      font-size: 8.5pt;
      letter-spacing: 1pt;
      font-weight: 700;
      text-transform: uppercase;
    }
    .sigbox-body {
      min-height: 30mm;
      padding: 3mm 4mm;
      font-size: 8.5pt;
      color: ${STONE_500};
    }

    .signed-at {
      margin: 6mm 0 3mm;
      font-size: 9.5pt;
      font-weight: 700;
      color: ${NAVY};
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

    em.placeholder { color: ${STONE_500}; font-style: italic; }
  </style>
</head>
<body>

  <!-- ============== Header ============== -->
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

  <h1>Contrat d'adoption</h1>
  <span class="ref">N° ${htmlEscape(contract.contract_number)}</span>

  <div class="preamble">
    Notre établissement certifie avoir cédé le <strong>${formatDateTime(contract.adoption_date)}</strong>,
    à l'adoptant, l'animal décrit ci-dessous. De ce fait, nous nous dégageons de toute responsabilité.
  </div>

  <!-- ============== Identification ============== -->
  <div class="cards">
    <div class="card">
      <div class="card-title">L'adoptant</div>
      <div class="card-body">
        <div class="name">${htmlEscape(adopter.name)}</div>
        ${adopterAddressLines.length ? adopterAddressLines.map((l) => `<div>${l}</div>`).join('') : '<div class="muted">Adresse non renseignée</div>'}
        ${adopter.phone ? field('Téléphone&nbsp;:', ' ' + htmlEscape(adopter.phone)) : ''}
        ${adopter.email ? field('Email&nbsp;:', ' ' + htmlEscape(adopter.email)) : ''}
        <div class="muted" style="margin-top:1mm;">Numéro de carte d'identité&nbsp;:</div>
        <div class="muted">Numéro de passeport&nbsp;:</div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">L'animal</div>
      <div class="card-body">
        <div class="name">${animalNameDisplay}</div>
        ${field('Espèce&nbsp;:', ' ' + speciesLabel(animal.species))}
        ${animal.breed ? field('Race&nbsp;:', ' ' + htmlEscape(animal.breed)) : field('Race&nbsp;:', '')}
        ${animal.color ? field('Robe&nbsp;:', ' ' + htmlEscape(animal.color)) : field('Robe&nbsp;:', '')}
        ${field('Sexe&nbsp;:', ' ' + sexLabel(animal.sex))}
        ${field('Stérilisé(e)&nbsp;:', ' ' + (animal.sterilized ? 'Oui' : 'Non'))}
        ${field('Date de naissance&nbsp;:', ' ' + formatDateShort(animal.birth_date))}
        ${field('Numéro de puce&nbsp;:', ' ' + (animal.chip_number ? htmlEscape(animal.chip_number) : ''))}
        ${field('Numéro LOOF&nbsp;:', ' ' + (animal.loof_number ? htmlEscape(animal.loof_number) : ''))}
        ${field('Numéro de tatouage&nbsp;:', ' ' + (animal.tattoo_number ? htmlEscape(animal.tattoo_number) : ''))}
        ${field('Médaille&nbsp;:', ' ' + (animal.medal_number ? htmlEscape(animal.medal_number) : ''))}
      </div>
    </div>
  </div>

  ${animal.pound_entry_date ? `<p style="margin: 0 0 4mm;"><strong>Date d'entrée en refuge&nbsp;:</strong> ${formatDateShort(animal.pound_entry_date)}</p>` : ''}

  <!-- ============== Fees ============== -->
  <div class="fees">
    <div class="fees-title">Récapitulatif financier</div>
    <div class="fees-row">
      <span class="lbl">Montant de l'adoption <small>(participation aux frais vétérinaires)</small></span>
      <span class="amt">${formatEuros(adoptionLineAmount)}</span>
    </div>
    <div class="fees-row">
      <span class="lbl">Frais d'adhésion annuelle SDA <small>(don ouvrant droit à reçu fiscal)</small></span>
      <span class="amt">${formatEuros(ADHESION_FEE)}</span>
    </div>
    ${cautionAmount > 0 ? `<div class="fees-row">
      <span class="lbl">Caution stérilisation <small>(restituée sur certificat vétérinaire)</small></span>
      <span class="amt">${formatEuros(cautionAmount)}</span>
    </div>` : ''}
    <div class="fees-total">
      <span>Total versé à la signature</span>
      <span class="amt">${formatEuros(Number(contract.adoption_fee ?? 0) + cautionAmount)}</span>
    </div>
  </div>

  <!-- ============== Articles ============== -->
  <section class="article">
    <div class="article-title"><span class="article-num">1</span><span class="article-name">Identification et état sanitaire de l'animal</span></div>

    <h3>L'identification</h3>
    <p>Votre compagnon est identifié par puce électronique ou tatouage, conformément à la législation en vigueur. <strong>Le changement de détenteur au fichier d'identification (ICAD) sera effectué par le Refuge une fois le certificat de stérilisation fourni par l'Adoptant(e).</strong></p>

    <h3>Les vaccins</h3>
    <p>Votre compagnon sort du refuge à jour des vaccins mentionnés ci-après.</p>
    <ul>
      <li><strong>Chiens&nbsp;:</strong> vaccinés contre la maladie de Carré, l'hépatite de Rubarth, la parvovirose, le parainfluenza et la leptospirose.</li>
      <li><strong>Chats&nbsp;:</strong> vaccinés contre le coryza (rhinotrachéite virale féline) et le typhus félin (panleucopénie).</li>
    </ul>
    <div class="warning">
      <strong>Attention&nbsp;:</strong> la leucose féline (FeLV) n'est pas incluse dans le protocole vaccinal réalisé par le Refuge. Les animaux sortant du refuge ne sont pas vaccinés contre la rage, la France étant indemne de cette maladie. Si l'Adoptant(e) envisage de voyager à l'étranger, la vaccination antirabique sera obligatoire et à ses frais.
    </div>

    <h3>Tests viraux (chats uniquement)</h3>
    <p>Tous les chats sont systématiquement testés pour la leucose (FeLV) et le sida du chat (FIV) avant adoption. Les résultats figurent dans le carnet de santé remis au moment de l'adoption.</p>
    <p>En cas de chat FIV positif, l'Adoptant(e) reconnaît avoir été informé(e) préalablement et accepte que&nbsp;: le chat ne doit pas avoir accès à l'extérieur afin de limiter les risques de transmission&nbsp;; il ne doit pas être mis en contact avec d'autres chats, sauf s'ils sont eux-mêmes FIV positifs.</p>
  </section>

  <section class="article">
    <div class="article-title"><span class="article-num">2</span><span class="article-name">Engagements du Refuge</span></div>
    <p>Le Refuge s'engage à&nbsp;:</p>
    <ul>
      <li>Identifier l'animal conformément à la législation en vigueur.</li>
      <li>Lui avoir administré les soins vétérinaires préalables à l'adoption (vaccins, antiparasitaires, vermifuges).</li>
      <li>Fournir à l'Adoptant(e) un <strong>certificat vétérinaire de cession</strong>, daté de moins d'un mois, attestant de l'état de santé apparent de l'animal au jour de l'examen.</li>
    </ul>
    <div class="warning">
      <strong>Attention&nbsp;:</strong> ce certificat vétérinaire ne garantit pas l'absence de maladies non visibles lors de l'examen, notamment des affections en période d'incubation. À titre d'exemple&nbsp;: chez le chat le coryza, la péritonite infectieuse féline (PIF), des troubles digestifs ou parasitaires&nbsp;; chez le chien diverses affections virales ou respiratoires.
    </div>
    <p>En cas d'apparition de symptômes <strong>dans un délai de dix jours</strong>, l'Adoptant(e) s'engage à en informer immédiatement le Refuge <strong>par mail exclusivement</strong> (aucun appel téléphonique ne sera pris en compte). Le Refuge proposera alors un rendez-vous avec son vétérinaire référent dans la mesure du possible et prendra en charge le coût de la consultation.</p>
    <p>Passé ce délai de 10 jours, les frais seront exclusivement à la charge de l'Adoptant(e).</p>
    <p>Le Refuge s'engage par ailleurs à reprendre l'animal adopté dans un délai raisonnable si l'Adoptant(e) se trouve un jour en situation de devoir l'abandonner.</p>
  </section>

  <section class="article">
    <div class="article-title"><span class="article-num">3</span><span class="article-name">Engagements de l'Adoptant(e)</span></div>
    <p>L'Adoptant(e) s'engage à&nbsp;:</p>
    <ul>
      <li>Offrir à l'animal un foyer stable, affectueux et respectueux de ses besoins physiques et émotionnels.</li>
      <li>Lui fournir nourriture, soins, attention, activité et suivi vétérinaire régulier.</li>
      <li><strong>Ne pas l'abandonner, le vendre ou le céder à qui que ce soit.</strong> L'animal qui vous est confié par l'adoption vous l'est à titre exclusivement personnel. Il vous est strictement interdit de le donner ou de le céder à une autre personne.</li>
      <li>Si, durant la vie de l'animal, vous vous trouvez dans l'impossibilité de le garder, restituer l'animal au Refuge et régler les frais d'abandon en vigueur à la date du retour. En cas de non-respect, des poursuites seront systématiquement engagées.</li>
      <li>Informer le Refuge en cas de perte, vol ou décès de l'animal.</li>
      <li>Respecter les obligations légales liées à la détention d'un animal.</li>
      <li>Faire stériliser l'animal à ses frais si cela n'a pas encore été réalisé.</li>
    </ul>
  </section>

  <section class="article">
    <div class="article-title"><span class="article-num">4</span><span class="article-name">Participation financière</span></div>
    <p>L'Adoptant(e) verse au Refuge une participation aux frais de prise en charge et de soins vétérinaires de l'animal d'un montant de <strong>${formatEuros(adoptionLineAmount)}</strong>, augmentée de <strong>${formatEuros(ADHESION_FEE)} d'adhésion annuelle</strong> (don ouvrant droit à reçu fiscal au titre de l'article 200 du CGI).</p>
    <p>Cette participation couvre tout ou partie&nbsp;:</p>
    <ul>
      <li>De l'identification.</li>
      <li>Des soins vétérinaires (vaccins, traitements antiparasitaires, vermifuges).</li>
      <li>De la stérilisation (si effectuée par le refuge).</li>
    </ul>
  </section>

  <section class="article">
    <div class="article-title"><span class="article-num">5</span><span class="article-name">Stérilisation (si non effectuée au refuge)</span></div>
    <p><strong>Tous les chiens typés molosses sortent du refuge stérilisés quel que soit leur âge. Tous les chats de plus de 6 mois sortent stérilisés du refuge. Tous les chiens de moins de 8 ans sortant du refuge non stérilisés doivent l'être.</strong></p>
    ${contract.sterilization_required ? `<p>L'Adoptant(e) s'engage à faire réaliser la stérilisation à ses frais, dans un délai maximum de <strong>trois (3) mois</strong> à compter de la date d'adoption${contract.sterilization_deadline ? ` (échéance fixée au <strong>${formatDateLong(contract.sterilization_deadline)}</strong>)` : ''}.</p>
    <div class="warning"><strong>Caution&nbsp;:</strong> un chèque de caution d'un montant de <strong>${formatEuros(cautionAmount || 200)}</strong> est demandé par le Refuge au moment de l'adoption. Ce chèque sera restitué dès réception par le Refuge d'un certificat vétérinaire attestant de la stérilisation.</div>` : '<p><em class="placeholder">Animal déjà stérilisé&nbsp;: aucun engagement de stérilisation.</em></p>'}
    <h3>Cas particulier des chiennes</h3>
    <p>Si la chienne n'a pas présenté de chaleurs visibles durant son séjour au refuge, le Refuge ne peut garantir qu'une stérilisation n'a pas déjà été effectuée avant son arrivée, notamment en cas de stérilisation interne sans cicatrice apparente. Il est donc fortement recommandé à l'Adoptant(e) de faire procéder à une <strong>échographie vétérinaire de contrôle</strong>, afin de vérifier la présence ou l'absence de l'utérus et des ovaires, et d'écarter toute anomalie comme la présence d'hydromètre.</p>
  </section>

  <section class="article">
    <div class="article-title"><span class="article-num">6</span><span class="article-name">Droit de visite et clause de reprise</span></div>
    <p>Le Refuge se réserve le droit&nbsp;:</p>
    <ul>
      <li>De prendre contact avec l'Adoptant(e) après l'adoption pour s'assurer du bien-être de l'animal.</li>
      <li>De reprendre l'animal sans indemnité ni remboursement si les conditions de vie s'avèrent incompatibles avec ses besoins ou en cas de maltraitance, négligence ou danger.</li>
    </ul>
  </section>

  <section class="article">
    <div class="article-title"><span class="article-num">7</span><span class="article-name">Traitement des données personnelles</span></div>
    <p>L'Adoptant(e) autorise le Refuge à conserver ses coordonnées à des fins de suivi post-adoption, conformément au Règlement Général sur la Protection des Données (RGPD).</p>
  </section>

  ${contract.special_conditions ? `<div class="warning"><strong>Conditions particulières&nbsp;:</strong> ${htmlEscape(contract.special_conditions)}</div>` : ''}
  ${contract.notes ? `<div class="warning"><strong>Notes complémentaires&nbsp;:</strong> ${htmlEscape(contract.notes)}</div>` : ''}

  <!-- ============== Signatures contrat ============== -->
  <div class="signed-at">
    Fait le ${formatDateTime(contract.signed_at || contract.adoption_date)} à ${htmlEscape(contract.signed_at_location) || 'Estourmel'}.
  </div>
  <div class="signatures">
    <div class="sigbox">
      <div class="sigbox-head">Signature de l'adoptant</div>
      <div class="sigbox-body">Mention manuscrite « Lu et approuvé »<br/>puis signature</div>
    </div>
    <div class="sigbox">
      <div class="sigbox-head">Signature du Refuge SDA</div>
      <div class="sigbox-body">Pour la SDA d'Estourmel</div>
    </div>
  </div>

  <!-- ============== Annex : Conditions d'adoption ============== -->
  <div class="annex">
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

    <h2 class="annex-title">Conditions d'adoption</h2>

    <div class="annex-intro">
      Je m'engage à respecter formellement toutes les clauses ci-après, étant entendu que le non-respect de l'une d'entre elles m'obligerait, non seulement à restituer l'animal immédiatement à la S.D.A. sur sa simple demande et sans pouvoir prétendre à une indemnisation quelle qu'elle soit, mais m'exposerait en outre à me voir réclamer des dommages-intérêts.
    </div>

    <ol>
      <li>Cet animal m'est confié à titre personnel et je ne peux ni le vendre, ni le donner à quiconque sauf autorisation expresse et écrite de la S.D.A.</li>
      <li>S'il m'est impossible de le garder ou de supporter le coût de sa nourriture et de ses soins, je dois obligatoirement contacter la S.D.A.</li>
      <li>Je dois le faire vivre dans des conditions compatibles avec les impératifs biologiques de son espèce, conformément à la loi du 10 juillet 1976.</li>
      <li>À mes frais, je m'engage à faire le traitement anti-puce et le vermifuge 15 jours après l'adoption au refuge, et à faire les rappels annuels de vaccinations contre les maladies de Carré, Hépatite et Parvovirose. Je lui donnerai tous les soins nécessités par son état de santé.</li>
      <li>Chaque animal passe une visite vétérinaire avant cession, dans les 7 jours précédant son adoption. Il est malgré tout possible qu'une maladie (type coryza chez le chat) non détectable lors de la consultation se déclare dans les jours qui suivent. Si cela survient dans les 10 jours suivant l'adoption, contactez-nous par mail&nbsp;: nous programmerons une consultation chez notre vétérinaire partenaire aux frais de la SDA.</li>
      <li>Je ne dois pas le laisser divaguer sur la voie publique.</li>
      <li>Je devrai présenter l'animal à tout moment à un représentant dûment accrédité par la S.D.A. qui se réserve de vérifier les conditions d'existence de l'animal qui m'est confié.</li>
      <li>J'avertirai la S.D.A. de sa fuite ou de son décès aussitôt que possible (celle-ci se réserve le droit d'en vérifier les circonstances) ainsi que de tout changement d'adresse.</li>
      <li>Toute restitution de l'animal à la S.D.A. sous 15 jours sera facturée <strong>${formatEuros(ADOPTION_REFUND_AMOUNT)}</strong>. Au-delà, les frais d'abandon sont de <strong>125&nbsp;€</strong> et donnent lieu à la délivrance d'un reçu à conserver.</li>
      <li>La S.D.A. garde un regard sur l'animal jusqu'à son décès, et se réserve le droit de mettre ou non l'animal au nom de l'adoptant.</li>
    </ol>

    <p class="closing">
      Je reconnais être avisé(e) que je deviens totalement responsable de l'animal à compter de la signature du présent contrat, et m'engage à souscrire les assurances nécessaires pour couvrir les dommages qu'il pourrait causer tant à autrui qu'à moi-même en toutes circonstances. Je renonce expressément à toute action à l'encontre de la S.D.A. que je décharge de toute responsabilité. <strong>Tout litige devra être soumis à Monsieur le Président de la S.D.A. par courrier&nbsp;; s'il ne peut se résoudre amiablement, seuls les tribunaux du ressort de Cambrai seront compétents pour en connaître.</strong>
    </p>

    <div class="signed-at">
      Fait le ${formatDateTime(contract.signed_at || contract.adoption_date)} à ${htmlEscape(contract.signed_at_location) || 'Estourmel'}.
    </div>
    <div class="signatures">
      <div class="sigbox">
        <div class="sigbox-head">Signature de l'adoptant</div>
        <div class="sigbox-body">Mention manuscrite « Lu et approuvé »<br/>puis signature</div>
      </div>
      <div class="sigbox">
        <div class="sigbox-head">Signature du Refuge SDA</div>
        <div class="sigbox-body">Pour la SDA d'Estourmel</div>
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
  </div>

</body>
</html>`
}
