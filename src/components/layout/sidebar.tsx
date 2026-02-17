'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/documents', label: 'Documents', icon: '📄' },
  { href: '/clients', label: 'Clients', icon: '👥' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden lg:flex flex-col w-60 bg-surface border-r border-border min-h-screen fixed left-0 top-0">
      {/* Brand */}
      <div className="p-6 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-3">
          <span className="text-3xl">🏡</span>
          <div>
            <h1 className="font-bold text-sm gradient-text">La Ferme O 4 Vents</h1>
            <p className="text-[10px] text-muted">Gestion & Facturation</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all
                ${isActive
                  ? 'bg-primary/15 text-primary-light border border-primary/20'
                  : 'text-muted hover:text-white hover:bg-surface-hover'
                }`}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <p className="text-[10px] text-muted text-center">CRM Ferme v1.0</p>
      </div>
    </aside>
  )
}
