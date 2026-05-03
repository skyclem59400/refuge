import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildAdoptionContractPdf } from '@/lib/pdf/adoption-contract-pdf'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { buffer, filename } = await buildAdoptionContractPdf(id)

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('Adoption contract PDF generation error:', err)
    const msg = err instanceof Error ? err.message : 'Erreur génération contrat adoption'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
