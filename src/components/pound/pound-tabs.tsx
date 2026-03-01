'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/pound', label: 'Animaux' },
  { href: '/pound/interventions', label: 'Interventions' },
]

export function PoundTabs() {
  const pathname = usePathname()

  return (
    <div className="flex gap-1 border-b border-border mb-6">
      {tabs.map((tab) => {
        const isActive = tab.href === '/pound'
          ? pathname === '/pound'
          : pathname.startsWith(tab.href)

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              isActive
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-text hover:border-border'
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
