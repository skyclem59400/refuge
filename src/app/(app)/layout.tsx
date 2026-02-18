import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstablishmentContext, getUserEstablishments } from '@/lib/establishment/context'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { MainContent } from '@/components/layout/main-content'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { establishments } = await getUserEstablishments()

  if (establishments.length === 0) {
    redirect('/setup')
  }

  const ctx = await getEstablishmentContext()

  if (!ctx) {
    redirect('/setup')
  }

  return (
    <div className="min-h-screen">
      <Sidebar
        establishments={establishments}
        currentEstablishment={ctx.establishment}
        permissions={ctx.permissions}
      />
      <MainContent>
        <Header
          userEmail={user.email || 'Utilisateur'}
          userAvatarUrl={user.user_metadata?.avatar_url}
          permissions={ctx.permissions}
          currentEstablishment={ctx.establishment}
        />
        <main className="p-6">
          {children}
        </main>
      </MainContent>
    </div>
  )
}
