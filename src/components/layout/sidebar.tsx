'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { EstablishmentSwitcher } from '@/components/establishment/establishment-switcher'
import { getNavSections } from './nav-config'
import type { ContractType, Establishment, EstablishmentType, Permissions, RoleType } from '@/lib/types/database'

interface SidebarProps {
  establishments: Establishment[]
  currentEstablishment: Establishment
  permissions: Permissions
  roleType: RoleType
  contractType: ContractType | null
  userEmail?: string
}

const STORAGE_KEY = 'sidebar-open-sections'

export function Sidebar({ establishments, currentEstablishment, permissions, roleType, contractType, userEmail }: Readonly<SidebarProps>) {
  const pathname = usePathname()
  const { sidebarCollapsed, toggleSidebar } = useTheme()

  const establishmentType: EstablishmentType = currentEstablishment.type || 'farm'
  const sections = getNavSections(establishmentType, permissions, roleType, contractType)

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname === href || pathname.startsWith(href + '/')
  }

  // openSections === null avant hydratation pour éviter le flash :
  // tout est considéré ouvert tant qu'on n'a pas lu localStorage.
  const [openSections, setOpenSections] = useState<Set<string> | null>(null)

  // Hydratation initiale : lit localStorage, sinon ouvre uniquement la section active.
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    let initial: Set<string>
    if (stored) {
      try {
        initial = new Set(JSON.parse(stored) as string[])
      } catch {
        initial = new Set()
      }
    } else {
      const activeSection = sections.find((s) => s.label && s.items.some((i) => isActive(i.href)))
      initial = new Set(activeSection?.label ? [activeSection.label] : [])
    }
    setOpenSections(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persistance
  useEffect(() => {
    if (openSections === null) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...openSections]))
  }, [openSections])

  // Auto-ouverture de la section contenant la page active (cas navigation directe par URL)
  useEffect(() => {
    if (openSections === null) return
    const activeSection = sections.find((s) => s.label && s.items.some((i) => isActive(i.href)))
    if (activeSection?.label && !openSections.has(activeSection.label)) {
      setOpenSections((prev) => {
        if (!prev) return prev
        const next = new Set(prev)
        next.add(activeSection.label!)
        return next
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  function toggleSection(label: string) {
    setOpenSections((prev) => {
      const next = new Set(prev ?? [])
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
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
        {sections.map((section, idx) => {
          // Sections sans label (ex: Dashboard) toujours visibles.
          // En mode sidebar repliée, on ne fait pas d'accordéon.
          const collapsible = Boolean(section.label) && !sidebarCollapsed
          const isOpen = !collapsible || openSections === null || openSections.has(section.label!)
          const sectionHasActive = section.items.some((i) => isActive(i.href))

          return (
            <div key={section.label || `root-${idx}`} className={idx > 0 ? 'mt-1' : ''}>
              {section.label && !sidebarCollapsed && (
                <button
                  type="button"
                  onClick={() => toggleSection(section.label!)}
                  className={`w-full flex items-center justify-between px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider transition-colors rounded
                    ${sectionHasActive ? 'text-primary-light' : 'text-muted/60 hover:text-text'}`}
                  aria-expanded={isOpen}
                >
                  <span>{section.label}</span>
                  <ChevronDown
                    className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-0' : '-rotate-90'}`}
                  />
                </button>
              )}
              {section.label && sidebarCollapsed && idx > 0 && (
                <div className="my-2 mx-2 h-px bg-border/50" />
              )}

              {/* Animation d'expansion via grid-template-rows 1fr/0fr */}
              <div
                className={`grid transition-all duration-200 ease-in-out
                  ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
              >
                <div className="overflow-hidden">
                  <div className={`space-y-0.5 ${section.label && !sidebarCollapsed ? 'pt-1' : ''}`}>
                    {section.items.map((item) => {
                      const active = isActive(item.href)
                      return (
                        <Link
                          key={item.href + item.label}
                          href={item.href}
                          title={sidebarCollapsed ? item.label : undefined}
                          tabIndex={isOpen ? 0 : -1}
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
              </div>
            </div>
          )
        })}
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
