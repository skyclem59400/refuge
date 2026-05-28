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
  pageCount: number
}

interface BuildOptions {
  /** ID auth.users du membre qui crée/envoie le contrat. Si fourni, son nom est
   * affiché dans les 2 encarts "Signature du Refuge SDA" (contrat principal +
   * annexe) à la place du label générique. */
  createdByUserId?: string | null
}

export async function buildAdoptionContractPdf(contractId: string, options: BuildOptions = {}): Promise<BuildResult> {
  const admin = createAdminClient()

  const { data: contract, error } = await admin
    .from('adoption_contracts')
    .select(`*,
      animals!inner(
        id, name, name_secondary, species, breed, sex, birth_date,
        chip_number, color, sterilized, tattoo_number, medal_number,
        loof_number, pound_entry_date, description,
        animal_photos(url, is_primary)
      ),
      adopter:clients!adopter_client_id(name, email, phone, address, postal_code, city)`)
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

  // Nom du membre qui envoie le contrat (pour pré-remplir les 2 encarts "Refuge SDA")
  let createdByName: string | null = null
  if (options.createdByUserId) {
    try {
      const { data: usersInfo } = await admin.rpc('get_users_info', { user_ids: [options.createdByUserId] })
      const info = (usersInfo as Array<{ id: string; full_name: string | null; email: string }> | null)?.[0]
      createdByName = info?.full_name?.trim() || info?.email || null
    } catch (e) {
      console.warn('[adoption-contract-pdf] get_users_info failed:', (e as Error).message)
    }
  }

  const html = buildAdoptionContractHtml(contract, contract.animals, contract.adopter, companyInfo, logoBase64, animalPhotoBase64, createdByName)

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
  // Footer running avec encart paraphes en bas à droite (cf. foster-contract-pdf
  // pour le détail du raisonnement). Documenso pose ensuite un champ INITIALS
  // pile dans cet encart sur chaque page sauf la dernière (signature finale).
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '16mm', left: '0' },
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: `
      <div style="width:100%; padding:0 12mm; font-size:8pt; font-family:Helvetica,Arial,sans-serif; color:#6b7f96; display:flex; justify-content:space-between; align-items:center;">
        <span>Page <span class="pageNumber"></span>/<span class="totalPages"></span></span>
        <span style="display:inline-flex; align-items:center; gap:4mm;">
          <span style="font-weight:700; color:#1e3a5f; letter-spacing:0.5pt;">Paraphes</span>
          <span style="display:inline-block; min-width:32mm; height:9mm; border:1px solid #d9e6ed; border-radius:3px;"></span>
        </span>
      </div>
    `,
  })
  await browser.close()

  const buffer = Buffer.from(pdfBuffer)
  let pageCount = 1
  try {
    const { PDFDocument } = await import('pdf-lib')
    const pdfDoc = await PDFDocument.load(buffer)
    pageCount = pdfDoc.getPageCount()
  } catch (e) {
    console.warn('[adoption-contract-pdf] page count failed:', (e as Error).message)
  }

  return {
    buffer,
    filename: `contrat_adoption_${contract.contract_number}.pdf`,
    contractNumber: contract.contract_number,
    pageCount,
  }
}
