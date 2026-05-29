'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Send } from 'lucide-react'
import { sendStaffMessage } from '@/lib/actions/portal-ticket-events'
import type { PortalTicketType } from '@/lib/types/database'

interface Props {
  ticketType: PortalTicketType
  ticketId: string
}

const MAX_LEN = 5000

export function StaffMessageForm({ ticketType, ticketId }: Props) {
  const [message, setMessage] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = message.trim()
    if (!trimmed) {
      toast.error('Saisissez un message avant d’envoyer.')
      return
    }
    startTransition(async () => {
      const res = await sendStaffMessage(ticketType, ticketId, trimmed)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success('Message envoyé au demandeur')
      setMessage('')
      router.refresh()
    })
  }

  const remaining = MAX_LEN - message.length

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-card rounded-xl border border-border p-5"
    >
      <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
        <Send className="w-4 h-4 text-primary" /> Envoyer un message au demandeur
      </h2>
      <p className="text-xs text-muted mb-3">
        Le message apparaîtra dans l’espace portail du demandeur. Restez factuel
        et professionnel.
      </p>

      <label htmlFor="staff-message" className="sr-only">
        Votre message
      </label>
      <textarea
        id="staff-message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={5}
        maxLength={MAX_LEN}
        disabled={isPending}
        placeholder="Votre message…"
        className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm resize-y mb-2"
      />

      <div className="flex items-center justify-between gap-3">
        <span
          className={`text-xs ${
            remaining < 100 ? 'text-amber-600' : 'text-muted'
          }`}
        >
          {remaining} caractères restants
        </span>
        <button
          type="submit"
          disabled={isPending || !message.trim()}
          className="px-4 py-2 rounded-lg gradient-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isPending ? 'Envoi…' : 'Envoyer'}
        </button>
      </div>
    </form>
  )
}
