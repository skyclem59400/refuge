'use client'

import { Phone, PhoneCall, Clock, PhoneIncoming } from 'lucide-react'
import { formatCallDuration } from '@/lib/sda-utils'

interface CallStatsProps {
  stats: {
    total: number
    inProgress: number
    avgDuration: number
    callbackNeeded: number
  }
}

export function CallStats({ stats }: CallStatsProps) {
  const items = [
    { label: 'Total appels', value: String(stats.total), Icon: Phone, color: 'text-primary' },
    { label: 'En cours', value: String(stats.inProgress), Icon: PhoneCall, color: 'text-success' },
    { label: 'Temps moyen', value: formatCallDuration(stats.avgDuration), Icon: Clock, color: 'text-muted' },
    { label: 'A rappeler', value: String(stats.callbackNeeded), Icon: PhoneIncoming, color: 'text-warning' },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((item) => (
        <div key={item.label} className="bg-surface rounded-xl border border-border p-5">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${item.color} bg-current/10`}>
              <item.Icon className={`w-5 h-5 ${item.color}`} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">{item.label}</p>
              <p className="text-2xl font-bold">{item.value}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
