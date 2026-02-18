import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildPdfHtml } from '@/lib/pdf/template'
import type { Document, CompanyInfo, Establishment } from '@/lib/types/database'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params

  try {
    const supabase = await createClient()

    // Verify user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    // Fetch document
    const { data: document, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single()

    if (error || !document) {
      return NextResponse.json({ error: 'Document non trouve' }, { status: 404 })
    }

    // Fetch the establishment linked to this document
    let companyInfo: CompanyInfo | undefined
    let logoUrl: string | null = null

    if (document.establishment_id) {
      const { data: establishment } = await supabase
        .from('establishments')
        .select('*')
        .eq('id', document.establishment_id)
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
    const html = buildPdfHtml(document as Document, companyInfo, logoBase64)

    // Dynamic import of puppeteer (only loaded when needed)
    const puppeteer = await import('puppeteer')
    const browser = await puppeteer.default.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
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

    const filename = `${document.type}_${document.numero}.pdf`

    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('PDF generation error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la generation du PDF' },
      { status: 500 }
    )
  }
}
