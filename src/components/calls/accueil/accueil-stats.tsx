'use client'

import { PhoneIncoming, PhoneMissed, PhoneOutgoing, Voicemail, Clock, Phone, TrendingDown, TrendingUp } from 'lucide-react'
import { formatDurationHuman, getAnswerRateColor, getWaitTimeColor } from '@/lib/sda-utils'
import type { RingoverDashboardStats } from '@/lib/types/database'

interface AccueilStatsProps {
  stats: RingoverDashboardStats
}

export function AccueilStats({ stats }: AccueilStatsProps) {
  const items = [
    { label: 'Appels entrants', value: String(stats.answeredCalls + stats.missedCalls + stats.voicemailCalls), Icon: PhoneIncoming, color: 'text-primary', highlight: false },
    { label: 'Taux de reponse', value: `${stats.answerRate}%`, Icon: stats.answerRate >= 75 ? TrendingUp : TrendingDown, color: getAnswerRateColor(stats.answerRate), highlight: stats.answerRate < 75 },
    { label: 'Appels manques', value: String(stats.missedCalls), Icon: PhoneMissed, color: stats.missedCalls > 0 ? 'text-error' : 'text-success', highlight: stats.missedCalls > 5 },
    { label: 'Messageries', value: String(stats.voicemailCalls), Icon: Voicemail, color: 'text-purple-500', highlight: false },
    { label: 'Attente moyenne', value: formatDurationHuman(stats.avgWaitTime), Icon: Clock, color: getWaitTimeColor(stats.avgWaitTime), highlight: stats.avgWaitTime > 30 },
    { label: 'Duree moyenne', value: formatDurationHuman(stats.avgDuration), Icon: Phone, color: 'text-muted', highlight: false },
    { label: 'Appels sortants', value: String(stats.outboundCalls), Icon: PhoneOutgoing, color: 'text-blue-500', highlight: false },
    { label: 'A rappeler', value: String(stats.callbacksPending), Icon: PhoneMissed, color: stats.callbacksPending > 0 ? 'text-warning' : 'text-success', highlight: stats.callbacksPending > 0 },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className={`bg-surface rounded-xl border p-4 ${
            item.highlight ? 'border-error/40 shadow-[0_0_12px_rgba(239,68,68,0.1)]' : 'border-border'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <item.Icon className={`w-4 h-4 ${item.color}`} />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{item.label}</p>
          </div>
          <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
        </div>
      ))}
    </div>
  )
}
