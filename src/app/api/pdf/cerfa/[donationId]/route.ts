import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateCerfaPdf } from '@/lib/pdf/cerfa-pdf'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ donationId: string }> }
) {
  const { donationId } = await params

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const { buffer, filename } = await generateCerfaPdf(donationId)

    return new NextResponse(new Uint8Array(buffer), {
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
