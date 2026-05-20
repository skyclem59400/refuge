'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { UserProfile, UserProfileInput } from '@/lib/types/database'

// ============================================================
// Onboarding obligatoire — collecte des infos personnelles
// Source de verite : public.user_profiles
// Cache rapide pour le middleware : auth.users.user_metadata.profile_completed
// ============================================================

function normalizePhone(raw: string): string {
  return raw.replace(/\s/g, '').replace(/[^\d+]/g, '')
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

export async function getMyProfile(): Promise<{ data?: UserProfile; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifie' }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error) return { error: error.message }
  return { data: data as UserProfile }
}

export async function completeMyProfile(
  input: UserProfileInput,
): Promise<{ ok?: true; error?: string; emailChanged?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifie' }

  // Validations
  const lastName = input.last_name?.trim()
  const firstName = input.first_name?.trim()
  const personalEmail = input.personal_email?.trim().toLowerCase()
  const phone = normalizePhone(input.phone || '')
  const addressLabel = input.address_label?.trim()
  const postcode = input.address_postcode?.trim()
  const city = input.address_city?.trim()

  if (!lastName || lastName.length < 2) return { error: 'Nom obligatoire' }
  if (!firstName || firstName.length < 2) return { error: 'Prenom obligatoire' }
  if (!personalEmail || !isValidEmail(personalEmail)) return { error: 'Email personnel invalide' }
  if (!phone || phone.length < 8) return { error: 'Numero de telephone invalide' }
  if (!addressLabel || !postcode || !city) {
    return { error: 'Adresse complete obligatoire — selectionne une suggestion dans la liste' }
  }
  if (!input.address_ban_id) {
    return { error: 'Adresse non valide — choisis une adresse dans les suggestions' }
  }

  const admin = createAdminClient()

  // Verifier que l'email perso saisi n'est pas deja utilise par un autre compte
  // (sauf si c'est le meme user qui le saisit a nouveau)
  const { data: emailConflict } = await admin
    .from('user_profiles')
    .select('user_id')
    .ilike('personal_email', personalEmail)
    .neq('user_id', user.id)
    .maybeSingle()

  if (emailConflict) {
    return { error: 'Cet email est deja utilise par un autre compte. Contacte un administrateur.' }
  }

  // Detection : compte pseudo qui n'a pas d'email reel
  const currentAuthEmail = (user.email || '').toLowerCase()
  const isPseudoEmail = currentAuthEmail.includes('+pseudo@') || currentAuthEmail.endsWith('@pseudo.sda-nord.com')
  const emailChanged = isPseudoEmail && currentAuthEmail !== personalEmail

  // 1. Update / insert le profil applicatif
  const { error: upsertErr } = await admin
    .from('user_profiles')
    .upsert(
      {
        user_id: user.id,
        last_name: lastName,
        first_name: firstName,
        personal_email: personalEmail,
        phone,
        birth_date: input.birth_date || null,
        address_label: addressLabel,
        address_postcode: postcode,
        address_city: city,
        address_lat: input.address_lat,
        address_lng: input.address_lng,
        address_ban_id: input.address_ban_id,
        profile_completed: true,
        profile_completed_at: new Date().toISOString(),
        email_migrated: emailChanged,
      },
      { onConflict: 'user_id' },
    )

  if (upsertErr) return { error: upsertErr.message }

  // 2. Mettre a jour user_metadata pour que le middleware le lise sans query DB
  //    et eventuellement l'email auth.users si compte pseudo
  const metadataPayload: Record<string, unknown> = {
    profile_completed: true,
    first_name: firstName,
    last_name: lastName,
  }

  const updatePayload: { email?: string; user_metadata?: typeof metadataPayload; email_confirm?: boolean } = {
    user_metadata: { ...(user.user_metadata || {}), ...metadataPayload },
  }

  if (emailChanged) {
    updatePayload.email = personalEmail
    // Email pas encore confirme — Supabase enverra un mail de confirmation
    updatePayload.email_confirm = false
  }

  const { error: authErr } = await admin.auth.admin.updateUserById(user.id, updatePayload)
  if (authErr) {
    // Le profil applicatif est OK, on signale le warning mais on ne bloque pas
    console.error('user-profile: failed to update auth.users metadata', authErr)
  }

  revalidatePath('/onboarding')
  revalidatePath('/dashboard')

  return { ok: true, emailChanged }
}

export async function getMyProfileStatus(): Promise<{ completed: boolean; firstName?: string; lastName?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { completed: false }

  const meta = (user.user_metadata || {}) as { profile_completed?: boolean; first_name?: string; last_name?: string }
  if (meta.profile_completed === true) {
    return { completed: true, firstName: meta.first_name, lastName: meta.last_name }
  }

  // Fallback table — utile au tout premier passage apres deploiement (metadata pas encore set)
  const { data } = await supabase
    .from('user_profiles')
    .select('profile_completed, first_name, last_name')
    .eq('user_id', user.id)
    .maybeSingle()

  if (data?.profile_completed === true) {
    return { completed: true, firstName: data.first_name || undefined, lastName: data.last_name || undefined }
  }

  return { completed: false }
}
