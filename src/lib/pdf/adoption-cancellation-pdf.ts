import { createAdminClient } from '@/lib/supabase/server'
import { buildAdoptionCancellationHtml } from './adoption-cancellation-template'
import { fetchLogoBase64 } from './render'

interface BuildResult {
  buffer: Buffer
  filename: string
  /** Nombre de pages du PDF généré, utile pour positionner les fields Documenso sur la dernière page. */
  pageCount: number
}

interface BuildOptions {
  /** ID auth.users du membre qui crée/envoie le contrat. Si fourni, son nom est
   * affiché dans l'encart "Pour le refuge" à la place du label générique. */
  createdByUserId?: string | null
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function buildAdoptionCancellationPdf(
  contractId: string,
  options: BuildOptions = {}
): Promise<BuildResult> {
  const admin = createAdminClient()

  const { data: c, error } = await admin
    .from('adoption_contracts')
    .select(
      `id, contract_number, establishment_id, adoption_date, adoption_fee,
       non_refundable_amount, returned_at, refunded_amount, refund_payment_method,
       return_reason, trial_period_days, trial_period_ends_at,
       adopter:clients!adopter_client_id(id, name, address, postal_code, city),
       animal:animals!animal_id(id, name, species, breed, breed_cross, identification_number)`
    )
    .eq('id', contractId)
    .single<{
      id: string
      contract_number: string
      establishment_id: string
      adoption_date: string
      adoption_fee: number | null
      non_refundable_amount: number | null
      returned_at: string | null
      refunded_amount: number | null
      refund_payment_method: string | null
      return_reason: string | null
      trial_period_days: number | null
      trial_period_ends_at: string | null
      adopter: { id: string; name: string; address: string | null; postal_code: string | null; city: string | null } | null
      animal: { id: string; name: string; species: string; breed: string | null; breed_cross: string | null; identification_number: string | null } | null
    }>()

  if (error || !c) throw new Error('Contrat introuvable')
  if (!c.returned_at) throw new Error('Pas de retour enregistre pour ce contrat')

  const { data: est } = await admin
    .from('establishments')
    .select('name, legal_name, address, siret, logo_url, default_trial_period_days')
    .eq('id', c.establishment_id)
    .single()

  const trialDays = c.trial_period_days ?? est?.default_trial_period_days ?? 15
  const trialEnds = c.trial_period_ends_at ?? addDays(c.adoption_date, trialDays)

  const adopterAddress = c.adopter
    ? [c.adopter.address, [c.adopter.postal_code, c.adopter.city].filter(Boolean).join(' ')]
        .filter(Boolean)
        .join(', ') || null
    : null

  const logoBase64 = await fetchLogoBase64(est?.logo_url ?? null)

  // Récupérer le nom complet du membre qui envoie l'avenant (pour pré-remplir
  // l'encart "Pour le refuge"). RPC get_users_info renvoie email + full_name.
  let createdByName: string | null = null
  if (options.createdByUserId) {
    try {
      const { data: usersInfo } = await admin.rpc('get_users_info', { user_ids: [options.createdByUserId] })
      const info = (usersInfo as Array<{ id: string; full_name: string | null; email: string }> | null)?.[0]
      createdByName = info?.full_name?.trim() || info?.email || null
    } catch (e) {
      console.warn('[adoption-cancellation-pdf] get_users_info failed:', (e as Error).message)
    }
  }

  const html = buildAdoptionCancellationHtml(
    {
      contract_number: c.contract_number,
      establishment: {
        name: est?.name ?? 'Refuge',
        legal_name: est?.legal_name ?? null,
        address: est?.address ?? null,
        siret: est?.siret ?? null,
      },
      adopter: {
        name: c.adopter?.name ?? 'Adoptant',
        address: adopterAddress,
      },
      animal: {
        name: c.animal?.name ?? '',
        species: c.animal?.species ?? '',
        breed: c.animal?.breed_cross || c.animal?.breed || null,
        identification: c.animal?.identification_number ?? null,
      },
      adoption_date: c.adoption_date,
      return_date: c.returned_at,
      adoption_fee: Number(c.adoption_fee ?? 0),
      non_refundable_amount: Number(c.non_refundable_amount ?? 0),
      refunded_amount: Number(c.refunded_amount ?? 0),
      refund_payment_method: c.refund_payment_method ?? 'autre',
      return_reason: c.return_reason,
      trial_period_ends_at: trialEnds,
    },
    logoBase64,
    createdByName
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

  const page = await browser.newPage()
  await page.setContent(html, { waitUntil: 'networkidle0' })
  // Footer running sur chaque page avec un encart paraphes en bas à droite.
  // Documenso pose ensuite un champ INITIALS (paraphe) pile dans cet encart sur
  // chaque page sauf la dernière qui a la signature finale.
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
    console.warn('[adoption-cancellation-pdf] page count failed:', (e as Error).message)
  }

  const filename = `Avenant_annulation_${c.contract_number}.pdf`
  return { buffer, filename, pageCount }
}
