import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { renderHtmlToPdf, fetchLogoBase64 } from '@/lib/pdf/render'
import { buildAnimalPosterHtml } from '@/lib/pdf/animal-poster-template'
import type { Animal, Establishment } from '@/lib/types/database'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const admin = createAdminClient()

    // Récupère l'animal et vérifie l'appartenance à un établissement du user
    const { data: animal, error: aErr } = await admin
      .from('animals')
      .select('*')
      .eq('id', id)
      .single()
    if (aErr || !animal) return NextResponse.json({ error: 'Animal introuvable' }, { status: 404 })

    const { data: members } = await admin
      .from('establishment_members')
      .select('establishment_id')
      .eq('user_id', user.id)
    const userEstabIds = (members ?? []).map((m: { establishment_id: string }) => m.establishment_id)
    if (!userEstabIds.includes((animal as Animal).establishment_id)) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    const { data: establishment } = await admin
      .from('establishments')
      .select('*')
      .eq('id', (animal as Animal).establishment_id)
      .single()

    // Photo primaire (table animal_photos puis fallback animal.photo_url)
    const { data: photos } = await admin
      .from('animal_photos')
      .select('url, is_primary')
      .eq('animal_id', id)
      .order('is_primary', { ascending: false })
      .limit(1)

    const a = animal as Animal
    const photoUrl = (photos?.[0] as { url: string } | undefined)?.url ?? a.photo_url
    const photoDataUrl = await fetchLogoBase64(photoUrl ?? null)
    const logoDataUrl = await fetchLogoBase64((establishment as Establishment | null)?.logo_url ?? null)

    const html = buildAnimalPosterHtml({
      animal: a,
      photoDataUrl: photoDataUrl ?? null,
      logoDataUrl,
      establishmentPhone: '03 27 83 32 70',
      establishmentName: 'Société de Défense des Animaux du Nord',
    })

    // Mode preview HTML (utile pour itérer le design sans regénérer le PDF)
    if (req.nextUrl.searchParams.get('format') === 'html') {
      return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    const pdf = await renderHtmlToPdf(html)
    const filename = `affiche-${(a.name ?? 'animal').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
      },
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
