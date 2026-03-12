import type { LeaveRequestStatus } from '@/lib/types/database'

const statusConfig: Record<LeaveRequestStatus, { label: string; className: string }> = {
  pending: {
    label: 'En attente',
    className: 'bg-amber-500/15 text-amber-600',
  },
  approved: {
    label: 'Validee',
    className: 'bg-green-500/15 text-green-600',
  },
  refused: {
    label: 'Refusee',
    className: 'bg-danger/15 text-danger',
  },
  cancelled: {
    label: 'Annulee',
    className: 'bg-border text-muted',
  },
}

export function LeaveStatusBadge({ status }: { status: LeaveRequestStatus }) {
  const config = statusConfig[status] ?? statusConfig.pending

  return (
    <span
      className={`inline-block text-[11px] px-2 py-0.5 rounded-full font-medium ${config.className}`}
    >
      {config.label}
    </span>
  )
}
