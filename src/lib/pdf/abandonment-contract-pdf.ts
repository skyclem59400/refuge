import { createAdminClient } from '@/lib/supabase/server'
import { buildAbandonmentContractHtml } from '@/lib/pdf/abandonment-contract-template'
import type { CompanyInfo, Establishment } from '@/lib/types/database'

interface BuildResult {
  buffer: Buffer
  filename: string
  contractNumber: string
  pageCount: number
}

interface BuildOptions {
  /** ID auth.users du membre qui crée/envoie le contrat. Si fourni, son nom est
   * affiché dans l'encart "Signature du Refuge SDA" à la place du label générique. */
  createdByUserId?: string | null
}

export async function buildAbandonmentContractPdf(contractId: string, options: BuildOptions = {}): Promise<BuildResult> {
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

  // Récupérer le nom complet du membre qui envoie le contrat (pour pré-remplir
  // l'encart "Signature du Refuge SDA"). RPC get_users_info renvoie email + full_name
  // depuis auth.users (la table establishment_members ne stocke pas le full_name).
  let createdByName: string | null = null
  if (options.createdByUserId) {
    try {
      const { data: usersInfo } = await admin.rpc('get_users_info', { user_ids: [options.createdByUserId] })
      const info = (usersInfo as Array<{ id: string; full_name: string | null; email: string }> | null)?.[0]
      createdByName = info?.full_name?.trim() || info?.email || null
    } catch (e) {
      console.warn('[abandonment-contract-pdf] get_users_info failed:', (e as Error).message)
    }
  }

  const html = buildAbandonmentContractHtml(
    contract,
    contract.animals,
    contract.cedant,
    companyInfo,
    logoBase64,
    createdByName,
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
    // Footer running sur chaque page avec un encart paraphes en bas à droite.
    // Documenso pose ensuite un champ INITIALS (paraphe) pile dans cet encart sur
    // chaque page (sauf la dernière qui a la signature finale).
    // ⚠️ margin.bottom doit réserver la place pour le footer (sinon il chevauche
    // le contenu). 16mm = environ 5.4% d'une A4 (297mm), donc le footer Puppeteer
    // occupe pageY ~95-100.
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
    const buffer = Buffer.from(pdfBuffer)
    let pageCount = 1
    try {
      const { PDFDocument } = await import('pdf-lib')
      const pdfDoc = await PDFDocument.load(buffer)
      pageCount = pdfDoc.getPageCount()
    } catch (e) {
      console.warn('[abandonment-contract-pdf] page count failed:', (e as Error).message)
    }
    return {
      buffer,
      filename: `contrat_abandon_${contract.contract_number}.pdf`,
      contractNumber: contract.contract_number,
      pageCount,
    }
  } finally {
    await browser.close()
  }
}
