'use client'

import { useState } from 'react'
import { FileAudio, Loader2, Check } from 'lucide-react'
import { toast } from 'sonner'

interface TranscribeButtonProps {
  callId: string
  hasAudio: boolean
  alreadyTranscribed: boolean
  onTranscribed?: (data: {
    transcript: string
    summary: string | null
    sentiment: string | null
    actionItems: { text: string; completed: boolean }[]
  }) => void
}

export function TranscribeButton({ callId, hasAudio, alreadyTranscribed, onTranscribed }: TranscribeButtonProps) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(alreadyTranscribed)

  if (!hasAudio) return null
  if (done) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-success">
        <Check className="w-3 h-3" />
        Transcrit
      </span>
    )
  }

  async function handleTranscribe() {
    setLoading(true)
    try {
      const res = await fetch('/api/ai/transcribe-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Erreur de transcription')
        return
      }

      toast.success('Transcription terminee')
      setDone(true)
      onTranscribed?.(data)
    } catch {
      toast.error('Erreur reseau')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleTranscribe}
      disabled={loading}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium
        bg-secondary/10 text-secondary hover:bg-secondary/20 transition-colors
        disabled:opacity-50 disabled:cursor-not-allowed"
      title="Transcrire l'audio avec l'IA"
    >
      {loading ? (
        <>
          <Loader2 className="w-3 h-3 animate-spin" />
          Transcription...
        </>
      ) : (
        <>
          <FileAudio className="w-3 h-3" />
          Transcrire
        </>
      )}
    </button>
  )
}
