import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { renderHtmlToImage, fetchLogoBase64 } from '@/lib/pdf/render'
import { buildAnimalNewsMosaicHtml, type MosaicItem } from '@/lib/pdf/animal-news-mosaic-template'
import type { Animal, AnimalNews, Establishment, PermissionGroup } from '@/lib/types/database'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const idsParam = req.nextUrl.searchParams.get('ids')
    if (!idsParam) return NextResponse.json({ error: 'Paramètre ids manquant' }, { status: 400 })

    const ids = idsParam.split(',').map((s) => s.trim()).filter(Boolean)
    if (ids.length < 2 || ids.length > 6) {
      return NextResponse.json({ error: 'Entre 2 et 6 nouvelles requises' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Récupère les nouvelles
    const { data: newsList, error } = await admin
      .from('animal_news')
      .select('*')
      .in('id', ids)

    if (error || !newsList || newsList.length === 0) {
      return NextResponse.json({ error: 'Nouvelles introuvables' }, { status: 404 })
    }

    const typedNews = newsList as AnimalNews[]
    const estabId = typedNews[0].establishment_id

    // Toutes doivent être du même établissement
    if (!typedNews.every((n) => n.establishment_id === estabId)) {
      return NextResponse.json({ error: 'Nouvelles de plusieurs établissements' }, { status: 400 })
    }

    // Auth
    const { data: member } = await admin
      .from('establishment_members')
      .select('id, establishment_id')
      .eq('user_id', user.id)
      .eq('establishment_id', estabId)
      .single()

    if (!member) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

    const { data: memberGroups } = await admin
      .from('member_groups')
      .select('group_id')
      .eq('member_id', (member as { id: string }).id)

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

    // Récup les animaux
    const animalIds = [...new Set(typedNews.map((n) => n.animal_id))]
    const { data: animals } = await admin
      .from('animals')
      .select('id,name,species,sex,status,exit_date')
      .in('id', animalIds)

    const animalMap = new Map<string, Animal>(((animals as Animal[]) || []).map((a) => [a.id, a]))

    // Établissement
    const { data: establishment } = await admin
      .from('establishments')
      .select('*')
      .eq('id', estabId)
      .single()
    const estab = establishment as Establishment | null

    // Conserve l'ordre demandé par le client
    const orderedNews = ids
      .map((id) => typedNews.find((n) => n.id === id))
      .filter((n): n is AnimalNews => !!n)

    // Construit les items avec photo data url
    const items: MosaicItem[] = await Promise.all(
      orderedNews.map(async (n) => {
        const animal = animalMap.get(n.animal_id) as Animal | undefined
        const firstPhotoUrl = (n.photos?.[0]?.url as string | undefined) ?? animal?.photo_url ?? null
        const photoDataUrl = await fetchLogoBase64(firstPhotoUrl)
        return {
          animal: {
            id: animal?.id || n.animal_id,
            name: animal?.name || 'Inconnu',
            species: animal?.species || 'other',
            status: animal?.status || 'adopted',
            exit_date: animal?.exit_date || null,
          },
          photoDataUrl: photoDataUrl ?? null,
        }
      })
    )

    const logoDataUrl = await fetchLogoBase64(estab?.logo_url ?? null)

    const html = buildAnimalNewsMosaicHtml({
      items,
      title: req.nextUrl.searchParams.get('title') || undefined,
      logoDataUrl,
      socialHandle: estab?.website?.replace(/^https?:\/\//, '').replace(/\/$/, '') || undefined,
    })

    const WIDTH = 1080
    const HEIGHT = 1350
    const format = req.nextUrl.searchParams.get('format') ?? 'png'

    if (format === 'html') {
      return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
    }

    if (format === 'pdf') {
      const pdf = await renderHtmlToImage(html, { width: WIDTH, height: HEIGHT, format: 'pdf' })
      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="nouvelles-mosaique.pdf"`,
        },
      })
    }

    const png = await renderHtmlToImage(html, { width: WIDTH, height: HEIGHT, format: 'png' })
    return new NextResponse(new Uint8Array(png), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `inline; filename="nouvelles-mosaique.png"`,
      },
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
