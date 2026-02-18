'use client'

import { useTheme } from '@/components/theme-provider'

export function MainContent({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed } = useTheme()

  return (
    <div className={`transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-60'}`}>
      {children}
    </div>
  )
}
