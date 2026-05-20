import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMyProfile } from '@/lib/actions/user-profile'
import { OnboardingForm } from './onboarding-form'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const meta = (user.user_metadata || {}) as { profile_completed?: boolean }
  if (meta.profile_completed === true) {
    redirect('/dashboard')
  }

  const { data: profile } = await getMyProfile()

  // Le compte pseudo a un email technique — on le pre-remplit s'il ressemble a un vrai email
  const currentEmail = user.email || ''
  const isPseudoEmail = currentEmail.includes('+pseudo@') || currentEmail.endsWith('@pseudo.sda-nord.com')
  const defaultEmail = !isPseudoEmail && currentEmail ? currentEmail : (profile?.personal_email || '')

  return (
    <OnboardingForm
      currentAuthEmail={currentEmail}
      isPseudoAccount={isPseudoEmail}
      initialProfile={{
        last_name: profile?.last_name || '',
        first_name: profile?.first_name || '',
        personal_email: profile?.personal_email || defaultEmail,
        phone: profile?.phone || '',
        birth_date: profile?.birth_date || '',
        address_label: profile?.address_label || '',
        address_postcode: profile?.address_postcode || '',
        address_city: profile?.address_city || '',
        address_lat: profile?.address_lat ?? null,
        address_lng: profile?.address_lng ?? null,
        address_ban_id: profile?.address_ban_id || null,
      }}
    />
  )
}
