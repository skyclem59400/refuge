'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from '@/components/theme-provider'
import { ChartBarIcon, DocumentTextIcon, UsersIcon, BuildingIcon } from '@/components/icons'
import { EstablishmentSwitcher } from '@/components/establishment/establishment-switcher'
import type { ComponentType } from 'react'
import type { Establishment, Permissions } from '@/lib/types/database'

const baseNavItems: { href: string; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { href: '/dashboard', label: 'Dashboard', Icon: ChartBarIcon },
  { href: '/documents', label: 'Documents', Icon: DocumentTextIcon },
  { href: '/clients', label: 'Clients', Icon: UsersIcon },
]

interface SidebarProps {
  establishments: Establishment[]
  currentEstablishment: Establishment
  permissions: Permissions
  userEmail?: string
}

export function Sidebar({ establishments, currentEstablishment, permissions, userEmail }: SidebarProps) {
  const pathname = usePathname()
  const { sidebarCollapsed, toggleSidebar } = useTheme()

  const navItems = [
    ...baseNavItems,
    ...(permissions.canManageEstablishment
      ? [{ href: '/etablissement', label: 'Etablissement', Icon: BuildingIcon }]
      : []),
  ]

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
              key={item.href}
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
