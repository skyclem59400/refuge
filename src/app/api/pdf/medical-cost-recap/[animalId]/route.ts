import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/establishment/permissions'
import { buildMedicalCostRecapPdf } from '@/lib/pdf/medical-cost-recap-pdf'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ animalId: string }> }
) {
  const { animalId } = await params

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorise' }, { status: 401 })

    await requirePermission('manage_health')

    const { buffer, filename } = await buildMedicalCostRecapPdf(animalId)

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('Medical cost recap PDF error:', err)
    const msg = err instanceof Error ? err.message : 'Erreur generation PDF'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
