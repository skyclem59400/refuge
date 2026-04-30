import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { renderHtmlToPdf, fetchLogoBase64 } from '@/lib/pdf/render'
import { buildBoxListHtml } from '@/lib/pdf/box-template'
import type { Box } from '@/lib/types/database'

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const ctx = await getEstablishmentContext()
    if (!ctx) return NextResponse.json({ error: 'Etablissement non sélectionné' }, { status: 400 })

    const admin = createAdminClient()
    const { data: boxes } = await admin
      .from('boxes')
      .select('*')
      .eq('establishment_id', ctx.establishment.id)
      .order('name')

    const { data: animals } = await admin
      .from('animals')
      .select('id,name,species,box_id')
      .eq('establishment_id', ctx.establishment.id)
      .not('box_id', 'is', null)

    const grouped: Record<string, { id: string; name: string; species: string }[]> = {}
    for (const a of animals || []) {
      const animal = a as { id: string; name: string; species: string; box_id: string }
      if (!grouped[animal.box_id]) grouped[animal.box_id] = []
      grouped[animal.box_id].push({ id: animal.id, name: animal.name, species: animal.species })
    }

    const enrichedBoxes = (boxes || []).map((b) => {
      const box = b as Box
      const list = grouped[box.id] || []
      return { ...box, animal_count: list.length, animals: list }
    })

    const logoBase64 = await fetchLogoBase64(ctx.establishment.logo_url)
    const html = buildBoxListHtml({
      boxes: enrichedBoxes,
      establishmentName: ctx.establishment.name,
      establishmentAddress: ctx.establishment.address || '',
      establishmentPhone: ctx.establishment.phone || '',
      logoBase64,
      generatedAt: new Date(),
    })

    const pdf = await renderHtmlToPdf(html)
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="liste_box.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('Box list PDF error:', err)
    const msg = err instanceof Error ? err.message : 'Erreur génération PDF'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
