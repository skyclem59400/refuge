import { getStatusLabel, getStatusColor, getStatusColorOverlay, getSpeciesLabel } from '@/lib/sda-utils'

interface AnimalStatusBadgeProps {
  status: string
}

export function AnimalStatusBadge({ status, overlay }: AnimalStatusBadgeProps & { overlay?: boolean }) {
  const baseStyle = overlay
    ? getStatusColorOverlay(status)
    : getStatusColor(status)

  return (
    <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-semibold ${baseStyle}`}>
      {getStatusLabel(status)}
    </span>
  )
}

interface SpeciesBadgeProps {
  species: string
}

export function SpeciesBadge({ species }: SpeciesBadgeProps) {
  const color = species === 'cat'
    ? 'bg-purple-500/15 text-purple-500'
    : 'bg-amber-500/15 text-amber-500'

  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {getSpeciesLabel(species)}
    </span>
  )
}
