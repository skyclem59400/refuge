// Builds the foster contract PDF as a Buffer. Used by:
//   - the API route /api/pdf/foster-contract/[id] (download/preview)
//   - the server action sendContractForSignature (sent to Documenso)

import { createAdminClient } from '@/lib/supabase/server'
import { buildFosterContractHtml } from '@/lib/pdf/foster-contract-template'
import type { CompanyInfo, Establishment } from '@/lib/types/database'

interface BuildResult {
  buffer: Buffer
  filename: string
  contractNumber: string
}

export async function buildFosterContractPdf(contractId: string): Promise<BuildResult> {
  const admin = createAdminClient()

  const { data: contract, error } = await admin
    .from('foster_contracts')
    .select('*, animals!inner(name, species, breed, sex, birth_date, chip_number), foster:clients!foster_client_id(name, email, phone, address, postal_code, city)')
    .eq('id', contractId)
    .single()

  if (error || !contract) {
    throw new Error('Contrat introuvable')
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

  const html = buildFosterContractHtml(contract, contract.animals, contract.foster, companyInfo, logoBase64)

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
    filename: `contrat_fa_${contract.contract_number}.pdf`,
    contractNumber: contract.contract_number,
  }
}
