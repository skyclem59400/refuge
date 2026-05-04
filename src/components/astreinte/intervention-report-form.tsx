'use client'

import { useActionState, useState } from 'react'
import { Loader2, FileText, AlertCircle, CheckCircle2 } from 'lucide-react'
import {
  completeInterventionWithReport,
  type TicketActionState,
} from '@/app/(app)/astreinte/tickets/actions'

interface Props {
  ticketId: string
}

const OUTCOMES = [
  { value: 'animal_recovered', label: 'Animal pris en charge' },
  { value: 'transferred_owner', label: 'Restitué au propriétaire' },
  { value: 'not_found', label: 'Animal non trouvé' },
  { value: 'refused', label: 'Prise en charge refusée' },
  { value: 'deceased', label: 'Animal décédé' },
  { value: 'other', label: 'Autre' },
]

const DESTINATIONS = [
  { value: 'refuge_sda', label: 'Refuge SDA d’Estourmel' },
  { value: 'veterinary', label: 'Clinique vétérinaire' },
  { value: 'owner_returned', label: 'Restitué au propriétaire' },
  { value: 'on_site_release', label: 'Relâché sur place' },
  { value: 'euthanasia', label: 'Euthanasie' },
  { value: 'other', label: 'Autre' },
]

export function InterventionReportForm({ ticketId }: Props) {
  const initialState: TicketActionState = { status: 'idle' }
  const [state, formAction, pending] = useActionState(
    completeInterventionWithReport,
    initialState
  )
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-md text-sm font-semibold hover:opacity-90 shadow-sm"
      >
        <FileText size={14} />
        Clôturer & envoyer compte-rendu
      </button>
    )
  }

  if (state.status === 'success') {
    return (
      <div className="rounded-md border border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-800 p-3 text-sm text-green-800 dark:text-green-300 flex items-start gap-2">
        <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
        <span>{state.message ?? 'Compte-rendu envoyé.'}</span>
      </div>
    )
  }

  return (
    <form
      action={formAction}
      className="rounded-md border bg-card p-4 space-y-3 shadow-sm w-full max-w-2xl"
    >
      <input type="hidden" name="ticket_id" value={ticketId} />

      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <FileText size={14} />
          Compte-rendu d&apos;intervention
        </h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-muted hover:text-foreground"
        >
          Annuler
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-[10px] uppercase tracking-wider font-bold text-muted mb-1">
            Issue de l&apos;intervention
          </span>
          <select
            name="outcome"
            required
            defaultValue=""
            className="w-full px-2 py-1.5 border rounded-md text-sm bg-background"
          >
            <option value="" disabled>— Sélectionner —</option>
            {OUTCOMES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block text-[10px] uppercase tracking-wider font-bold text-muted mb-1">
            Destination
          </span>
          <select
            name="destination"
            required
            defaultValue=""
            className="w-full px-2 py-1.5 border rounded-md text-sm bg-background"
          >
            <option value="" disabled>— Sélectionner —</option>
            {DESTINATIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="block text-[10px] uppercase tracking-wider font-bold text-muted mb-1">
          Observations terrain
        </span>
        <textarea
          name="comments"
          required
          minLength={2}
          maxLength={5000}
          rows={5}
          placeholder="Conditions de l'intervention, état de l'animal, contacts pris sur place, points de vigilance…"
          className="w-full px-2 py-2 border rounded-md text-sm bg-background"
        />
      </label>

      {state.status === 'error' && (
        <div className="rounded-md border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-400 flex items-start gap-2">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{state.message}</span>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md text-sm font-semibold hover:opacity-90 disabled:opacity-50 shadow-sm"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
          {pending ? 'Génération du compte-rendu…' : 'Clôturer & envoyer'}
        </button>
      </div>

      <p className="text-[11px] text-muted">
        Le compte-rendu sera envoyé en PDF au déclarant + en copie à fourriere@sda-nord.com.
      </p>
    </form>
  )
}
