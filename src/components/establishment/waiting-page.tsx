'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from '@/components/theme-provider'

interface WaitingPageProps {
  userEmail: string
}

export function WaitingPage({ userEmail }: WaitingPageProps) {
  const router = useRouter()
  const supabase = createClient()
  const { theme, toggleTheme } = useTheme()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface-dark">
      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="fixed top-4 right-4 p-2 rounded-lg bg-surface border border-border text-muted hover:text-text transition-colors z-50"
        title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
      >
        {theme === 'dark' ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        )}
      </button>

      <div className="w-full max-w-md animate-fade-up">
        <div className="bg-surface rounded-2xl p-8 glow border border-border text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Logo" className="w-16 h-16 rounded-full mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-primary-light">En attente de validation</h1>

          <p className="text-muted text-sm mt-4 leading-relaxed">
            Votre compte <span className="font-medium text-text">{userEmail}</span> a bien ete cree.
          </p>
          <p className="text-muted text-sm mt-2 leading-relaxed">
            Un administrateur doit vous ajouter a un etablissement avant que vous puissiez acceder a l&apos;application.
          </p>

          <div className="my-6">
            <svg className="w-12 h-12 mx-auto text-primary/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <button
            onClick={handleLogout}
            className="px-6 py-2.5 rounded-lg text-sm font-medium
              text-muted hover:text-text bg-surface-dark border border-border
              hover:border-border transition-colors"
          >
            Se deconnecter
          </button>
        </div>
      </div>
    </div>
  )
}
