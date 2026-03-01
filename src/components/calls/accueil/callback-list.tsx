'use client'

import { useState, useTransition } from 'react'
import { PhoneMissed, Voicemail, PhoneOutgoing, X, CheckCircle, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { markRingoverCallback, dismissRingoverCallback } from '@/lib/actions/ringover-sync'
import { formatPhoneFr, formatDurationHuman, getSentimentLabel, getSentimentColor } from '@/lib/sda-utils'
import { TranscribeButton } from '@/components/calls/accueil/transcribe-button'
import type { RingoverCallbackItem } from '@/lib/types/database'

interface CallbackListProps {
  callbacks: RingoverCallbackItem[]
}

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffH = Math.floor(diffMin / 60)
  const diffD = Math.floor(diffH / 24)
  if (diffMin < 60) return `il y a ${diffMin}min`
  if (diffH < 24) return `il y a ${diffH}h`
  if (diffD === 1) return 'hier'
  return `il y a ${diffD}j`
}

export function CallbackList({ callbacks: initial }: CallbackListProps) {
  const [callbacks, setCallbacks] = useState(initial)
  const [isPending, startTransition] = useTransition()

  function handleMarkDone(id: string) {
    startTransition(async () => {
      const result = await markRingoverCallback(id)
      if (result.error) toast.error(result.error)
      else {
        toast.success('Rappel effectue')
        setCallbacks((prev) => prev.filter((c) => c.id !== id))
      }
    })
  }

  function handleDismiss(id: string) {
    startTransition(async () => {
      const result = await dismissRingoverCallback(id)
      if (result.error) toast.error(result.error)
      else setCallbacks((prev) => prev.filter((c) => c.id !== id))
    })
  }

  function handleTranscribed(id: string, data: { transcript: string; summary: string | null; sentiment: string | null }) {
    setCallbacks((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, ai_summary: data.summary, ai_sentiment: data.sentiment as RingoverCallbackItem['ai_sentiment'] }
          : c
      )
    )
  }

  if (callbacks.length === 0) {
    return (
      <div className="bg-success/5 border border-success/20 rounded-xl p-6 text-center">
        <CheckCircle className="w-8 h-8 text-success mx-auto mb-2" />
        <p className="text-sm font-medium text-success">Aucun rappel en attente</p>
        <p className="text-xs text-muted mt-1">Tous les appels manques ont ete traites</p>
      </div>
    )
  }

  return (
    <div className="bg-surface rounded-xl border border-warning/30">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <PhoneMissed className="w-4 h-4 text-warning" />
          Personnes a rappeler ({callbacks.length})
        </h3>
      </div>
      <div className="divide-y divide-border">
        {callbacks.map((cb) => (
          <div key={cb.id} className="p-4 hover:bg-surface-hover/50 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{cb.caller_name || formatPhoneFr(cb.caller_number)}</span>
                  {cb.caller_name && <span className="text-xs text-muted">{formatPhoneFr(cb.caller_number)}</span>}
                  {cb.has_voicemail && (
                    <span className="flex items-center gap-1 text-xs text-purple-500 bg-purple-500/10 px-2 py-0.5 rounded-full">
                      <Voicemail className="w-3 h-3" />
                      Message vocal
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo(cb.start_time)}</span>
                  {cb.wait_time > 0 && <span>Attente: {formatDurationHuman(cb.wait_time)}</span>}
                </div>
                {cb.voicemail_url && (
                  <div className="mt-2 flex items-center gap-2">
                    <audio controls preload="none" className="h-8 w-full max-w-xs">
                      <source src={cb.voicemail_url} />
                    </audio>
                    <TranscribeButton
                      callId={cb.id}
                      hasAudio={true}
                      alreadyTranscribed={!!cb.ai_summary}
                      onTranscribed={(data) => handleTranscribed(cb.id, data)}
                    />
                  </div>
                )}
                {cb.ai_summary && (
                  <div className="mt-2 p-2 rounded-lg bg-muted/5 border border-border">
                    <div className="flex items-center gap-2 mb-1">
                      {cb.ai_sentiment && (
                        <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${getSentimentColor(cb.ai_sentiment)}`}>
                          {getSentimentLabel(cb.ai_sentiment)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-foreground/80">{cb.ai_summary}</p>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => handleMarkDone(cb.id)} disabled={isPending} className="p-2 rounded-lg bg-success/10 text-success hover:bg-success/20 transition-colors disabled:opacity-50" title="Marquer comme rappele">
                  <PhoneOutgoing className="w-4 h-4" />
                </button>
                <button onClick={() => handleDismiss(cb.id)} disabled={isPending} className="p-2 rounded-lg bg-muted/10 text-muted hover:bg-muted/20 transition-colors disabled:opacity-50" title="Ignorer">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
