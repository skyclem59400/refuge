import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { renderHtmlToPdf, fetchLogoBase64 } from '@/lib/pdf/render'
import { buildJudicialDossierHtml } from '@/lib/pdf/judicial-dossier-template'
import type { Animal, AnimalHealthRecord, Establishment } from '@/lib/types/database'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ animalId: string }> }) {
  const { animalId } = await params

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const admin = createAdminClient()
    const [{ data: animal }, { data: healthRecords }] = await Promise.all([
      admin.from('animals').select('*').eq('id', animalId).single(),
      admin.from('animal_health_records').select('*').eq('animal_id', animalId).order('date'),
    ])

    if (!animal) return NextResponse.json({ error: 'Animal introuvable' }, { status: 404 })

    const animalRow = animal as Animal
    const { data: establishment } = await admin
      .from('establishments')
      .select('*')
      .eq('id', animalRow.establishment_id)
      .single()

    if (!establishment) return NextResponse.json({ error: 'Etablissement introuvable' }, { status: 404 })

    const estab = establishment as Establishment
    const logoBase64 = await fetchLogoBase64(estab.logo_url)

    const html = buildJudicialDossierHtml({
      animal: animalRow,
      establishment: estab,
      healthRecords: (healthRecords as AnimalHealthRecord[]) || [],
      logoBase64,
      generatedAt: new Date(),
    })

    const pdf = await renderHtmlToPdf(html)
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="dossier_procedure_${animalRow.name}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('Judicial PDF error:', err)
    const msg = err instanceof Error ? err.message : 'Erreur génération PDF'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
