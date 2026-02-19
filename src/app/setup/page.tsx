import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserEstablishments } from '@/lib/establishment/context'
import { WaitingPage } from '@/components/establishment/waiting-page'

export default async function SetupPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { establishments } = await getUserEstablishments()

  if (establishments.length > 0) {
    redirect('/dashboard')
  }

  return <WaitingPage userEmail={user.email || ''} />
}
