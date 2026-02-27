'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from '@/components/theme-provider'
import { EstablishmentSwitcher } from '@/components/establishment/establishment-switcher'
import type { ComponentType } from 'react'
import type { Establishment, EstablishmentType, Permissions } from '@/lib/types/database'
import {
  LayoutDashboard,
  FileText,
  Users,
  Building2,
  PawPrint,
  Warehouse,
  HeartPulse,
  Package,
  BarChart3,
  Heart,
  Shield,
  Share2,
  PhoneCall,
} from 'lucide-react'

interface NavItem {
  href: string
  label: string
  Icon: ComponentType<{ className?: string }>
  permission?: keyof Permissions
}

const commonItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
]

const farmItems: NavItem[] = [
  { href: '/documents', label: 'Documents', Icon: FileText, permission: 'canManageDocuments' },
  { href: '/clients', label: 'Répertoire', Icon: Users, permission: 'canManageClients' },
]

const shelterItems: NavItem[] = [
  { href: '/animals', label: 'Animaux', Icon: PawPrint, permission: 'canViewAnimals' },
  { href: '/pound', label: 'Fourrière', Icon: Warehouse, permission: 'canViewPound' },
  { href: '/health', label: 'Santé', Icon: HeartPulse, permission: 'canManageHealth' },
  { href: '/boxes', label: 'Box', Icon: Package, permission: 'canManageBoxes' },
  { href: '/donations', label: 'Dons', Icon: Heart, permission: 'canManageDonations' },
  { href: '/publications', label: 'Publications', Icon: Share2, permission: 'canManagePosts' },
  { href: '/appels', label: 'Appels IA', Icon: PhoneCall, permission: 'canManageEstablishment' },
  { href: '/icad', label: 'I-CAD', Icon: Shield, permission: 'canManageMovements' },
  { href: '/documents', label: 'Documents', Icon: FileText, permission: 'canManageDocuments' },
  { href: '/clients', label: 'Répertoire', Icon: Users, permission: 'canManageClients' },
  { href: '/statistiques', label: 'Statistiques', Icon: BarChart3, permission: 'canViewStatistics' },
]

const adminItems: NavItem[] = [
  { href: '/etablissement', label: 'Établissement', Icon: Building2, permission: 'canManageEstablishment' },
]

function getNavItems(type: EstablishmentType, permissions: Permissions): NavItem[] {
  let typeItems: NavItem[]

  switch (type) {
    case 'farm':
      typeItems = farmItems
      break
    case 'shelter':
      typeItems = shelterItems
      break
    case 'both': {
      const seen = new Set<string>()
      typeItems = [...shelterItems, ...farmItems].filter((item) => {
        const key = item.href + item.label
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      break
    }
    default:
      typeItems = farmItems
  }

  const allItems = [...commonItems, ...typeItems, ...adminItems]

  return allItems.filter((item) => {
    if (!item.permission) return true
    return permissions[item.permission]
  })
}

interface HeaderProps {
  userEmail: string
  userAvatarUrl?: string | null
  permissions: Permissions
  currentEstablishment: Establishment
  establishments: Establishment[]
}

export function Header({ userEmail, userAvatarUrl, permissions, currentEstablishment, establishments }: HeaderProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [showMobileNav, setShowMobileNav] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const { theme, toggleTheme } = useTheme()

  const establishmentType: EstablishmentType = currentEstablishment.type || 'farm'
  const navItems = getNavItems(establishmentType, permissions)

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

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-surface-hover transition-colors"
          >
            {userAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={userAvatarUrl} alt="Avatar" className="w-7 h-7 rounded-full object-cover" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-white">
                {userEmail[0].toUpperCase()}
              </div>
            )}
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
                    Deconnexion
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
                    : 'text-muted hover:text-text hover:bg-surface-hover'
                  }`}
              >
                <item.Icon className="w-5 h-5" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      )}
    </header>
  )
}
