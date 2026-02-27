'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Phone, User, Calendar } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  getCallStatusLabel,
  getCallStatusColor,
  getSentimentLabel,
  getSentimentColor,
  formatCallDuration,
  maskPhone,
} from '@/lib/sda-utils'
import type { CallLogWithCategory, CallCategory } from '@/lib/types/database'

interface CallListProps {
  initialCalls: CallLogWithCategory[]
  categories: CallCategory[]
  establishmentId: string
}

function formatDateFr(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function CallList({ initialCalls, categories, establishmentId }: CallListProps) {
  const [calls, setCalls] = useState<CallLogWithCategory[]>(initialCalls)

  // Build a category lookup map
  const categoryMap = new Map<string, CallCategory>()
  for (const cat of categories) {
    categoryMap.set(cat.id, cat)
  }

  useEffect(() => {
    setCalls(initialCalls)
  }, [initialCalls])

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('call-logs-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'call_logs',
          filter: `establishment_id=eq.${establishmentId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newCall = payload.new as CallLogWithCategory
            // Attach category if available
            if (newCall.category_id) {
              newCall.category = categoryMap.get(newCall.category_id) || null
            } else {
              newCall.category = null
            }
            setCalls((prev) => [newCall, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setCalls((prev) =>
              prev.map((c) => {
                if (c.id === (payload.new as CallLogWithCategory).id) {
                  const updated = payload.new as CallLogWithCategory
                  if (updated.category_id) {
                    updated.category = categoryMap.get(updated.category_id) || null
                  } else {
                    updated.category = null
                  }
                  return updated
                }
                return c
              })
            )
          } else if (payload.eventType === 'DELETE') {
            setCalls((prev) => prev.filter((c) => c.id !== (payload.old as { id: string }).id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [establishmentId, categories])

  if (calls.length === 0) {
    return (
      <div className="bg-surface rounded-xl border border-border p-8 text-center">
        <Phone className="w-10 h-10 text-muted mx-auto mb-3" />
        <p className="text-muted text-sm">Aucun appel enregistre</p>
      </div>
    )
  }

  return (
    <div className="bg-surface rounded-xl border border-border divide-y divide-border">
      {calls.map((call) => {
        const statusColor = getCallStatusColor(call.status)
        const statusLabel = getCallStatusLabel(call.status)

        return (
          <Link
            key={call.id}
            href={`/appels/${call.id}`}
            className="block p-4 hover:bg-surface-hover transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              {/* Left: phone + info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Phone className="w-4 h-4 text-muted shrink-0" />
                  <span className="font-medium text-sm">{maskPhone(call.caller_phone)}</span>

                  {/* Status badge */}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                    {statusLabel}
                  </span>

                  {/* Category badge */}
                  {call.category && (
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: `${call.category.color}20`,
                        color: call.category.color,
                      }}
                    >
                      {call.category.name}
                    </span>
                  )}

                  {/* Sentiment badge */}
                  {call.sentiment && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getSentimentColor(call.sentiment)}`}>
                      {getSentimentLabel(call.sentiment)}
                    </span>
                  )}
                </div>

                {/* Summary preview */}
                {call.summary && (
                  <p className="text-sm text-muted line-clamp-2 mt-1">{call.summary}</p>
                )}

                {/* Meta row */}
                <div className="flex items-center gap-4 mt-2 text-xs text-muted">
                  {call.agent_name && (
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {call.agent_name}
                    </span>
                  )}
                  {call.duration_seconds > 0 && (
                    <span>{formatCallDuration(call.duration_seconds)}</span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDateFr(call.started_at)}
                  </span>
                </div>
              </div>

              {/* Right: callback indicator */}
              {call.callback_needed && !call.callback_completed && (
                <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium bg-warning/15 text-warning">
                  A rappeler
                </span>
              )}
            </div>
          </Link>
        )
      })}
    </div>
  )
}
