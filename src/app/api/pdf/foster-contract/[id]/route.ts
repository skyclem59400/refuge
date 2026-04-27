import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildFosterContractHtml } from '@/lib/pdf/foster-contract-template'
import type { CompanyInfo, Establishment } from '@/lib/types/database'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const { data: contract, error } = await supabase
      .from('foster_contracts')
      .select('*, animals!inner(name, species, breed, sex, birth_date, chip_number), foster:clients!foster_client_id(name, email, phone, address, postal_code, city)')
      .eq('id', id)
      .single()

    if (error || !contract) {
      return NextResponse.json({ error: 'Contrat introuvable' }, { status: 404 })
    }

    // Fetch establishment
    let companyInfo: CompanyInfo | undefined
    let logoUrl: string | null = null

    if (contract.establishment_id) {
      const { data: establishment } = await supabase
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
          const buffer = await logoResponse.arrayBuffer()
          const contentType = logoResponse.headers.get('content-type') || 'image/png'
          logoBase64 = `data:${contentType};base64,${Buffer.from(buffer).toString('base64')}`
        }
      } catch {
        // Logo fetch failed, continue without it
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

    const filename = `contrat_fa_${contract.contract_number}.pdf`

    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('Foster contract PDF generation error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la generation du contrat FA' },
      { status: 500 }
    )
  }
}
