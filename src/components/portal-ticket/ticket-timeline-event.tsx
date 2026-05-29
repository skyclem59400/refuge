import {
  Sparkles,
  ArrowRightLeft,
  MessageSquare,
  Send,
  Paperclip,
  Cog,
} from 'lucide-react'
import type {
  PortalTicketEventType,
  PortalTicketEventWithActor,
  PortalTicketEventRole,
} from '@/lib/types/database'

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return "à l'instant"
  if (diffMin < 60) return `il y a ${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `il y a ${diffH} h`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `il y a ${diffD} j`
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const ICON_META: Record<
  PortalTicketEventType,
  { Icon: typeof Sparkles; bg: string; fg: string }
> = {
  created: { Icon: Sparkles, bg: 'bg-blue-500/15', fg: 'text-blue-600' },
  status_change: {
    Icon: ArrowRightLeft,
    bg: 'bg-amber-500/15',
    fg: 'text-amber-700',
  },
  comment_user: {
    Icon: MessageSquare,
    bg: 'bg-violet-500/15',
    fg: 'text-violet-700',
  },
  message_staff: { Icon: Send, bg: 'bg-emerald-500/15', fg: 'text-emerald-700' },
  attachment_added: {
    Icon: Paperclip,
    bg: 'bg-slate-500/15',
    fg: 'text-slate-600',
  },
}

const ROLE_LABELS: Record<PortalTicketEventRole, string> = {
  user: 'Demandeur',
  staff: 'Équipe SDA',
  system: 'Système',
}

// Status FR labels — accept any string and try to map, fallback to raw value.
const STATUS_FR: Record<string, string> = {
  // Adoption / volunteer
  pending: 'À traiter',
  qualified: 'Qualifiée',
  interview_scheduled: 'Entretien planifié',
  accepted: 'Acceptée',
  declined: 'Refusée',
  archived: 'Archivée',
  // Abuse reports
  new: 'Nouveau',
  investigating: 'En cours',
  transmitted_authorities: 'Transmis autorités',
  on_site_intervention: 'Intervention sur place',
  resolved: 'Résolu',
  unfounded: 'Non-fondé',
}

function labelStatus(v: unknown): string {
  if (typeof v !== 'string') return '—'
  return STATUS_FR[v] ?? v
}

function getString(p: Record<string, unknown>, key: string): string | null {
  const v = p[key]
  return typeof v === 'string' && v.trim() ? v : null
}

interface Props {
  event: PortalTicketEventWithActor
}

export function TicketTimelineEvent({ event }: Props) {
  const { Icon, bg, fg } = ICON_META[event.event_type] ?? ICON_META.created

  const actorLabel =
    event.actor_name ||
    event.actor_email ||
    ROLE_LABELS[event.performed_by_role]

  let body: React.ReactNode = null

  switch (event.event_type) {
    case 'created': {
      const ticketNumber = getString(event.payload, 'ticket_number')
      body = (
        <p className="text-sm">
          <span className="font-medium">Demande créée</span>
          {ticketNumber && (
            <>
              {' · '}
              <span className="font-mono text-xs">{ticketNumber}</span>
            </>
          )}
        </p>
      )
      break
    }
    case 'status_change': {
      const from = labelStatus(event.payload.from)
      const to = labelStatus(event.payload.to)
      body = (
        <p className="text-sm">
          <span className="font-medium">Statut changé</span> : {from}
          <span className="mx-1.5 text-muted">→</span>
          <span className="font-semibold">{to}</span>
        </p>
      )
      break
    }
    case 'comment_user': {
      const message = getString(event.payload, 'message')
      body = (
        <div>
          <p className="text-sm font-medium mb-1">Message du demandeur</p>
          {message && (
            <p className="text-sm whitespace-pre-wrap bg-muted-bg/50 rounded-md p-3 border border-border">
              {message}
            </p>
          )}
        </div>
      )
      break
    }
    case 'message_staff': {
      const message = getString(event.payload, 'message')
      const sender = getString(event.payload, 'sender_name')
      body = (
        <div>
          <p className="text-sm font-medium mb-1">
            Message équipe SDA
            {sender && (
              <span className="text-muted font-normal"> · par {sender}</span>
            )}
          </p>
          {message && (
            <p className="text-sm whitespace-pre-wrap bg-emerald-500/5 rounded-md p-3 border border-emerald-500/20">
              {message}
            </p>
          )}
        </div>
      )
      break
    }
    case 'attachment_added': {
      const filename = getString(event.payload, 'filename')
      body = (
        <p className="text-sm">
          <span className="font-medium">Pièce jointe ajoutée</span>
          {filename && <span className="text-muted"> · {filename}</span>}
        </p>
      )
      break
    }
    default:
      body = <p className="text-sm">Événement</p>
  }

  return (
    <div className="pl-6 pb-5 relative">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center -ml-4 absolute top-0 left-0 ${bg} ${fg}`}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="ml-6">
        {body}
        <div className="mt-1 flex items-center gap-2 text-xs text-muted">
          <span>{timeAgo(event.created_at)}</span>
          <span className="text-border">·</span>
          <span className="inline-flex items-center gap-1">
            {event.performed_by_role === 'system' && (
              <Cog className="w-3 h-3" />
            )}
            {actorLabel}
          </span>
        </div>
      </div>
    </div>
  )
}
