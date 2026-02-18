'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

const COOKIE_NAME = 'current-establishment-id'

export async function switchEstablishment(establishmentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifie' }

  // Verify membership
  const { data: membership } = await supabase
    .from('establishment_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('establishment_id', establishmentId)
    .single()

  if (!membership) return { error: 'Acces refuse a cet etablissement' }

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, establishmentId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })

  return { success: true }
}
