import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { renderHtmlToPdf, fetchLogoBase64 } from '@/lib/pdf/render'
import { buildZoneSheetHtml } from '@/lib/pdf/zone-template'
import type { Box, Establishment } from '@/lib/types/database'

interface ZoneRow { id: string; name: string; parent_id: string | null; description: string | null; establishment_id?: string }
interface BoxRow extends Box { sort_order?: number; zone_id: string | null }

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const admin = createAdminClient()

    // 1. Zone racine
    const { data: rootZone } = await admin
      .from('box_zones')
      .select('id, name, parent_id, description, establishment_id')
      .eq('id', id)
      .single()
    if (!rootZone) return NextResponse.json({ error: 'Zone introuvable' }, { status: 404 })
    const root = rootZone as unknown as ZoneRow & { establishment_id: string }
    if (root.parent_id) {
      return NextResponse.json({ error: 'La fiche est générée depuis la zone racine.' }, { status: 400 })
    }

    // 2. Etablissement
    const { data: establishment } = await admin
      .from('establishments')
      .select('*')
      .eq('id', root.establishment_id)
      .single()
    if (!establishment) return NextResponse.json({ error: 'Établissement introuvable' }, { status: 404 })
    const estab = establishment as Establishment

    // 3. Sous-zones (par sort_order, name)
    const { data: subzonesRaw } = await admin
      .from('box_zones')
      .select('id, name, parent_id, description, sort_order')
      .eq('parent_id', root.id)
      .order('sort_order')
      .order('name')
    const subzones = (subzonesRaw ?? []) as unknown as ZoneRow[]

    // 4. Tous les box du chenil (root + sous-zones)
    const allZoneIds = [root.id, ...subzones.map((s) => s.id)]
    const { data: boxesRaw } = await admin
      .from('boxes')
      .select('*')
      .in('zone_id', allZoneIds)
      .eq('establishment_id', estab.id)
      .order('sort_order')
      .order('name')
    const boxes = (boxesRaw ?? []) as unknown as BoxRow[]

    // 5. Animaux dans ces box (statuts présents)
    const boxIds = boxes.map((b) => b.id)
    let animals: { id: string; name: string; species: string; breed: string | null; breed_cross: string | null; sex: string | null; birth_date: string | null; color: string | null; chip_number: string | null; sterilized: boolean | null; photo_url: string | null; status: string | null; adoptable: boolean | null; reserved: boolean | null; box_id: string }[] = []
    if (boxIds.length > 0) {
      const { data: animalsRaw } = await admin
        .from('animals')
        .select('id, name, species, breed, breed_cross, sex, birth_date, color, chip_number, sterilized, photo_url, status, adoptable, reserved, box_id')
        .in('box_id', boxIds)
        .eq('establishment_id', estab.id)
        .order('name')
      animals = (animalsRaw ?? []) as typeof animals
    }

    // 6. Photos primary depuis animal_photos
    const animalIds = animals.map((a) => a.id)
    const primaryByAnimal: Record<string, string> = {}
    if (animalIds.length > 0) {
      const { data: photos } = await admin
        .from('animal_photos')
        .select('animal_id, url, is_primary')
        .in('animal_id', animalIds)
        .order('is_primary', { ascending: false })
      for (const p of photos || []) {
        const photo = p as { animal_id: string; url: string; is_primary: boolean }
        if (!primaryByAnimal[photo.animal_id] || photo.is_primary) {
          primaryByAnimal[photo.animal_id] = photo.url
        }
      }
    }

    // 7. Regroupement par sous-zone (puis "Direct" pour ceux liés à la zone racine)
    const animalsByBox: Record<string, typeof animals> = {}
    for (const a of animals) {
      if (!animalsByBox[a.box_id]) animalsByBox[a.box_id] = []
      animalsByBox[a.box_id].push(a)
    }

    function enrichBox(b: BoxRow) {
      const a = (animalsByBox[b.id] ?? []).map((x) => ({
        ...x,
        primary_photo: primaryByAnimal[x.id] ?? null,
      }))
      return { ...b, animals: a }
    }

    const directBoxes = boxes.filter((b) => b.zone_id === root.id).map(enrichBox)
    const subzoneGroups: { label: string; boxes: ReturnType<typeof enrichBox>[] }[] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const groupsForTemplate: any = subzoneGroups

    if (directBoxes.length > 0) {
      subzoneGroups.push({ label: 'Sans sous-zone', boxes: directBoxes })
    }
    for (const s of subzones) {
      const subBoxes = boxes.filter((b) => b.zone_id === s.id).map(enrichBox)
      if (subBoxes.length > 0) {
        subzoneGroups.push({ label: s.name, boxes: subBoxes })
      }
    }

    const totalBoxes = boxes.length
    const totalAnimals = animals.length
    const totalCapacity = boxes.reduce((acc, b) => acc + b.capacity, 0)

    const logoBase64 = await fetchLogoBase64(estab.logo_url)

    const html = buildZoneSheetHtml({
      zoneName: root.name,
      zoneDescription: root.description,
      subzoneGroups: groupsForTemplate,
      totalBoxes,
      totalAnimals,
      totalCapacity,
      establishmentName: estab.name,
      establishmentAddress: estab.address || '',
      establishmentPhone: estab.phone || '',
      logoBase64,
      generatedAt: new Date(),
    })

    const pdf = await renderHtmlToPdf(html, { landscape: true })
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="fiche_chenil_${root.name}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('Zone PDF error:', err)
    const msg = err instanceof Error ? err.message : 'Erreur génération PDF'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
