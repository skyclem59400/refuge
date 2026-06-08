'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays, Check, Clock, AlertCircle, HardHat, User } from 'lucide-react'

// Types alignés sur le retour de getOutingsCalendar.
interface CalendarAssignment {
  id: string
  animal_id: string
  assigned_to: string | null
  partner_id: string | null
  date: string
  outing_id: string | null
  notes: string | null
  animals: { id: string; name: string; species: string; photo_url: string | null }
}

interface CalendarOuting {
  id: string
  animal_id: string
  walked_by: string | null
  started_at: string
  ended_at: string | null
  duration_minutes: number | null
  is_tig: boolean
  tig_walker_name: string | null
  rating: number | null
  animals: { id: string; name: string; species: string; photo_url: string | null }
}

interface OutingPartner { id: string; name: string }

interface Props {
  initialAssignments: CalendarAssignment[]
  initialOutings: CalendarOuting[]
  userNames: Record<string, string>
  partners: OutingPartner[]
  /** ISO date YYYY-MM-DD lundi de la semaine initialement affichée. */
  initialWeekStart: string
}

const DAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

function isoDay(date: Date): string {
  return date.toISOString().split('T')[0]
}

function mondayOf(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay() // 0 = dimanche, 1 = lundi…
  const offset = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + offset)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

export function OutingsCalendarView({
  initialAssignments,
  initialOutings,
  userNames,
  partners,
  initialWeekStart,
}: Readonly<Props>) {
  const [weekStartIso, setWeekStartIso] = useState(initialWeekStart)
  const weekStart = useMemo(() => new Date(`${weekStartIso}T00:00:00`), [weekStartIso])
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const today = isoDay(new Date())

  const partnerMap = useMemo(() => new Map(partners.map((p) => [p.id, p.name])), [partners])

  // On indexe les sorties par animal_id pour pouvoir "matcher" une assignation
  // réalisée (outing_id NOT NULL) vers son outing — sinon on n'affiche que
  // l'assignation pour éviter le doublon.
  const outingIdsAlreadyMatched = useMemo(() => {
    const set = new Set<string>()
    for (const a of initialAssignments) {
      if (a.outing_id) set.add(a.outing_id)
    }
    return set
  }, [initialAssignments])

  /** Évènements d'un jour donné, regroupés par animal pour lisibilité. */
  function eventsForDay(dateIso: string) {
    const assignments = initialAssignments.filter((a) => a.date === dateIso)
    const outings = initialOutings.filter((o) => o.started_at.startsWith(dateIso) && !outingIdsAlreadyMatched.has(o.id))

    const items: Array<
      | { kind: 'assignment'; data: CalendarAssignment }
      | { kind: 'outing'; data: CalendarOuting }
    > = [
      ...assignments.map((a) => ({ kind: 'assignment' as const, data: a })),
      ...outings.map((o) => ({ kind: 'outing' as const, data: o })),
    ]

    items.sort((a, b) => {
      const ta = a.kind === 'outing' ? a.data.started_at : `${a.data.date}T00:00`
      const tb = b.kind === 'outing' ? b.data.started_at : `${b.data.date}T00:00`
      return ta.localeCompare(tb)
    })
    return items
  }

  function shiftWeek(deltaWeeks: number) {
    setWeekStartIso(isoDay(addDays(weekStart, deltaWeeks * 7)))
  }

  function goToToday() {
    setWeekStartIso(isoDay(mondayOf(new Date())))
  }

  function whoLabel(a: CalendarAssignment): string {
    if (a.assigned_to) return userNames[a.assigned_to] || 'Bénévole'
    if (a.partner_id) return partnerMap.get(a.partner_id) || 'Partenaire'
    return 'Non assigné'
  }

  function outingWhoLabel(o: CalendarOuting): string {
    if (o.is_tig) return o.tig_walker_name ? `TIG · ${o.tig_walker_name}` : 'TIG'
    return o.walked_by ? userNames[o.walked_by] || 'Bénévole' : 'Bénévole'
  }

  // Total events sur la semaine — pour le résumé en haut.
  const weekStats = useMemo(() => {
    let planned = 0
    let done = 0
    let overdue = 0
    for (const d of weekDates) {
      const iso = isoDay(d)
      for (const e of eventsForDay(iso)) {
        if (e.kind === 'outing') done++
        else if (iso < today) overdue++
        else planned++
      }
    }
    return { planned, done, overdue }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekDates, initialAssignments, initialOutings])

  return (
    <div className="space-y-4">
      {/* Header navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shiftWeek(-1)}
            className="p-2 rounded-lg hover:bg-surface-hover transition-colors"
            aria-label="Semaine précédente"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={goToToday}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-surface border border-border hover:border-primary/30 transition-colors"
          >
            Aujourd&apos;hui
          </button>
          <button
            type="button"
            onClick={() => shiftWeek(1)}
            className="p-2 rounded-lg hover:bg-surface-hover transition-colors"
            aria-label="Semaine suivante"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="ml-3 flex items-center gap-2 text-sm">
            <CalendarDays className="w-4 h-4 text-primary" />
            <span className="font-semibold">
              Semaine du {weekDates[0].toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' })} au {weekDates[6].toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-success" /> {weekStats.done} fait{weekStats.done > 1 ? 's' : ''}</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary" /> {weekStats.planned} prévu{weekStats.planned > 1 ? 's' : ''}</span>
          {weekStats.overdue > 0 && (
            <span className="flex items-center gap-1.5 text-warning"><span className="w-2.5 h-2.5 rounded-full bg-warning" /> {weekStats.overdue} en retard</span>
          )}
        </div>
      </div>

      {/* Grille semaine */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-2 bg-surface rounded-xl border border-border p-2">
        {weekDates.map((d, i) => {
          const iso = isoDay(d)
          const events = eventsForDay(iso)
          const isToday = iso === today
          const isPast = iso < today
          return (
            <div
              key={iso}
              className={`flex flex-col rounded-lg border ${isToday ? 'border-primary bg-primary/5' : 'border-border bg-surface-dark/40'} min-h-[200px]`}
            >
              <div className={`px-2.5 py-2 border-b border-border/50 ${isPast ? 'opacity-60' : ''}`}>
                <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">{DAY_LABELS[i]}</div>
                <div className={`text-lg font-bold ${isToday ? 'text-primary' : ''}`}>{d.getDate()}</div>
              </div>
              <div className="flex-1 p-1.5 space-y-1 overflow-y-auto">
                {events.length === 0 ? (
                  <div className="text-[10px] text-muted/60 text-center py-4">—</div>
                ) : (
                  events.map((e) => {
                    if (e.kind === 'outing') {
                      const o = e.data
                      return (
                        <div
                          key={`o-${o.id}`}
                          className="rounded-md bg-success/10 border border-success/30 px-2 py-1.5 text-[11px] leading-tight"
                          title={`Sortie effectuée — ${o.duration_minutes || '?'} min`}
                        >
                          <div className="flex items-center gap-1 font-semibold text-success">
                            <Check className="w-3 h-3 shrink-0" />
                            <span className="truncate">{o.animals.name}</span>
                          </div>
                          <div className="text-muted flex items-center gap-1 mt-0.5">
                            {o.is_tig && <HardHat className="w-3 h-3 shrink-0 text-amber-500" />}
                            <User className="w-3 h-3 shrink-0" />
                            <span className="truncate">{outingWhoLabel(o)}</span>
                          </div>
                          <div className="text-muted text-[10px] mt-0.5">
                            {formatTime(o.started_at)}
                            {o.duration_minutes ? ` · ${o.duration_minutes}min` : ''}
                          </div>
                        </div>
                      )
                    }
                    const a = e.data
                    const isOverdue = isPast && !a.outing_id
                    const styles = isOverdue
                      ? 'bg-warning/10 border-warning/40 text-warning'
                      : 'bg-primary/10 border-primary/30 text-primary'
                    return (
                      <div
                        key={`a-${a.id}`}
                        className={`rounded-md border ${styles} px-2 py-1.5 text-[11px] leading-tight`}
                        title={a.notes || (isOverdue ? 'Sortie non effectuée' : 'Sortie prévue')}
                      >
                        <div className="flex items-center gap-1 font-semibold">
                          {isOverdue ? <AlertCircle className="w-3 h-3 shrink-0" /> : <Clock className="w-3 h-3 shrink-0" />}
                          <span className="truncate">{a.animals.name}</span>
                        </div>
                        <div className="text-muted flex items-center gap-1 mt-0.5">
                          <User className="w-3 h-3 shrink-0" />
                          <span className="truncate">{whoLabel(a)}</span>
                        </div>
                        {a.notes && (
                          <div className="text-muted text-[10px] mt-0.5 line-clamp-2 italic">{a.notes}</div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Légende */}
      <div className="flex flex-wrap gap-3 text-[11px] text-muted">
        <span className="flex items-center gap-1.5"><Check className="w-3 h-3 text-success" /> Sortie effectuée</span>
        <span className="flex items-center gap-1.5"><Clock className="w-3 h-3 text-primary" /> Sortie planifiée</span>
        <span className="flex items-center gap-1.5"><AlertCircle className="w-3 h-3 text-warning" /> Planifiée non effectuée</span>
        <span className="flex items-center gap-1.5"><HardHat className="w-3 h-3 text-amber-500" /> Travail d&apos;intérêt général (TIG)</span>
      </div>
    </div>
  )
}
