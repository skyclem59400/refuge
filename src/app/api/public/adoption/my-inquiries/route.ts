import { NextRequest } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/server'
import { jsonWithCors, preflightWithCors } from '@/lib/public/cors'

export const dynamic = 'force-dynamic'

export async function OPTIONS(req: NextRequest) {
  return preflightWithCors(req.headers.get('origin'))
}

/**
 * GET /api/public/adoption/my-inquiries
 *
 * Authentification : Bearer <Supabase access_token>
 * Retourne toutes les demandes d'adoption + RDV liés à l'email du token.
 *
 * Sécurité : on extrait l'email du JWT (validé par supabase.auth.getUser).
 * Le portail public ne peut donc consulter QUE les demandes de l'email vérifié
 * (magic link Supabase OTP).
 */
export async function GET(req: NextRequest) {
  const origin = req.headers.get('origin')
  const authHeader = req.headers.get('authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonWithCors({ error: 'Authentification requise' }, origin, { status: 401 })
  }
  const token = authHeader.slice(7)

  // Validation du JWT Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    return jsonWithCors({ error: 'Configuration serveur manquante' }, origin, { status: 500 })
  }

  const authClient = createSupabaseClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: userResult, error: userErr } = await authClient.auth.getUser(token)
  if (userErr || !userResult.user?.email) {
    return jsonWithCors({ error: 'Session invalide ou expirée' }, origin, { status: 401 })
  }

  const userEmail = userResult.user.email.toLowerCase()

  // Query via service_role (RLS skip) — sécurité garantie par le filtre email
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('adoption_inquiries')
    .select(`
      id, status, created_at, animal_id,
      first_name, last_name, email, phone,
      animal:animals!animal_id(id, name, species),
      appointment:appointments!appointment_id(date, start_time, end_time, status)
    `)
    .eq('email', userEmail)
    .order('created_at', { ascending: false })

  if (error) return jsonWithCors({ error: error.message }, origin, { status: 500 })

  // Récupère 1 photo primaire par animal pour l'affichage
  const animalIds = Array.from(new Set((data ?? []).map((r) => (r as { animal_id: string }).animal_id)))
  const photoByAnimal: Record<string, string> = {}
  if (animalIds.length > 0) {
    const { data: photos } = await admin
      .from('animal_photos')
      .select('animal_id, url, is_primary')
      .in('animal_id', animalIds)
      .order('is_primary', { ascending: false })
    for (const p of (photos ?? []) as { animal_id: string; url: string; is_primary: boolean }[]) {
      if (!photoByAnimal[p.animal_id]) photoByAnimal[p.animal_id] = p.url
    }
  }

  const enriched = (data ?? []).map((r) => {
    const row = r as unknown as {
      id: string
      status: string
      created_at: string
      animal_id: string
      first_name: string
      last_name: string
      email: string
      phone: string
      animal: { id: string; name: string; species: string } | null
      appointment: { date: string; start_time: string; end_time: string; status: string } | null
    }
    return {
      ...row,
      animal: row.animal ? { ...row.animal, photo_url: photoByAnimal[row.animal.id] ?? null } : null,
    }
  })

  return jsonWithCors({ data: enriched }, origin)
}
