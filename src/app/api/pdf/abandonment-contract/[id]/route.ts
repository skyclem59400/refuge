import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { buildAbandonmentContractPdf } from '@/lib/pdf/abandonment-contract-pdf'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Si le contrat a déjà un PDF signé Documenso, on le sert.
    // Sinon on génère un PDF non signé (preview / avant signature).
    const admin = createAdminClient()
    const { data: contract } = await admin
      .from('abandonment_contracts')
      .select('signed_pdf_url')
      .eq('id', id)
      .maybeSingle()

    if (contract?.signed_pdf_url) {
      return NextResponse.redirect(contract.signed_pdf_url, 302)
    }

    const { buffer, filename } = await buildAbandonmentContractPdf(id)

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[abandonment-contract] PDF generation error:', err)
    const msg = err instanceof Error ? err.message : 'Erreur génération contrat d\'abandon'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
