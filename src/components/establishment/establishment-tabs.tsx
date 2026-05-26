'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export interface EstablishmentTab {
  href: string
  label: string
  show: boolean
  badge?: string
}

interface Props {
  readonly tabs: EstablishmentTab[]
}

export function EstablishmentTabs({ tabs }: Props) {
  const pathname = usePathname()

  function isActive(href: string): boolean {
    if (href === '/etablissement') return pathname === '/etablissement'
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <nav className="border-b border-border overflow-x-auto">
      <ul className="flex gap-1 min-w-max">
        {tabs.map((tab) => {
          const active = isActive(tab.href)
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={`relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px
                  ${
                    active
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted hover:text-text hover:border-border'
                  }`}
              >
                {tab.label}
                {tab.badge && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-cyan-500/15 text-cyan-600 border border-cyan-500/30">
                    {tab.badge}
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
