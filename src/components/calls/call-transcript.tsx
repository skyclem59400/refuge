'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCallDuration } from '@/lib/sda-utils'
import type { CallTranscript } from '@/lib/types/database'

interface CallTranscriptProps {
  initialTranscripts: CallTranscript[]
  callId: string
}

export function CallTranscriptView({ initialTranscripts, callId }: CallTranscriptProps) {
  const [transcripts, setTranscripts] = useState<CallTranscript[]>(initialTranscripts)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [transcripts])

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`call-transcripts-${callId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_transcripts',
          filter: `call_log_id=eq.${callId}`,
        },
        (payload) => {
          setTranscripts((prev) => [...prev, payload.new as CallTranscript])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [callId])

  if (transcripts.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-muted">Aucune transcription disponible</p>
      </div>
    )
  }

  return (
    <div ref={scrollRef} className="max-h-96 overflow-y-auto space-y-3 pr-1">
      {transcripts.map((t) => {
        const isAgent = t.speaker === 'agent'
        const timestampFormatted = formatCallDuration(Math.floor(t.timestamp_ms / 1000))

        return (
          <div
            key={t.id}
            className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] px-4 py-2.5 rounded-2xl ${
                isAgent
                  ? 'bg-primary/10 text-text rounded-br-sm'
                  : 'bg-surface border border-border text-text rounded-bl-sm'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-muted">
                  {isAgent ? 'Agent' : 'Appelant'}
                </span>
                <span className="text-xs text-muted">{timestampFormatted}</span>
              </div>
              <p className="text-sm">{t.content}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
