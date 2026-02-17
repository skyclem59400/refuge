import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'

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

  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="lg:ml-60">
        <Header userEmail={user.email || 'Utilisateur'} />
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
