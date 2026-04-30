import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { renderHtmlToPdf, fetchLogoBase64 } from '@/lib/pdf/render'
import { buildBoxSheetHtml } from '@/lib/pdf/box-template'
import type { Box, Establishment } from '@/lib/types/database'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const admin = createAdminClient()
    const { data: box } = await admin.from('boxes').select('*').eq('id', id).single()
    if (!box) return NextResponse.json({ error: 'Box introuvable' }, { status: 404 })

    const { data: establishment } = await admin
      .from('establishments')
      .select('*')
      .eq('id', (box as Box).establishment_id)
      .single()

    if (!establishment) return NextResponse.json({ error: 'Etablissement introuvable' }, { status: 404 })

    const { data: animals } = await admin
      .from('animals')
      .select('id,name,species,breed,breed_cross,sex,birth_date,color,chip_number,sterilized,photo_url,box_id,establishment_id,status,name_secondary,description,description_external,capture_location,capture_circumstances,origin_type,pound_entry_date,shelter_entry_date,exit_date,adoptable,reserved,retirement_basket,ok_cats,ok_males,ok_females,hunimalis_id,last_synced_at,created_at,updated_at,tattoo_number,tattoo_position,medal_number,loof_number,passport_number,identification_date,identifying_veterinarian_id,icad_updated,behavior_score,birth_place,weight')
      .eq('box_id', id)
      .order('name')

    // Get primary photo for each animal
    const animalIds = (animals || []).map((a: { id: string }) => a.id)
    let primaryByAnimal: Record<string, string> = {}
    if (animalIds.length > 0) {
      const { data: photos } = await admin
        .from('animal_photos')
        .select('animal_id,url,is_primary')
        .in('animal_id', animalIds)
        .order('is_primary', { ascending: false })

      for (const p of photos || []) {
        const photo = p as { animal_id: string; url: string; is_primary: boolean }
        if (!primaryByAnimal[photo.animal_id] || photo.is_primary) {
          primaryByAnimal[photo.animal_id] = photo.url
        }
      }
    }

    const enrichedAnimals = (animals || []).map((a: Record<string, unknown>) => ({
      ...a,
      primary_photo: primaryByAnimal[a.id as string] || null,
    }))

    const estab = establishment as Establishment
    const logoBase64 = await fetchLogoBase64(estab.logo_url)

    const html = buildBoxSheetHtml({
      box: box as Box,
      animals: enrichedAnimals as never,
      establishmentName: estab.name,
      establishmentAddress: estab.address || '',
      establishmentPhone: estab.phone || '',
      logoBase64,
      generatedAt: new Date(),
    })

    const pdf = await renderHtmlToPdf(html)
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="fiche_box_${(box as Box).name}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('Box PDF error:', err)
    const msg = err instanceof Error ? err.message : 'Erreur génération PDF'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
