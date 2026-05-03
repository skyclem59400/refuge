// Builds the adoption contract PDF as a Buffer. Used by:
//   - the API route /api/pdf/adoption-contract/[id] (download/preview)
//   - the server action sendAdoptionContractForSignature (sent to Documenso)

import { createAdminClient } from '@/lib/supabase/server'
import { buildAdoptionContractHtml } from '@/lib/pdf/adoption-contract-template'
import type { CompanyInfo, Establishment } from '@/lib/types/database'

interface BuildResult {
  buffer: Buffer
  filename: string
  contractNumber: string
}

export async function buildAdoptionContractPdf(contractId: string): Promise<BuildResult> {
  const admin = createAdminClient()

  const { data: contract, error } = await admin
    .from('adoption_contracts')
    .select('*, animals!inner(id, name, species, breed, sex, birth_date, chip_number, animal_photos(url, is_primary)), adopter:clients!adopter_client_id(name, email, phone, address, postal_code, city)')
    .eq('id', contractId)
    .single()

  if (error || !contract) {
    throw new Error('Contrat introuvable')
  }

  // Embed primary animal photo as base64 so it survives in the PDF without
  // depending on network access from Puppeteer.
  let animalPhotoBase64: string | undefined
  const photos = (contract.animals?.animal_photos ?? []) as Array<{ url: string; is_primary: boolean }>
  const primaryPhoto = photos.find((p) => p.is_primary) ?? photos[0]
  if (primaryPhoto?.url) {
    try {
      const r = await fetch(primaryPhoto.url)
      if (r.ok) {
        const buf = await r.arrayBuffer()
        const ct = r.headers.get('content-type') || 'image/jpeg'
        animalPhotoBase64 = `data:${ct};base64,${Buffer.from(buf).toString('base64')}`
      }
    } catch {
      // ignore — fallback rendering without photo
    }
  }

  let companyInfo: CompanyInfo | undefined
  let logoUrl: string | null = null

  if (contract.establishment_id) {
    const { data: establishment } = await admin
      .from('establishments')
      .select('*')
      .eq('id', contract.establishment_id)
      .single()
    if (establishment) {
      const estab = establishment as Establishment
      companyInfo = {
        name: estab.name,
        description: estab.description,
        email: estab.email,
        phone: estab.phone,
        website: estab.website,
        iban: estab.iban,
        bic: estab.bic,
        address: estab.address,
        legal_name: estab.legal_name,
        siret: estab.siret || '',
      }
      logoUrl = estab.logo_url
    }
  }

  let logoBase64: string | undefined
  if (logoUrl) {
    try {
      const logoResponse = await fetch(logoUrl)
      if (logoResponse.ok) {
        const buf = await logoResponse.arrayBuffer()
        const contentType = logoResponse.headers.get('content-type') || 'image/png'
        logoBase64 = `data:${contentType};base64,${Buffer.from(buf).toString('base64')}`
      }
    } catch {
      // Ignore logo fetch failure
    }
  }

  const html = buildAdoptionContractHtml(contract, contract.animals, contract.adopter, companyInfo, logoBase64, animalPhotoBase64)

  const puppeteer = await import('puppeteer')
  const browser = await puppeteer.default.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--user-data-dir=/tmp/chrome-data',
    ],
  })

  const page = await browser.newPage()
  await page.setContent(html, { waitUntil: 'networkidle0' })
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  })
  await browser.close()

  return {
    buffer: Buffer.from(pdfBuffer),
    filename: `contrat_adoption_${contract.contract_number}.pdf`,
    contractNumber: contract.contract_number,
  }
}
