'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { HeartPulse, History, CalendarDays, Stethoscope, ListChecks } from 'lucide-react'

const tabs = [
  { href: '/sante', label: 'Historique', Icon: History },
  { href: '/sante/planning', label: 'Planning', Icon: CalendarDays },
  { href: '/sante/passages', label: 'Passages véto', Icon: Stethoscope },
] as const

const rootRoutes: string[] = ['/sante', '/sante/planning', '/sante/passages']

export default function SanteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname()
  const isRootTab = rootRoutes.includes(pathname)

  if (!isRootTab) {
    return <div className="animate-fade-up">{children}</div>
  }

  function isActive(href: string) {
    if (href === '/sante') return pathname === '/sante'
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <div className="animate-fade-up">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <HeartPulse className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Santé</h1>
            <p className="text-sm text-muted mt-0.5">Suivi vétérinaire des animaux</p>
          </div>
        </div>
        <Link
          href="/sante/protocols"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border border-border hover:bg-surface-hover text-muted hover:text-text transition-colors"
        >
          <ListChecks className="w-4 h-4" />
          Protocoles
        </Link>
      </div>

      <div className="border-b border-border mb-6 flex flex-wrap gap-1">
        {tabs.map((tab) => {
          const active = isActive(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                active ? 'text-primary' : 'text-muted hover:text-text'
              }`}
            >
              <tab.Icon className="w-4 h-4" />
              {tab.label}
              {active && (
                <span className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-primary rounded-full" />
              )}
            </Link>
          )
        })}
      </div>

      {children}
    </div>
  )
}
