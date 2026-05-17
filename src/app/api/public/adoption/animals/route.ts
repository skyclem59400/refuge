import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { jsonWithCors, preflightWithCors } from '@/lib/public/cors'

export const dynamic = 'force-dynamic'

export async function OPTIONS(req: NextRequest) {
  return preflightWithCors(req.headers.get('origin'))
}

/**
 * GET /api/public/adoption/animals
 *
 * Liste publique des animaux adoptables des établissements ayant activé
 * la prise de RDV publique (adoption_appointment_settings.enabled = true).
 *
 * Filtres optionnels :
 *   ?species=dog|cat|rabbit|...
 *   ?sex=male|female
 */
export async function GET(req: NextRequest) {
  const origin = req.headers.get('origin')
  const url = new URL(req.url)
  const species = url.searchParams.get('species')
  const sex = url.searchParams.get('sex')

  try {
    const admin = createAdminClient()

    // 1. Établissements publics (portail activé)
    const { data: establishments } = await admin
      .from('establishments')
      .select('id')
      .filter('adoption_appointment_settings->>enabled', 'eq', 'true')

    const estIds = (establishments ?? []).map((e: { id: string }) => e.id)
    if (estIds.length === 0) return jsonWithCors({ data: [] }, origin)

    // 2. Animaux adoptables
    let query = admin
      .from('animals')
      .select(`
        id, name, species, breed, sex, birth_date, color, sterilized,
        description_external, reserved, status,
        animal_photos(url, is_primary)
      `)
      .in('establishment_id', estIds)
      .eq('adoptable', true)
      .neq('status', 'adopted')
      .neq('status', 'transferred')
      .neq('status', 'deceased')
      .neq('status', 'returned_to_owner')

    if (species) query = query.eq('species', species)
    if (sex) query = query.eq('sex', sex)

    const { data, error } = await query.order('name')

    if (error) {
      return jsonWithCors({ error: error.message }, origin, { status: 500 })
    }

    // 3. Choisir 1 photo primaire par animal
    type Row = {
      id: string
      name: string
      species: string
      breed: string | null
      sex: string
      birth_date: string | null
      color: string | null
      sterilized: boolean
      description_external: string | null
      reserved: boolean
      status: string
      animal_photos: { url: string; is_primary: boolean }[] | null
    }

    const animals = (data ?? []).map((a) => {
      const row = a as Row
      const photos = row.animal_photos ?? []
      const primary = photos.find((p) => p.is_primary) ?? photos[0]
      return {
        id: row.id,
        name: row.name,
        species: row.species,
        breed: row.breed,
        sex: row.sex,
        birth_date: row.birth_date,
        color: row.color,
        sterilized: row.sterilized,
        description: row.description_external,
        reserved: row.reserved,
        photo_url: primary?.url ?? null,
      }
    })

    return jsonWithCors({ data: animals }, origin)
  } catch (e) {
    return jsonWithCors({ error: (e as Error).message }, origin, { status: 500 })
  }
}
