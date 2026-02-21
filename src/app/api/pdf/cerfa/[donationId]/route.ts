import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildCerfaHtml } from '@/lib/pdf/cerfa-template'
import type { Donation, CompanyInfo, Establishment } from '@/lib/types/database'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ donationId: string }> }
) {
  const { donationId } = await params

  try {
    const supabase = await createClient()

    // Verify user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    // Fetch donation
    const { data: donation, error } = await supabase
      .from('donations')
      .select('*')
      .eq('id', donationId)
      .single()

    if (error || !donation) {
      return NextResponse.json({ error: 'Don non trouve' }, { status: 404 })
    }

    // Fetch the establishment
    let companyInfo: CompanyInfo | undefined
    let logoUrl: string | null = null

    if (donation.establishment_id) {
      const { data: establishment } = await supabase
        .from('establishments')
        .select('*')
        .eq('id', donation.establishment_id)
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
        }
        logoUrl = estab.logo_url
      }
    }

    // Fetch logo as base64 if available
    let logoBase64: string | undefined
    if (logoUrl) {
      try {
        const logoResponse = await fetch(logoUrl)
        if (logoResponse.ok) {
          const buffer = await logoResponse.arrayBuffer()
          const contentType = logoResponse.headers.get('content-type') || 'image/png'
          logoBase64 = `data:${contentType};base64,${Buffer.from(buffer).toString('base64')}`
        }
      } catch {
        // Logo fetch failed, continue without it
      }
    }

    // Generate HTML
    const html = buildCerfaHtml(donation as Donation, companyInfo, logoBase64)

    // Dynamic import of puppeteer
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

    const filename = `cerfa_${donation.cerfa_number || donationId}.pdf`

    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('CERFA PDF generation error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la generation du recu CERFA' },
      { status: 500 }
    )
  }
}
