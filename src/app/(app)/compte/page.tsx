import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AccountForm } from '@/components/account/account-form'
import { PasswordForm } from '@/components/account/password-form'
import { PersonalInfoSection } from '@/components/account/personal-info-section'
import { getMyProfile } from '@/lib/actions/user-profile'

export const dynamic = 'force-dynamic'

export default async function ComptePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await getMyProfile()

  return (
    <div className="animate-fade-up space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mon compte</h1>
        <p className="text-sm text-muted mt-1">Gerez votre profil et vos parametres de securite</p>
      </div>

      <PersonalInfoSection profile={profile ?? null} currentAuthEmail={user.email || ''} />

      <AccountForm
        userId={user.id}
        userEmail={user.email || ''}
        fullName={user.user_metadata?.full_name || null}
        avatarUrl={user.user_metadata?.avatar_url || null}
      />

      <PasswordForm />
    </div>
  )
}
