'use client'

import type { DonationSource } from '@/lib/types/database'

interface HelloAssoBadgeProps {
  source: DonationSource
}

export function HelloAssoBadge({ source }: HelloAssoBadgeProps) {
  if (source === 'helloasso') {
    return (
      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-success/15 text-success">
        HelloAsso
      </span>
    )
  }

  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-muted/10 text-muted">
      Manuel
    </span>
  )
}
