import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { renderHtmlToImage, fetchLogoBase64 } from '@/lib/pdf/render'
import { buildAnimalPosterHtml } from '@/lib/pdf/animal-poster-template'
import type { Animal, Establishment } from '@/lib/types/database'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const admin = createAdminClient()

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

    // Téléphone : on lit depuis l'établissement. Fallback sur l'email si vide.
    const estab = establishment as Establishment | null
    const phoneFromDb = estab?.phone?.trim() ?? ''
    const emailFromDb = estab?.email?.trim() ?? ''
    const contactValue = phoneFromDb || emailFromDb || ''

    const html = buildAnimalPosterHtml({
      animal: a,
      photoDataUrl: photoDataUrl ?? null,
      logoDataUrl,
      establishmentPhone: contactValue,
      establishmentContactIsEmail: !phoneFromDb && !!emailFromDb,
    })

    // Format ratio 4:5 — optimal Facebook fil + Instagram fil
    const WIDTH = 1080
    const HEIGHT = 1350

    const format = req.nextUrl.searchParams.get('format') ?? 'png'

    if (format === 'html') {
      return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
    }

    const slug = (a.name ?? 'animal').toLowerCase().replace(/[^a-z0-9]+/g, '-')

    if (format === 'pdf') {
      const pdf = await renderHtmlToImage(html, { width: WIDTH, height: HEIGHT, format: 'pdf' })
      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="visuel-${slug}.pdf"`,
        },
      })
    }

    // Défaut : PNG (le plus pratique pour upload réseaux sociaux)
    const png = await renderHtmlToImage(html, { width: WIDTH, height: HEIGHT, format: 'png' })
    return new NextResponse(new Uint8Array(png), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `inline; filename="visuel-${slug}.png"`,
      },
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
