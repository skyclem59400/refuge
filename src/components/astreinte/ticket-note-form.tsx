'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { Send, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { addTicketNote, type TicketActionState } from '@/app/(app)/astreinte/tickets/actions'

const initialState: TicketActionState = { status: 'idle' }

export function TicketNoteForm({ ticketId }: { ticketId: string }) {
  const [visibleToDeclarant, setVisibleToDeclarant] = useState(false)
  const [state, action, pending] = useActionState(addTicketNote, initialState)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.status === 'success') {
      formRef.current?.reset()
    }
  }, [state])

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <input type="hidden" name="ticket_id" value={ticketId} />
      <input
        type="hidden"
        name="visible_to_declarant"
        value={visibleToDeclarant ? 'true' : 'false'}
      />

      <textarea
        name="message"
        rows={3}
        required
        minLength={2}
        maxLength={2000}
        placeholder={
          visibleToDeclarant
            ? 'Message visible par le déclarant…'
            : 'Note interne SDA (non visible par le déclarant)…'
        }
        className="w-full px-3 py-2 border rounded-md text-sm bg-background resize-none"
      />

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setVisibleToDeclarant(!visibleToDeclarant)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold transition ${
              visibleToDeclarant
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
            }`}
          >
            {visibleToDeclarant ? (
              <>
                <Eye size={12} />
                Visible déclarant
              </>
            ) : (
              <>
                <EyeOff size={12} />
                Note interne
              </>
            )}
          </button>
          <span className="text-muted">
            {visibleToDeclarant
              ? '(le déclarant verra ce message dans son portail)'
              : '(seule la SDA voit ce message)'}
          </span>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {pending ? '…' : <Send size={12} />}
          Ajouter
        </button>
      </div>

      {state.status === 'success' && (
        <div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-400">
          <CheckCircle2 size={12} />
          Note ajoutée.
        </div>
      )}
      {state.status === 'error' && (
        <div className="flex items-center gap-2 text-xs text-red-700 dark:text-red-400">
          <AlertCircle size={12} />
          {state.message}
        </div>
      )}
    </form>
  )
}
