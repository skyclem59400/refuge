import { createAdminClient } from '@/lib/supabase/server'
import { buildAbandonmentContractHtml } from '@/lib/pdf/abandonment-contract-template'
import type { CompanyInfo, Establishment } from '@/lib/types/database'

interface BuildResult {
  buffer: Buffer
  filename: string
  contractNumber: string
}

export async function buildAbandonmentContractPdf(contractId: string): Promise<BuildResult> {
  const admin = createAdminClient()

  const { data: contract, error } = await admin
    .from('abandonment_contracts')
    .select(`*,
      animals!inner(
        name, species, breed, color, sex, sterilized, birth_date,
        chip_number, loof_number, tattoo_number, medal_number, description
      ),
      cedant:clients!cedant_client_id(
        kind, name, first_name, email, phone, address, postal_code, city
      )`)
    .eq('id', contractId)
    .single()

  if (error || !contract) {
    throw new Error('Contrat d\'abandon introuvable.')
  }

  // Récup établissement pour l'en-tête
  let companyInfo: CompanyInfo | undefined
  let logoBase64: string | undefined
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
      if (estab.logo_url) {
        try {
          const r = await fetch(estab.logo_url)
          if (r.ok) {
            const buf = await r.arrayBuffer()
            const ct = r.headers.get('content-type') || 'image/png'
            logoBase64 = `data:${ct};base64,${Buffer.from(buf).toString('base64')}`
          }
        } catch {
          // ignore — fallback rendering sans logo
        }
      }
    }
  }

  const html = buildAbandonmentContractHtml(
    contract,
    contract.animals,
    contract.cedant,
    companyInfo,
    logoBase64,
  )

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

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    })
    return {
      buffer: Buffer.from(pdfBuffer),
      filename: `contrat_abandon_${contract.contract_number}.pdf`,
      contractNumber: contract.contract_number,
    }
  } finally {
    await browser.close()
  }
}
