'use client'

import { useTransition } from 'react'
import {
  CheckCircle2,
  Loader2,
  Navigation,
  MapPin,
  XCircle,
  Flag,
  RotateCcw,
} from 'lucide-react'
import {
  acknowledgeTicket,
  setTicketOnRoute,
  setTicketOnSite,
  changeTicketStatus,
  changeTicketPriority,
  assignTicket,
  resendInterventionReport,
} from '@/app/(app)/astreinte/tickets/actions'
import { InterventionReportForm } from './intervention-report-form'

interface AssignableMember {
  user_id: string
  label: string
}

interface Props {
  ticketId: string
  currentStatus: string
  currentPriority: string
  currentAssignee: string | null
  assignableMembers: AssignableMember[]
  reportSentAt: string | null
}

export function TicketActions({
  ticketId,
  currentStatus,
  currentPriority,
  currentAssignee,
  assignableMembers,
  reportSentAt,
}: Props) {
  const [pending, startTransition] = useTransition()

  function call(action: () => Promise<unknown>) {
    startTransition(async () => {
      await action()
    })
  }

  const isClosed = currentStatus === 'completed' || currentStatus === 'cancelled'

  return (
    <div className="flex flex-col gap-2 w-full sm:w-auto sm:min-w-[280px]">
      {/* Boutons de transition */}
      <div className="flex flex-wrap gap-2">
        {currentStatus === 'new' && (
          <button
            disabled={pending}
            onClick={() => call(() => acknowledgeTicket(ticketId))}
            className="inline-flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:opacity-90 disabled:opacity-50 shadow-sm"
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Prendre en charge
          </button>
        )}

        {currentStatus === 'acknowledged' && (
          <button
            disabled={pending}
            onClick={() => call(() => setTicketOnRoute(ticketId))}
            className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md text-sm font-semibold hover:opacity-90 disabled:opacity-50 shadow-sm"
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} />}
            En route
          </button>
        )}

        {currentStatus === 'on_route' && (
          <button
            disabled={pending}
            onClick={() => call(() => setTicketOnSite(ticketId))}
            className="inline-flex items-center gap-2 px-3 py-2 bg-amber-600 text-white rounded-md text-sm font-semibold hover:opacity-90 disabled:opacity-50 shadow-sm"
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
            Sur place
          </button>
        )}

        {(currentStatus === 'acknowledged' ||
          currentStatus === 'on_route' ||
          currentStatus === 'on_site' ||
          currentStatus === 'in_progress') && (
          <InterventionReportForm ticketId={ticketId} />
        )}

        {!isClosed && (
          <button
            disabled={pending}
            onClick={() => {
              if (confirm('Annuler ce ticket ?')) {
                call(() => changeTicketStatus(ticketId, 'cancelled'))
              }
            }}
            className="inline-flex items-center gap-2 px-3 py-2 border border-red-300 text-red-700 dark:text-red-400 dark:border-red-800 rounded-md text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
          >
            <XCircle size={14} />
            Annuler
          </button>
        )}

        {currentStatus === 'completed' && (
          <span className="inline-flex items-center gap-2 px-3 py-2 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 rounded-md text-sm font-semibold">
            <CheckCircle2 size={14} />
            Clôturé
          </span>
        )}

        {currentStatus === 'completed' && (
          <button
            disabled={pending}
            onClick={() => call(() => resendInterventionReport(ticketId))}
            className="inline-flex items-center gap-2 px-3 py-2 border rounded-md text-sm font-semibold hover:bg-muted/50 disabled:opacity-50"
            title={reportSentAt ? `Dernier envoi : ${new Date(reportSentAt).toLocaleString('fr-FR')}` : undefined}
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
            {reportSentAt ? 'Renvoyer le compte-rendu' : 'Envoyer le compte-rendu'}
          </button>
        )}
      </div>

      {/* Priorité + Assignation */}
      <div className="grid grid-cols-2 gap-2 mt-1">
        <label className="block">
          <span className="block text-[10px] uppercase tracking-wider font-bold text-muted mb-1 flex items-center gap-1">
            <Flag size={10} />
            Priorité
          </span>
          <select
            disabled={pending}
            value={currentPriority}
            onChange={(e) => call(() => changeTicketPriority(ticketId, e.target.value))}
            className="w-full px-2 py-1.5 border rounded-md text-xs bg-background"
          >
            <option value="low">Faible</option>
            <option value="normal">Normale</option>
            <option value="high">Élevée</option>
            <option value="critical">Critique</option>
          </select>
        </label>

        <label className="block">
          <span className="block text-[10px] uppercase tracking-wider font-bold text-muted mb-1">
            Assignation
          </span>
          <select
            disabled={pending}
            value={currentAssignee ?? ''}
            onChange={(e) => call(() => assignTicket(ticketId, e.target.value || null))}
            className="w-full px-2 py-1.5 border rounded-md text-xs bg-background"
          >
            <option value="">— Non assigné —</option>
            {assignableMembers.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
}
