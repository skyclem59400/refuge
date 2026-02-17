import { getStatusLabel, getTypeLabel } from '@/lib/utils'

export function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: 'bg-muted/15 text-muted',
    sent: 'bg-info/15 text-info',
    paid: 'bg-success/15 text-success',
    cancelled: 'bg-danger/15 text-danger',
  }

  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colors[status] || colors.draft}`}>
      {getStatusLabel(status)}
    </span>
  )
}

export function TypeBadge({ type }: { type: string }) {
  const color = type === 'facture'
    ? 'bg-success/15 text-success'
    : 'bg-warning/15 text-warning'

  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {getTypeLabel(type)}
    </span>
  )
}
