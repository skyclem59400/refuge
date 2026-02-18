'use server'

import { createClient } from '@/lib/supabase/server'

export async function updateProfile(data: {
  full_name?: string
  avatar_url?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifie' }

  const { error } = await supabase.auth.updateUser({
    data: {
      ...user.user_metadata,
      ...data,
    },
  })

  if (error) return { error: error.message }
  return { success: true }
}

export async function updateEmail(newEmail: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifie' }

  if (newEmail === user.email) {
    return { error: 'C\'est deja votre adresse email' }
  }

  const { error } = await supabase.auth.updateUser({ email: newEmail })

  if (error) return { error: error.message }
  return { success: true }
}

export async function updatePassword(currentPassword: string, newPassword: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifie' }

  // Verify current password
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: currentPassword,
  })

  if (authError) return { error: 'Mot de passe actuel incorrect' }

  // Update password
  const { error } = await supabase.auth.updateUser({ password: newPassword })

  if (error) return { error: error.message }
  return { success: true }
}
