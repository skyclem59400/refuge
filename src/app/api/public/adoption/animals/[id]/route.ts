import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { jsonWithCors, preflightWithCors } from '@/lib/public/cors'

export const dynamic = 'force-dynamic'

export async function OPTIONS(req: NextRequest) {
  return preflightWithCors(req.headers.get('origin'))
}

/**
 * GET /api/public/adoption/animals/[id]
 *
 * Fiche détaillée d'un animal adoptable (uniquement pour les établissements
 * ayant le portail public activé). Retourne photos + description publique.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const origin = req.headers.get('origin')
  const { id } = await ctx.params

  try {
    const admin = createAdminClient()

    const { data, error } = await admin
      .from('animals')
      .select(`
        id, name, species, breed, breed_cross, sex, birth_date, color,
        sterilized, description_external, reserved, status,
        ok_cats, ok_males, ok_females, behavior_score,
        establishment_id,
        establishments!inner(id, name, adoption_appointment_settings),
        animal_photos(url, is_primary)
      `)
      .eq('id', id)
      .eq('adoptable', true)
      .single()

    if (error || !data) {
      return jsonWithCors({ error: 'Animal introuvable' }, origin, { status: 404 })
    }

    type Row = {
      id: string
      name: string
      species: string
      breed: string | null
      breed_cross: string | null
      sex: string
      birth_date: string | null
      color: string | null
      sterilized: boolean
      description_external: string | null
      reserved: boolean
      status: string
      ok_cats: 'yes' | 'no' | 'selective' | null
      ok_males: 'yes' | 'no' | 'selective' | null
      ok_females: 'yes' | 'no' | 'selective' | null
      behavior_score: number | null
      establishment_id: string
      establishments: { id: string; name: string; adoption_appointment_settings: { enabled?: boolean } }
      animal_photos: { url: string; is_primary: boolean }[] | null
    }

    const row = data as unknown as Row

    if (!row.establishments?.adoption_appointment_settings?.enabled) {
      return jsonWithCors({ error: 'Demandes d\'adoption indisponibles pour cet animal' }, origin, { status: 403 })
    }

    const photos = (row.animal_photos ?? []).slice().sort((a, b) => {
      if (a.is_primary && !b.is_primary) return -1
      if (!a.is_primary && b.is_primary) return 1
      return 0
    })

    return jsonWithCors(
      {
        data: {
          id: row.id,
          name: row.name,
          species: row.species,
          breed: row.breed,
          breed_cross: row.breed_cross,
          sex: row.sex,
          birth_date: row.birth_date,
          color: row.color,
          sterilized: row.sterilized,
          description: row.description_external,
          reserved: row.reserved,
          ok_cats: row.ok_cats,
          ok_males: row.ok_males,
          ok_females: row.ok_females,
          behavior_score: row.behavior_score,
          photos: photos.map((p) => p.url),
          establishment: {
            id: row.establishment_id,
            name: row.establishments.name,
          },
        },
      },
      origin,
    )
  } catch (e) {
    return jsonWithCors({ error: (e as Error).message }, origin, { status: 500 })
  }
}
