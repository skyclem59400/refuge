'use client'

import { useState, useEffect } from 'react'
import { PhoneIncoming, PhoneMissed, PhoneOutgoing, Voicemail, Phone, Clock, Calendar, Headphones, ChevronDown, CheckCircle2, Circle, Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { getRingoverStatusLabel, getRingoverStatusColor, formatPhoneFr, formatDurationHuman, getSentimentLabel, getSentimentColor } from '@/lib/sda-utils'
import { fetchRecordingUrl } from '@/lib/actions/ringover-sync'
import { TranscribeButton } from '@/components/calls/accueil/transcribe-button'
import type { RingoverCallRecord } from '@/lib/types/database'

interface AccueilCallListProps {
  initialCalls: RingoverCallRecord[]
  establishmentId: string
  filter: 'no-audio' | 'with-audio'
  title: string
  icon: 'phone' | 'headphones'
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

/** Check if call has audio content — only when an actual URL is available */
function callHasAudio(call: RingoverCallRecord): boolean {
  return !!(call.voicemail_url || call.recording_url)
}

function filterCalls(calls: RingoverCallRecord[], filter: 'no-audio' | 'with-audio'): RingoverCallRecord[] {
  return filter === 'with-audio'
    ? calls.filter((c) => callHasAudio(c))
    : calls.filter((c) => !callHasAudio(c))
}

export function AccueilCallList({ initialCalls, establishmentId, filter, title, icon }: AccueilCallListProps) {
  const [allCalls, setAllCalls] = useState<RingoverCallRecord[]>(initialCalls)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [fetchingRecording, setFetchingRecording] = useState<string | null>(null)

  useEffect(() => { setAllCalls(initialCalls) }, [initialCalls])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`ringover-calls-${filter}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ringover_calls', filter: `establishment_id=eq.${establishmentId}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setAllCalls((prev) => [payload.new as RingoverCallRecord, ...prev].slice(0, 200))
        } else if (payload.eventType === 'UPDATE') {
          setAllCalls((prev) => prev.map((c) => c.id === (payload.new as RingoverCallRecord).id ? (payload.new as RingoverCallRecord) : c))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [establishmentId, filter])

  function handleTranscribed(callId: string, data: {
    transcript: string
    summary: string | null
    sentiment: string | null
    actionItems: { text: string; completed: boolean }[]
  }) {
    setAllCalls((prev) =>
      prev.map((c) =>
        c.id === callId
          ? {
              ...c,
              transcript: data.transcript,
              ai_summary: data.summary,
              ai_sentiment: data.sentiment as RingoverCallRecord['ai_sentiment'],
              ai_action_items: data.actionItems,
              transcribed_at: new Date().toISOString(),
            }
          : c
      )
    )
  }

  async function handleFetchRecording(callId: string) {
    setFetchingRecording(callId)
    try {
      const result = await fetchRecordingUrl(callId)
      if (result.data?.recording_url) {
        const url = result.data.recording_url
        setAllCalls((prev) =>
          prev.map((c) => {
            if (c.id !== callId) return c
            // The URL could be a recording or voicemail — update whichever is appropriate
            return url.includes('/messages/')
              ? { ...c, voicemail_url: url }
              : { ...c, recording_url: url }
          })
        )
        toast.success('Audio recupere')
      } else {
        toast.error('Audio non disponible via l\'API Ringover')
      }
    } catch {
      toast.error('Erreur lors de la recuperation')
    } finally {
      setFetchingRecording(null)
    }
  }

  const calls = filterCalls(allCalls, filter)
  const TitleIcon = icon === 'headphones' ? Headphones : Phone

  if (calls.length === 0) {
    return (
      <div className="bg-surface rounded-xl border border-border">
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <TitleIcon className="w-4 h-4 text-muted" />
            {title} (0)
          </h3>
        </div>
        <div className="p-8 text-center">
          <TitleIcon className="w-8 h-8 text-muted mx-auto mb-2" />
          <p className="text-muted text-sm">Aucun appel</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-surface rounded-xl border border-border flex flex-col">
      <div className="p-4 border-b border-border shrink-0">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <TitleIcon className="w-4 h-4 text-muted" />
          {title} ({calls.length})
        </h3>
      </div>
      <div className="divide-y divide-border overflow-y-auto max-h-[600px]">
        {calls.map((call) => {
          const date = new Date(call.start_time)
          const audioUrl = call.recording_url || call.voicemail_url
          const hasUrl = !!audioUrl
          const hasFlag = call.has_recording || call.has_voicemail
          const hasContent = hasUrl || hasFlag || !!call.transcript
          const isExpanded = expandedId === call.id

          return (
            <div key={call.id}>
              <div
                className={`p-3 transition-colors ${hasContent ? 'cursor-pointer hover:bg-surface-hover/50' : ''}`}
                onClick={() => hasContent && setExpandedId(isExpanded ? null : call.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <StatusIcon status={call.status} />
                      <span className="font-medium text-sm">{call.caller_name || formatPhoneFr(call.caller_number)}</span>
                      {call.caller_name && <span className="text-xs text-muted">{formatPhoneFr(call.caller_number)}</span>}
                      <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-medium ${getRingoverStatusColor(call.status)}`}>{getRingoverStatusLabel(call.status)}</span>
                      {call.has_voicemail && <span className="text-[11px] text-purple-500 bg-purple-500/10 px-1.5 py-0.5 rounded-full">Messagerie</span>}
                      {call.has_recording && !call.has_voicemail && <span className="text-[11px] text-muted bg-muted/10 px-1.5 py-0.5 rounded-full">Enregistrement</span>}
                      {call.ai_sentiment && (
                        <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${getSentimentColor(call.ai_sentiment)}`}>
                          {getSentimentLabel(call.ai_sentiment)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted flex-wrap">
                      {call.agent_name && <span>Agent: {call.agent_name}</span>}
                      {call.duration > 0 && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDurationHuman(call.duration)}</span>}
                      {call.wait_time > 0 && <span className={call.wait_time > 30 ? 'text-warning' : ''}>Attente: {formatDurationHuman(call.wait_time)}</span>}
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    {call.ai_summary && !isExpanded && (
                      <p className="mt-1 text-xs text-foreground/60 truncate">{call.ai_summary}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {call.callback_needed && !call.callback_completed && (
                      <span className="px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-warning/15 text-warning">A rappeler</span>
                    )}
                    {hasContent && (
                      <ChevronDown className={`w-4 h-4 text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div className="px-3 pb-3 space-y-3 border-t border-border/50 bg-surface-hover/20">
                  <div className="pt-3" />

                  {/* Audio player — show if URL available */}
                  {hasUrl && (
                    <div className="flex items-center gap-3">
                      <audio controls preload="metadata" className="h-8 w-full max-w-sm">
                        <source src={audioUrl} />
                      </audio>
                      <TranscribeButton
                        callId={call.id}
                        hasAudio={true}
                        alreadyTranscribed={!!call.transcribed_at}
                        onTranscribed={(data) => handleTranscribed(call.id, data)}
                      />
                    </div>
                  )}

                  {/* No URL but flag is set — offer to fetch recording */}
                  {!hasUrl && hasFlag && call.duration >= 7 && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/5 border border-border">
                      <Headphones className="w-4 h-4 text-muted shrink-0" />
                      <p className="text-xs text-muted flex-1">
                        {call.has_recording ? 'Enregistrement disponible' : 'Message vocal disponible'} — cliquez pour charger
                      </p>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleFetchRecording(call.id) }}
                        disabled={fetchingRecording === call.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-secondary/10 text-secondary hover:bg-secondary/20 transition-colors disabled:opacity-50"
                      >
                        {fetchingRecording === call.id ? (
                          <><Loader2 className="w-3 h-3 animate-spin" />Chargement...</>
                        ) : (
                          <><Download className="w-3 h-3" />Charger l&apos;audio</>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Transcript */}
                  {call.transcript && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">Transcription</p>
                      <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{call.transcript}</p>
                    </div>
                  )}

                  {/* AI Summary */}
                  {call.ai_summary && (
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Resume IA</p>
                        {call.ai_sentiment && (
                          <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${getSentimentColor(call.ai_sentiment)}`}>
                            {getSentimentLabel(call.ai_sentiment)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-foreground/80">{call.ai_summary}</p>
                    </div>
                  )}

                  {/* Action items */}
                  {call.ai_action_items && call.ai_action_items.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">Actions a effectuer</p>
                      <ul className="space-y-1">
                        {call.ai_action_items.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            {item.completed
                              ? <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                              : <Circle className="w-4 h-4 text-muted shrink-0 mt-0.5" />
                            }
                            <span className={item.completed ? 'line-through text-muted' : 'text-foreground/80'}>{item.text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
