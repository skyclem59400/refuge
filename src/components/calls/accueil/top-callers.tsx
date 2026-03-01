'use client'

import { Phone, AlertTriangle } from 'lucide-react'
import { formatPhoneFr } from '@/lib/sda-utils'
import type { RingoverTopCaller } from '@/lib/types/database'

interface TopCallersProps {
  callers: RingoverTopCaller[]
}

export function TopCallers({ callers }: TopCallersProps) {
  if (callers.length === 0) return null

  return (
    <div className="bg-surface rounded-xl border border-border p-5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-4">Appelants frequents (30j)</h3>
      <div className="space-y-2">
        {callers.map((caller, i) => (
          <div key={caller.caller_number} className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-hover/50 transition-colors">
            <span className="text-xs font-bold text-muted w-5 text-center">{i + 1}</span>
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Phone className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{caller.caller_name || formatPhoneFr(caller.caller_number)}</p>
              <p className="text-xs text-muted">
                {caller.total_calls} appels
                {caller.missed_calls > 0 && <span className="text-error ml-1">({caller.missed_calls} manques)</span>}
              </p>
            </div>
            {caller.missed_calls > 2 && <span title="Souvent manque"><AlertTriangle className="w-4 h-4 text-warning shrink-0" /></span>}
          </div>
        ))}
      </div>
    </div>
  )
}
