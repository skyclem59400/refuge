'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { getEstablishmentContext } from '@/lib/establishment/context'
import type {
  PortalProfile,
  PortalProfileWithEmail,
} from '@/lib/types/database'

/**
 * Récupère le profil portail (portal_profiles) + email auth pour un user_id donné.
 * Utilise supabaseAdmin (service_role) car l'accès à auth.users est nécessaire
 * et bloqué par RLS pour les staff sans super-admin.
 *
 * Retourne null si user_id est null ou si le profil n'existe pas.
 * Vérifie côté serveur que l'appelant est bien staff authentifié.
 */
export async function getPortalProfileWithEmail(
  userId: string | null
): Promise<PortalProfileWithEmail | null> {
  if (!userId) return null

  const ctx = await getEstablishmentContext()
  if (!ctx) return null

  const admin = createAdminClient()
  const profileRes = (await admin
    .from('portal_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()) as {
    data: PortalProfile | null
    error: { message: string } | null
  }

  // Email via get_users_info RPC (SECURITY DEFINER, retourne email + full_name)
  let email: string | null = null
  try {
    const { data: usersInfo } = (await admin.rpc('get_users_info', {
      user_ids: [userId],
    })) as {
      data: { id: string; email: string; full_name: string | null }[] | null
    }
    email = usersInfo?.[0]?.email ?? null
  } catch {
    // ignore — fallback à null
  }

  if (!profileRes.data) {
    // Pas de profil mais l'email peut quand même exister (compte créé sans
    // profil rempli). On retourne quand même un objet "minimal" si on a l'email,
    // sinon null.
    if (!email) return null
    return {
      user_id: userId,
      first_name: '',
      last_name: '',
      phone: null,
      address: null,
      postal_code: null,
      city: null,
      consent_marketing: false,
      created_at: '',
      updated_at: '',
      email,
    }
  }

  return { ...profileRes.data, email }
}
