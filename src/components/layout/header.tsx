'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from '@/components/theme-provider'
import { NotificationBell } from '@/components/notifications/notification-bell'
import { EstablishmentSwitcher } from '@/components/establishment/establishment-switcher'
import { getNavSections } from './nav-config'
import type { Establishment, EstablishmentType, Permissions, RoleType } from '@/lib/types/database'

interface HeaderProps {
  userEmail: string
  userAvatarUrl?: string | null
  permissions: Permissions
  roleType: RoleType
  currentEstablishment: Establishment
  establishments: Establishment[]
}

export function Header({ userEmail, userAvatarUrl, permissions, roleType, currentEstablishment, establishments }: Readonly<HeaderProps>) {
  const [showMenu, setShowMenu] = useState(false)
  const [showMobileNav, setShowMobileNav] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const { theme, toggleTheme } = useTheme()

  const establishmentType: EstablishmentType = currentEstablishment.type || 'farm'
  const sections = getNavSections(establishmentType, permissions, roleType)

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname === href || pathname.startsWith(href + '/')
  }

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
          className="lg:hidden text-muted hover:text-text p-1"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d={showMobileNav ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
          </svg>
        </button>

        {/* Mobile establishment switcher */}
        <div className="lg:hidden flex-1 mx-3">
          <EstablishmentSwitcher
            establishments={establishments}
            currentEstablishment={currentEstablishment}
            userEmail={userEmail}
          />
        </div>

        {/* Spacer for desktop */}
        <div className="hidden lg:block" />

        <div className="flex items-center gap-2">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-muted hover:text-text hover:bg-surface-hover transition-colors"
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

          <NotificationBell />

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-surface-hover transition-colors"
          >
            {userAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={userAvatarUrl}
                alt="Avatar"
                className="w-7 h-7 rounded-full object-cover"
                onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden') }}
              />
            ) : null}
            <div className={`w-7 h-7 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-white ${userAvatarUrl ? 'hidden' : ''}`}>
              {userEmail[0].toUpperCase()}
            </div>
            <span className="hidden sm:block text-sm text-muted">{userEmail}</span>
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" role="presentation" tabIndex={-1} onClick={() => setShowMenu(false)} onKeyDown={(e) => { if (e.key === 'Escape') setShowMenu(false) }} />
              <div className="absolute right-0 top-full mt-1 w-56 bg-surface border border-border rounded-xl shadow-xl z-50 animate-fade-up">
                <div className="p-3 border-b border-border">
                  <p className="text-sm font-medium truncate">{userEmail}</p>
                </div>
                <div className="p-1">
                  <Link
                    href="/compte"
                    onClick={() => setShowMenu(false)}
                    className="block w-full text-left px-3 py-2 text-sm text-muted hover:text-text hover:bg-surface-hover rounded-lg transition-colors"
                  >
                    Mon compte
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2 text-sm text-danger hover:bg-surface-hover rounded-lg transition-colors"
                  >
                    Déconnexion
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
        </div>
      </div>

      {/* Mobile navigation */}
      {showMobileNav && (
        <nav className="lg:hidden border-t border-border p-3 max-h-[70vh] overflow-y-auto animate-fade-up">
          {sections.map((section, idx) => (
            <div key={section.label || `root-${idx}`} className={idx > 0 ? 'mt-3' : ''}>
              {section.label && (
                <div className="px-3 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted/60">
                  {section.label}
                </div>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isActive(item.href)
                  return (
                    <Link
                      key={item.href + item.label}
                      href={item.href}
                      onClick={() => setShowMobileNav(false)}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all
                        ${active
                          ? 'bg-primary/15 text-primary-light'
                          : 'text-muted hover:text-text hover:bg-surface-hover'
                        }`}
                    >
                      <item.Icon className="w-5 h-5" />
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
      )}
    </header>
  )
}
