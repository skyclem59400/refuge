'use client'

import { useState, useEffect, useTransition } from 'react'
import { Phone, Loader2, PhoneIncoming } from 'lucide-react'
import { getRecentAstreinteCalls } from '@/lib/actions/ringover'
import type { RingoverCall } from '@/lib/types/database'

interface RecentCallsProps {
  onSelect: (data: { callerName: string; callerPhone: string }) => void
}

function formatPhone(phone: string): string {
  // Format French numbers: +33612345678 → 06 12 34 56 78
  if (phone.startsWith('+33') && phone.length === 12) {
    const local = '0' + phone.slice(3)
    return local.replace(/(\d{2})(?=\d)/g, '$1 ')
  }
  return phone
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s}s`
  return `${m}min${s > 0 ? ` ${s}s` : ''}`
}

export function RecentCalls({ onSelect }: RecentCallsProps) {
  const [calls, setCalls] = useState<RingoverCall[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isExpanded, setIsExpanded] = useState(false)
  const [, startTransition] = useTransition()

  useEffect(() => {
    startTransition(async () => {
      const result = await getRecentAstreinteCalls()
      setCalls(result.data || [])
      setIsLoading(false)
    })
  }, [])

  // Don't render if no calls and not loading (Ringover not configured)
  if (!isLoading && calls.length === 0) {
    return null
  }

  if (isLoading) {
    return (
      <div className="bg-surface-hover/30 rounded-lg p-3 flex items-center gap-2 text-sm text-muted">
        <Loader2 className="w-4 h-4 animate-spin" />
        Chargement des appels recents...
      </div>
    )
  }

  const displayCalls = isExpanded ? calls : calls.slice(0, 3)

  return (
    <div className="bg-surface rounded-xl border border-primary/20 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <PhoneIncoming className="w-4 h-4 text-primary" />
          Appels recents (astreinte)
        </h4>
        <span className="text-xs text-muted">{calls.length} appel{calls.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="space-y-1">
        {displayCalls.map((call) => {
          const date = new Date(call.start_time)
          const dateStr = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
          const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

          return (
            <button
              key={call.call_id}
              onClick={() => onSelect({
                callerName: call.from_name || '',
                callerPhone: formatPhone(call.from_number),
              })}
              className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-primary/5 transition-colors text-left group"
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Phone className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">
                    {call.from_name || formatPhone(call.from_number)}
                  </span>
                  {call.from_name && (
                    <span className="text-xs text-muted">{formatPhone(call.from_number)}</span>
                  )}
                </div>
                <div className="text-xs text-muted">
                  {dateStr} a {timeStr} · {formatDuration(call.duration)}
                </div>
              </div>
              <span className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity font-medium shrink-0">
                Utiliser
              </span>
            </button>
          )
        })}
      </div>

      {calls.length > 3 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-primary hover:text-primary-dark font-medium transition-colors"
        >
          {isExpanded ? 'Voir moins' : `Voir les ${calls.length} appels`}
        </button>
      )}
    </div>
  )
}
