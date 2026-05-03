'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from '@/components/theme-provider'
import { EstablishmentSwitcher } from '@/components/establishment/establishment-switcher'
import { getNavSections } from './nav-config'
import type { Establishment, EstablishmentType, Permissions, RoleType } from '@/lib/types/database'

interface SidebarProps {
  establishments: Establishment[]
  currentEstablishment: Establishment
  permissions: Permissions
  roleType: RoleType
  userEmail?: string
}

export function Sidebar({ establishments, currentEstablishment, permissions, roleType, userEmail }: Readonly<SidebarProps>) {
  const pathname = usePathname()
  const { sidebarCollapsed, toggleSidebar } = useTheme()

  const establishmentType: EstablishmentType = currentEstablishment.type || 'farm'
  const sections = getNavSections(establishmentType, permissions, roleType)

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <aside
      className={`hidden lg:flex flex-col bg-surface border-r border-border h-screen fixed left-0 top-0 transition-all duration-300 z-40
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
      <nav className="flex-1 min-h-0 overflow-y-auto p-2">
        {sections.map((section, idx) => (
          <div key={section.label || `root-${idx}`} className={idx > 0 ? 'mt-3' : ''}>
            {section.label && !sidebarCollapsed && (
              <div className="px-3 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted/60">
                {section.label}
              </div>
            )}
            {section.label && sidebarCollapsed && idx > 0 && (
              <div className="my-2 mx-2 h-px bg-border/50" />
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href + item.label}
                    href={item.href}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all
                      ${sidebarCollapsed ? 'justify-center' : ''}
                      ${active
                        ? 'bg-primary/15 text-primary-light border border-primary/20'
                        : 'text-muted hover:text-text hover:bg-surface-hover'
                      }`}
                  >
                    <item.Icon className="w-5 h-5 shrink-0" />
                    {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="p-2 border-t border-border">
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-muted hover:text-text hover:bg-surface-hover transition-colors text-sm"
          title={sidebarCollapsed ? 'Agrandir' : 'Réduire'}
        >
          <svg
            className={`w-4 h-4 transition-transform duration-300 ${sidebarCollapsed ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
          {!sidebarCollapsed && <span>Réduire</span>}
        </button>
      </div>
    </aside>
  )
}
