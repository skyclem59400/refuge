'use client'

import { FileText, Clock, CheckCircle, AlertTriangle } from 'lucide-react'

interface PublicationsStatsProps {
  stats: {
    drafts: number
    scheduled: number
    published: number
    failed: number
  }
}

export function PublicationsStats({ stats }: PublicationsStatsProps) {
  const items = [
    { label: 'Brouillons', value: stats.drafts, Icon: FileText, color: 'text-muted' },
    { label: 'Programmes', value: stats.scheduled, Icon: Clock, color: 'text-info' },
    { label: 'Publies', value: stats.published, Icon: CheckCircle, color: 'text-success' },
    { label: 'Echecs', value: stats.failed, Icon: AlertTriangle, color: 'text-error' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {items.map((item) => (
        <div key={item.label} className="bg-surface rounded-xl border border-border p-4 text-center">
          <item.Icon className={`w-5 h-5 mx-auto mb-1 ${item.color}`} />
          <p className="text-2xl font-bold">{item.value}</p>
          <p className="text-xs text-muted mt-1">{item.label}</p>
        </div>
      ))}
    </div>
  )
}
