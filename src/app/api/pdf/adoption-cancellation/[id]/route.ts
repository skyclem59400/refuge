import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/establishment/permissions'
import { buildAdoptionCancellationPdf } from '@/lib/pdf/adoption-cancellation-pdf'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorise' }, { status: 401 })

    await requirePermission('manage_animals')

    const { buffer, filename } = await buildAdoptionCancellationPdf(id)

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('Adoption cancellation PDF error:', err)
    const msg = err instanceof Error ? err.message : 'Erreur generation PDF'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
