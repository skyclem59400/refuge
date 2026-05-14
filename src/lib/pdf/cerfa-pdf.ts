import { createAdminClient } from '@/lib/supabase/server'
import { buildCerfaHtml } from '@/lib/pdf/cerfa-template'
import type { CompanyInfo, Donation, Establishment } from '@/lib/types/database'

export interface CerfaPdfResult {
  buffer: Buffer
  filename: string
  donation: Donation
}

/**
 * Génère le PDF du reçu fiscal CERFA pour un don.
 *
 * Réutilisable côté server action (envoi email) ET côté route HTTP (download).
 * Bypasse RLS via createAdminClient — l'autorisation doit être vérifiée
 * en amont par l'appelant (route auth ou requirePermission).
 */
export async function generateCerfaPdf(donationId: string): Promise<CerfaPdfResult> {
  const admin = createAdminClient()

  const { data: donation, error } = await admin
    .from('donations')
    .select('*')
    .eq('id', donationId)
    .single()

  if (error || !donation) {
    throw new Error('Don introuvable.')
  }

  const typedDonation = donation as Donation
  let companyInfo: CompanyInfo | undefined
  let logoBase64: string | undefined

  if (typedDonation.establishment_id) {
    const { data: establishment } = await admin
      .from('establishments')
      .select('*')
      .eq('id', typedDonation.establishment_id)
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
          const logoResponse = await fetch(estab.logo_url)
          if (logoResponse.ok) {
            const buffer = await logoResponse.arrayBuffer()
            const contentType = logoResponse.headers.get('content-type') || 'image/png'
            logoBase64 = `data:${contentType};base64,${Buffer.from(buffer).toString('base64')}`
          }
        } catch {
          // best-effort — le PDF restera sans logo si le fetch échoue
        }
      }
    }
  }

  const html = buildCerfaHtml(typedDonation, companyInfo, logoBase64)

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

    const filename = `cerfa_${typedDonation.cerfa_number || donationId}.pdf`
    return { buffer: Buffer.from(pdfBuffer), filename, donation: typedDonation }
  } finally {
    await browser.close()
  }
}
