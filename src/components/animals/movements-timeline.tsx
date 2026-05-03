'use client'

import {
  Truck,
  Home,
  House,
  Heart,
  HeartCrack,
  Bookmark,
  BookmarkX,
  ArrowLeft,
  ArrowRight,
  Mail,
  Phone,
  MapPin,
  StickyNote,
  Clock,
} from 'lucide-react'
import { getMovementLabel } from '@/lib/sda-utils'
import type { AnimalMovement, MovementType } from '@/lib/types/database'

interface MovementWithRelations extends AnimalMovement {
  related_client?: { id: string; name: string } | null
}

interface MovementsTimelineProps {
  movements: MovementWithRelations[]
  userNames: Record<string, string>
}

// Per-type visual config: icon + accent color (Tailwind tokens already in globals)
const movementVisuals: Record<MovementType, { icon: typeof Truck; bg: string; ring: string; text: string; badge: string }> = {
  pound_entry:           { icon: Truck,        bg: 'bg-amber-500',   ring: 'ring-amber-500/30',   text: 'text-amber-600',   badge: 'bg-amber-500/15 text-amber-600 border-amber-500/30' },
  shelter_transfer:      { icon: House,        bg: 'bg-blue-500',    ring: 'ring-blue-500/30',    text: 'text-blue-600',    badge: 'bg-blue-500/15 text-blue-600 border-blue-500/30' },
  foster_placement:      { icon: Home,         bg: 'bg-purple-500',  ring: 'ring-purple-500/30',  text: 'text-purple-600',  badge: 'bg-purple-500/15 text-purple-600 border-purple-500/30' },
  adoption:              { icon: Heart,        bg: 'bg-emerald-500', ring: 'ring-emerald-500/30', text: 'text-emerald-600', badge: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' },
  return_to_owner:       { icon: ArrowLeft,    bg: 'bg-cyan-500',    ring: 'ring-cyan-500/30',    text: 'text-cyan-600',    badge: 'bg-cyan-500/15 text-cyan-600 border-cyan-500/30' },
  transfer_out:          { icon: ArrowRight,   bg: 'bg-slate-500',   ring: 'ring-slate-500/30',   text: 'text-slate-600',   badge: 'bg-slate-500/15 text-slate-600 border-slate-500/30' },
  death:                 { icon: HeartCrack,   bg: 'bg-red-700',     ring: 'ring-red-700/30',     text: 'text-red-700',     badge: 'bg-red-700/15 text-red-700 border-red-700/30' },
  euthanasia:            { icon: HeartCrack,   bg: 'bg-red-500',     ring: 'ring-red-500/30',     text: 'text-red-500',     badge: 'bg-red-500/15 text-red-500 border-red-500/30' },
  reservation:           { icon: Bookmark,     bg: 'bg-amber-400',   ring: 'ring-amber-400/30',   text: 'text-amber-500',   badge: 'bg-amber-400/15 text-amber-500 border-amber-400/30' },
  reservation_cancelled: { icon: BookmarkX,    bg: 'bg-muted',       ring: 'ring-muted/30',       text: 'text-muted',       badge: 'bg-muted/15 text-muted border-muted/30' },
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ''
  // Only show the time if the original timestamp has a meaningful HH:MM (i.e. not midnight UTC for date-only fields)
  const hours = d.getHours()
  const minutes = d.getMinutes()
  if (hours === 0 && minutes === 0) return ''
  return `à ${String(hours).padStart(2, '0')}h${String(minutes).padStart(2, '0')}`
}

function formatElapsed(fromIso: string): string {
  const from = new Date(fromIso)
  const now = new Date()
  const diffMs = now.getTime() - from.getTime()
  if (diffMs < 0) return ''
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 60) return `il y a ${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `il y a ${diffH} h`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 30) return `il y a ${diffD} jour${diffD > 1 ? 's' : ''}`
  const diffMo = Math.floor(diffD / 30)
  if (diffMo < 12) {
    const remDays = diffD - diffMo * 30
    if (remDays === 0) return `il y a ${diffMo} mois`
    return `il y a ${diffMo} mois ${remDays} j`
  }
  const diffY = Math.floor(diffMo / 12)
  const remMo = diffMo - diffY * 12
  if (remMo === 0) return `il y a ${diffY} an${diffY > 1 ? 's' : ''}`
  return `il y a ${diffY} an${diffY > 1 ? 's' : ''} ${remMo} mois`
}

function avatarInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || '')
    .join('') || '?'
}

export function MovementsTimeline({ movements, userNames }: Readonly<MovementsTimelineProps>) {
  if (movements.length === 0) {
    return <div className="bg-surface rounded-xl border border-border p-8 text-center text-sm text-muted">Aucun mouvement enregistré</div>
  }

  return (
    <ol className="relative space-y-4">
      {movements.map((mv, idx) => {
        const visual = movementVisuals[mv.type] ?? movementVisuals.pound_entry
        const Icon = visual.icon
        const linkedName = mv.related_client?.name || mv.person_name
        const submittedBy = (mv.created_by && userNames[mv.created_by]) || null
        const isLast = idx === movements.length - 1

        return (
          <li key={mv.id} className="relative flex gap-4">
            {/* Vertical connector line on the left, behind the icon */}
            {!isLast && (
              <span aria-hidden className="absolute left-[19px] top-12 bottom-0 w-px bg-border -mb-4" />
            )}

            {/* Icon circle */}
            <div className={`relative shrink-0 w-10 h-10 rounded-full ${visual.bg} ring-4 ${visual.ring} flex items-center justify-center text-white shadow-sm`}>
              <Icon className="w-5 h-5" />
            </div>

            {/* Card */}
            <div className="flex-1 min-w-0 bg-surface rounded-xl border border-border p-4">
              {/* Header: date + badge */}
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="text-sm">
                  <div className="font-semibold capitalize">
                    {formatDateTime(mv.date)}
                    <span className="text-xs font-normal text-muted ml-1.5">{formatTime(mv.date)}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-muted mt-0.5">
                    <Clock className="w-3 h-3" />
                    {formatElapsed(mv.date)}
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${visual.badge}`}>
                  <Icon className="w-3.5 h-3.5" />
                  {getMovementLabel(mv.type)}
                </span>
              </div>

              {/* Linked person block */}
              {linkedName && (
                <div className="mt-3 flex items-start gap-3 p-3 rounded-lg bg-surface-dark/50 border border-border/50">
                  <div className={`shrink-0 w-9 h-9 rounded-full ${visual.bg} text-white flex items-center justify-center text-xs font-bold`}>
                    {avatarInitials(linkedName)}
                  </div>
                  <div className="flex-1 min-w-0 text-sm">
                    <div className={`font-semibold ${visual.text}`}>{linkedName}</div>
                    {(mv.person_contact || mv.destination) && (
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-muted">
                        {mv.person_contact?.includes('@') && (
                          <a href={`mailto:${mv.person_contact}`} className="inline-flex items-center gap-1 hover:text-primary">
                            <Mail className="w-3 h-3" /> {mv.person_contact}
                          </a>
                        )}
                        {mv.person_contact && !mv.person_contact.includes('@') && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {mv.person_contact}
                          </span>
                        )}
                        {mv.destination && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {mv.destination}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Notes */}
              {mv.notes && (
                <div className="mt-3 flex items-start gap-2 text-xs text-muted">
                  <StickyNote className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{mv.notes}</p>
                </div>
              )}

              {/* Footer: saisi par */}
              {submittedBy && (
                <div className="mt-3 pt-3 border-t border-border/50 text-[11px] text-muted">
                  Saisi par <span className="font-medium text-text">{submittedBy}</span>
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
