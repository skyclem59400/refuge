// Builds the engagement certificate PDF as a Buffer.
// Used by:
//   - the API route /api/pdf/engagement-certificate/[id] (download / preview)
//   - the server action createAndSendEngagementCertificate (sent to Documenso)

import { createAdminClient } from '@/lib/supabase/server'
import { buildEngagementCertificateHtml } from '@/lib/pdf/engagement-certificate-template'
import type { CompanyInfo, Establishment } from '@/lib/types/database'

interface BuildResult {
  buffer: Buffer
  filename: string
  certificateNumber: string
  /** Nombre de pages du PDF généré, pour positionner les fields Documenso. */
  pageCount: number
}

export async function buildEngagementCertificatePdf(certificateId: string): Promise<BuildResult> {
  const admin = createAdminClient()

  const { data: certificate, error } = await admin
    .from('engagement_certificates')
    .select(`*,
      animal:animals!animal_id(
        id, name, species, breed, sex, birth_date, chip_number, color
      ),
      adopter:clients!adopter_client_id(kind, name, first_name, email, phone, address, postal_code, city)`)
    .eq('id', certificateId)
    .single()

  if (error || !certificate) {
    throw new Error('Certificat introuvable')
  }

  let companyInfo: CompanyInfo | undefined
  let logoUrl: string | null = null

  if (certificate.establishment_id) {
    const { data: establishment } = await admin
      .from('establishments')
      .select('*')
      .eq('id', certificate.establishment_id)
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
      const r = await fetch(logoUrl)
      if (r.ok) {
        const buf = await r.arrayBuffer()
        const ct = r.headers.get('content-type') || 'image/png'
        logoBase64 = `data:${ct};base64,${Buffer.from(buf).toString('base64')}`
      }
    } catch {
      // Ignore logo fetch failure
    }
  }

  const html = buildEngagementCertificateHtml(certificate, certificate.animal, certificate.adopter, companyInfo, logoBase64)

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

  const buffer = Buffer.from(pdfBuffer)
  let pageCount = 1
  try {
    const { PDFDocument } = await import('pdf-lib')
    const pdfDoc = await PDFDocument.load(buffer)
    pageCount = pdfDoc.getPageCount()
  } catch (e) {
    console.warn('[engagement-certificate-pdf] page count failed:', (e as Error).message)
  }

  return {
    buffer,
    filename: `certificat_engagement_${certificate.certificate_number}.pdf`,
    certificateNumber: certificate.certificate_number,
    pageCount,
  }
}
