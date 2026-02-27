'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Phone, User, Calendar, Clock, CheckCircle, PhoneIncoming } from 'lucide-react'
import { toast } from 'sonner'
import {
  getCallStatusLabel,
  getCallStatusColor,
  getSentimentLabel,
  getSentimentColor,
  formatCallDuration,
  maskPhone,
} from '@/lib/sda-utils'
import { markCallbackCompleted } from '@/lib/actions/calls'
import { CallTranscriptView } from './call-transcript'
import type { CallLogWithCategory, CallTranscript } from '@/lib/types/database'

interface CallDetailProps {
  call: CallLogWithCategory
  transcripts: CallTranscript[]
}

function formatDateFr(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function CallDetail({ call, transcripts }: CallDetailProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [callbackDone, setCallbackDone] = useState(call.callback_completed)

  function handleMarkCallback() {
    startTransition(async () => {
      const result = await markCallbackCompleted(call.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Rappel marque comme effectue')
        setCallbackDone(true)
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="bg-surface rounded-xl border border-border p-5">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-primary/10">
            <Phone className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <h2 className="text-xl font-bold">{maskPhone(call.caller_phone)}</h2>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getCallStatusColor(call.status)}`}>
                {getCallStatusLabel(call.status)}
              </span>
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
              {call.sentiment && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getSentimentColor(call.sentiment)}`}>
                  {getSentimentLabel(call.sentiment)}
                </span>
              )}
            </div>

            <div className="flex items-center gap-4 text-sm text-muted flex-wrap">
              {call.agent_name && (
                <span className="flex items-center gap-1.5">
                  <User className="w-4 h-4" />
                  {call.agent_name}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {formatDateFr(call.started_at)}
              </span>
              {call.duration_seconds > 0 && (
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  {formatCallDuration(call.duration_seconds)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Summary card */}
      {call.summary && (
        <div className="bg-surface rounded-xl border border-border p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
            Resume IA
          </h3>
          <p className="text-sm leading-relaxed">{call.summary}</p>
        </div>
      )}

      {/* Action items */}
      {call.action_items && call.action_items.length > 0 && (
        <div className="bg-surface rounded-xl border border-border p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
            Actions a effectuer
          </h3>
          <ul className="space-y-2">
            {call.action_items.map((item, index) => (
              <li key={index} className="flex items-start gap-2">
                <CheckCircle
                  className={`w-4 h-4 mt-0.5 shrink-0 ${
                    item.completed ? 'text-success' : 'text-muted'
                  }`}
                />
                <span className={`text-sm ${item.completed ? 'line-through text-muted' : ''}`}>
                  {item.text}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Callback card */}
      {call.callback_needed && !callbackDone && (
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <PhoneIncoming className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-sm mb-1">Rappel necessaire</h3>
              <p className="text-sm text-muted mb-3">
                Cet appel necessite un rappel. Marquez-le comme effectue une fois le rappel realise.
              </p>
              <button
                onClick={handleMarkCallback}
                disabled={isPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white text-sm gradient-primary hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                {isPending ? 'En cours...' : 'Marquer comme rappele'}
              </button>
            </div>
          </div>
        </div>
      )}

      {callbackDone && call.callback_needed && (
        <div className="bg-success/10 border border-success/30 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-success" />
            <p className="text-sm font-medium text-success">Rappel effectue</p>
          </div>
        </div>
      )}

      {/* Transcript section */}
      <div className="bg-surface rounded-xl border border-border p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-4">
          Transcription
        </h3>
        <CallTranscriptView initialTranscripts={transcripts} callId={call.id} />
      </div>
    </div>
  )
}
