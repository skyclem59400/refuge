import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { renderHtmlToImage, fetchLogoBase64 } from '@/lib/pdf/render'
import { buildAnimalNewsSoloHtml } from '@/lib/pdf/animal-news-solo-template'
import type { Animal, AnimalNews, Establishment, PermissionGroup } from '@/lib/types/database'

export async function GET(req: NextRequest, { params }: { params: Promise<{ newsId: string }> }) {
  const { newsId } = await params

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const admin = createAdminClient()

    const { data: news, error } = await admin
      .from('animal_news')
      .select('*')
      .eq('id', newsId)
      .single()

    if (error || !news) return NextResponse.json({ error: 'Nouvelle introuvable' }, { status: 404 })

    const typed = news as AnimalNews

    // Auth : l'user doit être membre de l'établissement et avoir la perm view_animal_news
    const { data: members } = await admin
      .from('establishment_members')
      .select('id, establishment_id')
      .eq('user_id', user.id)
      .eq('establishment_id', typed.establishment_id)
      .single()

    if (!members) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

    const { data: memberGroups } = await admin
      .from('member_groups')
      .select('group_id')
      .eq('member_id', (members as { id: string }).id)

    const groupIds = (memberGroups || []).map((mg: { group_id: string }) => mg.group_id)
    let hasPermission = false
    if (groupIds.length > 0) {
      const { data: groups } = await admin
        .from('permission_groups')
        .select('*')
        .in('id', groupIds)
      hasPermission = (groups as PermissionGroup[] || []).some((g) => g.view_animal_news === true)
    }
    if (!hasPermission) return NextResponse.json({ error: 'Permissions insuffisantes' }, { status: 403 })

    // Récup l'animal
    const { data: animal } = await admin
      .from('animals')
      .select('id,name,species,sex,status,exit_date')
      .eq('id', typed.animal_id)
      .single()
    if (!animal) return NextResponse.json({ error: 'Animal introuvable' }, { status: 404 })

    // Récup l'établissement (logo)
    const { data: establishment } = await admin
      .from('establishments')
      .select('*')
      .eq('id', typed.establishment_id)
      .single()

    const estab = establishment as Establishment | null

    // Photo principale = première photo de la news
    const firstPhotoUrl = (typed.photos?.[0]?.url as string | undefined) ?? null
    const photoDataUrl = await fetchLogoBase64(firstPhotoUrl)
    const logoDataUrl = await fetchLogoBase64(estab?.logo_url ?? null)

    const html = buildAnimalNewsSoloHtml({
      animal: animal as Animal,
      news: { text: typed.text, received_at: typed.received_at, received_from: typed.received_from },
      photoDataUrl: photoDataUrl ?? null,
      logoDataUrl,
      socialHandle: estab?.website?.replace(/^https?:\/\//, '').replace(/\/$/, '') || undefined,
    })

    const WIDTH = 1080
    const HEIGHT = 1350

    const format = req.nextUrl.searchParams.get('format') ?? 'png'

    if (format === 'html') {
      return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
    }

    const slug = (animal as Animal).name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'animal'

    if (format === 'pdf') {
      const pdf = await renderHtmlToImage(html, { width: WIDTH, height: HEIGHT, format: 'pdf' })
      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="nouvelles-${slug}.pdf"`,
        },
      })
    }

    const png = await renderHtmlToImage(html, { width: WIDTH, height: HEIGHT, format: 'png' })
    return new NextResponse(new Uint8Array(png), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `inline; filename="nouvelles-${slug}.png"`,
      },
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
