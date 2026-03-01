'use client'

import { useState, useEffect } from 'react'
import { PhoneIncoming, PhoneMissed, PhoneOutgoing, Voicemail, Phone, Clock, Calendar, Headphones } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getRingoverStatusLabel, getRingoverStatusColor, formatPhoneFr, formatDurationHuman } from '@/lib/sda-utils'
import type { RingoverCallRecord } from '@/lib/types/database'

interface AccueilCallListProps {
  initialCalls: RingoverCallRecord[]
  establishmentId: string
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'ANSWERED': return <PhoneIncoming className="w-4 h-4 text-green-500" />
    case 'MISSED': return <PhoneMissed className="w-4 h-4 text-red-500" />
    case 'OUT': return <PhoneOutgoing className="w-4 h-4 text-blue-500" />
    case 'VOICEMAIL': return <Voicemail className="w-4 h-4 text-purple-500" />
    default: return <Phone className="w-4 h-4 text-muted" />
  }
}

export function AccueilCallList({ initialCalls, establishmentId }: AccueilCallListProps) {
  const [calls, setCalls] = useState<RingoverCallRecord[]>(initialCalls)

  useEffect(() => { setCalls(initialCalls) }, [initialCalls])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('ringover-calls-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ringover_calls', filter: `establishment_id=eq.${establishmentId}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setCalls((prev) => [payload.new as RingoverCallRecord, ...prev].slice(0, 100))
        } else if (payload.eventType === 'UPDATE') {
          setCalls((prev) => prev.map((c) => c.id === (payload.new as RingoverCallRecord).id ? (payload.new as RingoverCallRecord) : c))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [establishmentId])

  if (calls.length === 0) {
    return (
      <div className="bg-surface rounded-xl border border-border p-8 text-center">
        <Phone className="w-10 h-10 text-muted mx-auto mb-3" />
        <p className="text-muted text-sm">Aucun appel synchronise</p>
        <p className="text-xs text-muted mt-1">Lancez une synchronisation pour charger les appels</p>
      </div>
    )
  }

  return (
    <div className="bg-surface rounded-xl border border-border divide-y divide-border">
      {calls.map((call) => {
        const date = new Date(call.start_time)
        return (
          <div key={call.id} className="p-4 hover:bg-surface-hover/50 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <StatusIcon status={call.status} />
                  <span className="font-medium text-sm">{call.caller_name || formatPhoneFr(call.caller_number)}</span>
                  {call.caller_name && <span className="text-xs text-muted">{formatPhoneFr(call.caller_number)}</span>}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRingoverStatusColor(call.status)}`}>{getRingoverStatusLabel(call.status)}</span>
                  {call.has_voicemail && <span className="text-xs text-purple-500 bg-purple-500/10 px-2 py-0.5 rounded-full">Messagerie</span>}
                  {call.has_recording && <span title="Enregistrement"><Headphones className="w-3 h-3 text-muted" /></span>}
                </div>
                <div className="flex items-center gap-4 text-xs text-muted">
                  {call.agent_name && <span>Agent: {call.agent_name}</span>}
                  {call.duration > 0 && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDurationHuman(call.duration)}</span>}
                  {call.wait_time > 0 && <span className={call.wait_time > 30 ? 'text-warning' : ''}>Attente: {formatDurationHuman(call.wait_time)}</span>}
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
              {call.callback_needed && !call.callback_completed && (
                <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium bg-warning/15 text-warning">A rappeler</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
