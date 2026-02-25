'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
  { href: '/pound', label: 'Fourri\u00e8re', Icon: Warehouse, permission: 'canViewPound' },
  { href: '/health', label: 'Sant\u00e9', Icon: HeartPulse, permission: 'canManageHealth' },
  { href: '/boxes', label: 'Box', Icon: Package, permission: 'canManageBoxes' },
  { href: '/donations', label: 'Dons', Icon: Heart, permission: 'canManageDonations' },
  { href: '/icad', label: 'I-CAD', Icon: Shield, permission: 'canManageMovements' },
  { href: '/documents', label: 'Documents', Icon: FileText, permission: 'canManageDocuments' },
  { href: '/clients', label: 'R\u00e9pertoire', Icon: Users, permission: 'canManageClients' },
  { href: '/statistiques', label: 'Statistiques', Icon: BarChart3, permission: 'canViewStatistics' },
]

const adminItems: NavItem[] = [
  { href: '/etablissement', label: '\u00c9tablissement', Icon: Building2, permission: 'canManageEstablishment' },
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

interface SidebarProps {
  establishments: Establishment[]
  currentEstablishment: Establishment
  permissions: Permissions
  userEmail?: string
}

export function Sidebar({ establishments, currentEstablishment, permissions, userEmail }: SidebarProps) {
  const pathname = usePathname()
  const { sidebarCollapsed, toggleSidebar } = useTheme()

  const establishmentType: EstablishmentType = currentEstablishment.type || 'farm'
  const navItems = getNavItems(establishmentType, permissions)

  return (
    <aside
      className={`hidden lg:flex flex-col bg-surface border-r border-border min-h-screen fixed left-0 top-0 transition-all duration-300 z-40
        ${sidebarCollapsed ? 'w-16' : 'w-60'}`}
    >
      {/* Brand / Switcher */}
      <div className="p-4 border-b border-border">
        <EstablishmentSwitcher
          establishments={establishments}
          currentEstablishment={currentEstablishment}
          collapsed={sidebarCollapsed}
          userEmail={userEmail}
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href + item.label}
              href={item.href}
              title={sidebarCollapsed ? item.label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                ${sidebarCollapsed ? 'justify-center' : ''}
                ${isActive
                  ? 'bg-primary/15 text-primary-light border border-primary/20'
                  : 'text-muted hover:text-text hover:bg-surface-hover'
                }`}
            >
              <item.Icon className="w-5 h-5 shrink-0" />
              {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="p-2 border-t border-border">
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-muted hover:text-text hover:bg-surface-hover transition-colors text-sm"
          title={sidebarCollapsed ? 'Agrandir' : 'Reduire'}
        >
          <svg
            className={`w-4 h-4 transition-transform duration-300 ${sidebarCollapsed ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
          {!sidebarCollapsed && <span>Reduire</span>}
        </button>
      </div>
    </aside>
  )
}
