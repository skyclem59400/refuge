'use client'

import { PhoneIncoming, PhoneMissed, Voicemail, Clock, PhoneOutgoing } from 'lucide-react'
import { formatDurationHuman, getAnswerRateColor, getWaitTimeColor } from '@/lib/sda-utils'
import type { RingoverDashboardStats } from '@/lib/types/database'

interface AccueilStatsProps {
  stats: RingoverDashboardStats
}

export function AccueilStats({ stats }: AccueilStatsProps) {
  const totalInbound = stats.answeredCalls + stats.missedCalls + stats.voicemailCalls

  const items = [
    {
      label: 'Entrants',
      value: String(totalInbound),
      sub: `${stats.outboundCalls} sortants`,
      Icon: PhoneIncoming,
      color: 'text-primary',
      highlight: false,
    },
    {
      label: 'Taux de reponse',
      value: `${stats.answerRate}%`,
      sub: `${stats.answeredCalls} repondus`,
      Icon: PhoneOutgoing,
      color: getAnswerRateColor(stats.answerRate),
      highlight: stats.answerRate < 75,
    },
    {
      label: 'Manques',
      value: String(stats.missedCalls),
      sub: `${stats.voicemailCalls} messageries`,
      Icon: PhoneMissed,
      color: stats.missedCalls > 0 ? 'text-error' : 'text-success',
      highlight: stats.missedCalls > 5,
    },
    {
      label: 'Attente moy.',
      value: formatDurationHuman(stats.avgWaitTime),
      sub: `Duree moy. ${formatDurationHuman(stats.avgDuration)}`,
      Icon: Clock,
      color: getWaitTimeColor(stats.avgWaitTime),
      highlight: stats.avgWaitTime > 30,
    },
    {
      label: 'A rappeler',
      value: String(stats.callbacksPending),
      sub: stats.callbacksPending > 0 ? 'en attente' : 'tout traite',
      Icon: Voicemail,
      color: stats.callbacksPending > 0 ? 'text-warning' : 'text-success',
      highlight: stats.callbacksPending > 0,
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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
          <p className="text-[11px] text-muted mt-1">{item.sub}</p>
        </div>
      ))}
    </div>
  )
}
