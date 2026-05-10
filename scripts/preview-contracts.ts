// Aperçu des contrats SDA générés avec les nouveaux templates.
// Génère le HTML + le PDF A4 final (via Puppeteer) pour relecture.
// Run depuis le repo : npx tsx scripts/preview-contracts.ts
import { readFileSync, writeFileSync } from 'node:fs'
import puppeteer from 'puppeteer'
import { buildAdoptionContractHtml } from '../src/lib/pdf/adoption-contract-template'
import { buildFosterContractHtml } from '../src/lib/pdf/foster-contract-template'

async function htmlToPdf(html: string, outPath: string) {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    await page.pdf({
      path: outPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    })
  } finally {
    await browser.close()
  }
}

const logoBuffer = readFileSync('public/logo-sda.png')
const logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`

const company = {
  name: "SDA d'Estourmel",
  legal_name: 'Société de Défense des Animaux du Nord',
  description: '',
  email: 'accueil@sda-nord.com',
  phone: '06 84 41 89 34',
  website: 'sda-nord.com',
  iban: '',
  bic: '',
  address: '11 route nationale, 59400 Estourmel, France',
  siret: '32110272500025',
}

// === ADOPTION ===
const adoptionContract = {
  contract_number: 'CA-2026-042',
  adoption_date: '2026-05-10T15:30:00.000Z',
  adoption_fee: 150,
  sterilization_required: true,
  sterilization_deadline: '2026-08-10',
  sterilization_deposit: 200,
  visit_right_clause: true,
  non_resale_clause: true,
  shelter_return_clause: true,
  household_acknowledgment: true,
  special_conditions: null,
  signed_at_location: 'Estourmel',
  signed_at: '2026-05-10T15:30:00.000Z',
  notes: null,
}

const adoptionAnimal = {
  name: 'YODETTE',
  name_secondary: null,
  species: 'cat',
  breed: 'EUROPÉEN',
  sex: 'female',
  birth_date: '2024-11-15',
  chip_number: '250268781766999',
  color: 'TRICOLORE',
  sterilized: false,
  tattoo_number: null,
  medal_number: '2417',
  loof_number: null,
  pound_entry_date: '2026-02-08',
  description: null,
}

const adopter = {
  name: 'Mme Antoine Dubois',
  email: 'a.dubois@example.fr',
  phone: '06 78 90 12 34',
  address: '42 rue Gambetta',
  postal_code: '59100',
  city: 'Roubaix',
}

const adoptionHtml = buildAdoptionContractHtml(
  adoptionContract,
  adoptionAnimal,
  adopter,
  company,
  logoBase64,
  undefined
)
async function main() {
  writeFileSync('/tmp/sda-preview-adoption.html', adoptionHtml)
  console.log('✔ /tmp/sda-preview-adoption.html')
  await htmlToPdf(adoptionHtml, '/tmp/sda-preview-adoption.pdf')
  console.log('✔ /tmp/sda-preview-adoption.pdf')
  writeFileSync('/tmp/sda-preview-foster.html', fosterHtml)
  console.log('✔ /tmp/sda-preview-foster.html')
  await htmlToPdf(fosterHtml, '/tmp/sda-preview-foster.pdf')
  console.log('✔ /tmp/sda-preview-foster.pdf')
}
main().catch((e) => { console.error(e); process.exit(1) })

// === FOSTER FAMILY ===
const fosterContract = {
  contract_number: 'CFA-2026-017',
  start_date: '2026-05-12',
  expected_end_date: '2026-08-12',
  signed_at_location: 'Estourmel',
  signed_at: '2026-05-12T10:00:00.000Z',
  vet_costs_covered_by_shelter: true,
  food_provided_by_shelter: false,
  insurance_required: true,
  household_consent: true,
  other_animals_at_home: 'Un chat castré, 8 ans',
  special_conditions: null,
  notes: 'Accueil post-opératoire — chien à surveiller pendant 15 jours après castration.',
}

const fosterAnimal = {
  name: 'TALIA',
  name_secondary: null,
  species: 'dog',
  breed: 'AMERICAN BULLY',
  sex: 'female',
  birth_date: '2022-03-08',
  chip_number: '250269610352668',
  color: 'BRINGÉ',
  sterilized: true,
  tattoo_number: null,
  medal_number: '1285',
  loof_number: null,
}

const foster = {
  name: 'M. Thierry Ruffin',
  email: 'thierry.ruffin@example.fr',
  phone: '06 71 70 03 43',
  address: '8 rue du Vilers',
  postal_code: '59980',
  city: 'Bertry',
}

const fosterHtml = buildFosterContractHtml(
  fosterContract,
  fosterAnimal,
  foster,
  company,
  logoBase64,
  undefined
)
