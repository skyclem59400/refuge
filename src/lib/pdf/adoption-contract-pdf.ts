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
  /** Présent uniquement si options.splitForSignature = true.
   * Nombre de pages du contrat principal (= 1ère partie du PDF mergé).
   * La 1ère SIGNATURE doit être placée sur cette page, la 2e sur `pageCount`. */
  mainPageCount?: number
}

interface BuildOptions {
  /** ID auth.users du membre qui crée/envoie le contrat. Si fourni, son nom est
   * affiché dans les 2 encarts "Signature du Refuge SDA" (contrat principal +
   * annexe) à la place du label générique. */
  createdByUserId?: string | null
  /** Si true, génère 2 PDFs séparés (contrat principal seul + annexe seule)
   * puis les merge via pdf-lib. Permet de connaître précisément à quelle
   * page tombe la signature du contrat principal (= mainPageCount), pour
   * placer 2 champs SIGNATURE Documenso aux 2 bons endroits.
   * Pour le download direct (route API), garder false (1 seul PDF). */
  splitForSignature?: boolean
}

/** Helper interne : génère un PDF depuis un HTML via Puppeteer, avec le footer
 * running paraphes activé. Réutilisé pour le mode normal ET pour les 2 PDFs
 * du mode split. */
async function htmlToPdfBuffer(html: string): Promise<Buffer> {
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
    return Buffer.from(pdfBuffer)
  } finally {
    await browser.close()
  }
}

async function countPages(buffer: Buffer): Promise<number> {
  try {
    const { PDFDocument } = await import('pdf-lib')
    const pdfDoc = await PDFDocument.load(buffer)
    return pdfDoc.getPageCount()
  } catch (e) {
    console.warn('[adoption-contract-pdf] page count failed:', (e as Error).message)
    return 1
  }
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

  const filename = `contrat_adoption_${contract.contract_number}.pdf`

  // ----- Mode normal (1 seul PDF avec main + annex enchaînés) -----
  if (!options.splitForSignature) {
    const html = buildAdoptionContractHtml(contract, contract.animals, contract.adopter, companyInfo, logoBase64, animalPhotoBase64, createdByName, 'full')
    const buffer = await htmlToPdfBuffer(html)
    const pageCount = await countPages(buffer)
    return { buffer, filename, contractNumber: contract.contract_number, pageCount }
  }

  // ----- Mode split (2 PDFs séparés mergés) -----
  // On génère le contrat principal SEUL puis l'annexe SEULE, on les merge via
  // pdf-lib. Permet de connaître précisément à quelle page tombe chaque
  // signature : SIGNATURE 1 sur mainPageCount (= dernière page du contrat
  // principal), SIGNATURE 2 sur pageCount (= dernière page du PDF total).
  const htmlMain = buildAdoptionContractHtml(contract, contract.animals, contract.adopter, companyInfo, logoBase64, animalPhotoBase64, createdByName, 'main')
  const htmlAnnex = buildAdoptionContractHtml(contract, contract.animals, contract.adopter, companyInfo, logoBase64, animalPhotoBase64, createdByName, 'annex')

  const [bufMain, bufAnnex] = await Promise.all([
    htmlToPdfBuffer(htmlMain),
    htmlToPdfBuffer(htmlAnnex),
  ])
  const mainPageCount = await countPages(bufMain)
  const annexPageCount = await countPages(bufAnnex)

  // Merge via pdf-lib
  const { PDFDocument } = await import('pdf-lib')
  const merged = await PDFDocument.create()
  const docMain = await PDFDocument.load(bufMain)
  const docAnnex = await PDFDocument.load(bufAnnex)

  const mainPages = await merged.copyPages(docMain, docMain.getPageIndices())
  for (const p of mainPages) merged.addPage(p)
  const annexPages = await merged.copyPages(docAnnex, docAnnex.getPageIndices())
  for (const p of annexPages) merged.addPage(p)

  const mergedBytes = await merged.save()
  const buffer = Buffer.from(mergedBytes)

  return {
    buffer,
    filename,
    contractNumber: contract.contract_number,
    pageCount: mainPageCount + annexPageCount,
    mainPageCount,
  }
}
