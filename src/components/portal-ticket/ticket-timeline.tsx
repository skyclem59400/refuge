import { History } from 'lucide-react'
import { listTicketEvents } from '@/lib/actions/portal-ticket-events'
import type { PortalTicketType } from '@/lib/types/database'
import { TicketTimelineEvent } from './ticket-timeline-event'

interface Props {
  ticketType: PortalTicketType
  ticketId: string
}

/**
 * Server Component qui récupère et affiche la timeline d'événements
 * d'un ticket portail (création, changements de statut, messages, etc.).
 */
export async function TicketTimeline({ ticketType, ticketId }: Props) {
  const { data: events, error } = await listTicketEvents(ticketType, ticketId)

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <h2 className="font-semibold text-sm mb-4 flex items-center gap-2">
        <History className="w-4 h-4 text-primary" /> Historique du ticket
      </h2>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 italic">
          {error}
        </p>
      )}

      {!error && events.length === 0 && (
        <p className="text-sm italic text-muted">
          Aucun événement enregistré pour ce ticket.
        </p>
      )}

      {!error && events.length > 0 && (
        <div className="border-l-2 border-border ml-4">
          {events.map((e) => (
            <TicketTimelineEvent key={e.id} event={e} />
          ))}
        </div>
      )}
    </div>
  )
}
