'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/documents', label: 'Documents', icon: '📄' },
  { href: '/clients', label: 'Clients', icon: '👥' },
]

export function Header({ userEmail }: { userEmail: string }) {
  const [showMenu, setShowMenu] = useState(false)
  const [showMobileNav, setShowMobileNav] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-md border-b border-border">
      <div className="flex items-center justify-between px-6 py-3">
        {/* Mobile nav toggle */}
        <button
          onClick={() => setShowMobileNav(!showMobileNav)}
          className="lg:hidden text-muted hover:text-white p-1"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d={showMobileNav ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
          </svg>
        </button>

        {/* Mobile brand */}
        <div className="lg:hidden flex items-center gap-2">
          <span className="text-xl">🏡</span>
          <span className="font-semibold text-sm gradient-text">Ferme O 4 Vents</span>
        </div>

        {/* Spacer for desktop */}
        <div className="hidden lg:block" />

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-surface-hover transition-colors"
          >
            <div className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-white">
              {userEmail[0].toUpperCase()}
            </div>
            <span className="hidden sm:block text-sm text-muted">{userEmail}</span>
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 w-56 bg-surface border border-border rounded-xl shadow-xl z-50 animate-fade-up">
                <div className="p-3 border-b border-border">
                  <p className="text-sm font-medium truncate">{userEmail}</p>
                </div>
                <div className="p-1">
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2 text-sm text-danger hover:bg-surface-hover rounded-lg transition-colors"
                  >
                    Deconnexion
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mobile navigation */}
      {showMobileNav && (
        <nav className="lg:hidden border-t border-border p-3 space-y-1 animate-fade-up">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setShowMobileNav(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all
                  ${isActive
                    ? 'bg-primary/15 text-primary-light'
                    : 'text-muted hover:text-white hover:bg-surface-hover'
                  }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>
      )}
    </header>
  )
}
