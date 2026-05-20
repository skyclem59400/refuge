import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/establishment/permissions'
import { buildMonthlyCraPdf } from '@/lib/pdf/cra-pdf'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string; year: string; month: string }> }
) {
  const { memberId, year, month } = await params
  const y = parseInt(year, 10)
  const m = parseInt(month, 10)

  if (!Number.isFinite(y) || y < 2000 || y > 2100) {
    return NextResponse.json({ error: 'Annee invalide' }, { status: 400 })
  }
  if (!Number.isFinite(m) || m < 1 || m > 12) {
    return NextResponse.json({ error: 'Mois invalide' }, { status: 400 })
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorise' }, { status: 401 })

    await requirePermission('manage_leaves')

    const { buffer, filename } = await buildMonthlyCraPdf(memberId, y, m)

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('CRA PDF generation error:', err)
    const msg = err instanceof Error ? err.message : 'Erreur generation CRA'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
