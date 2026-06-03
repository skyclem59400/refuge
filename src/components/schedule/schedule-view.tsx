'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, Clock, Trash2, Loader2, ChevronLeft, ChevronRight, Copy, Filter, Users, Heart, Stethoscope } from 'lucide-react'
import { toast } from 'sonner'
import { deleteSchedule, duplicateWeek } from '@/lib/actions/schedule'
import { deleteAppointment } from '@/lib/actions/appointments'
import type { StaffSchedule, Appointment } from '@/lib/types/database'

/** Semaine-type d'un salarié — base récurrente pré-affichée dans la grille. */
export interface StandardScheduleDay {
  user_id: string
  day_of_week: number // 0=dim, 6=sam
  is_rest_day: boolean
  start_am: string | null
  end_am: string | null
  start_pm: string | null
  end_pm: string | null
}

interface ScheduleViewProps {
  schedules: StaffSchedule[]
  appointments?: Appointment[]
  userNames: Record<string, string>
  animalNames?: Record<string, string>
  /** Capacitif : seuil minimum de personnel par jour (depuis establishments.min_daily_staff).
   * Affiché dans le header de chaque colonne pour signaler les jours sous-staffés. */
  minDailyStaff?: number
  /** Semaines-types des salariés : présences récurrentes à pré-afficher en "shadow events"
   * (rayures + opacité 65%). Masquées sur un jour donné si un staff_schedule explicite
   * existe pour ce même user_id à cette date. */
  standardSchedules?: StandardScheduleDay[]
}

// Color palette for different users
const USER_COLORS = [
  'bg-blue-500/10 border-blue-500/30 text-blue-700',
  'bg-green-500/10 border-green-500/30 text-green-700',
  'bg-purple-500/10 border-purple-500/30 text-purple-700',
  'bg-orange-500/10 border-orange-500/30 text-orange-700',
  'bg-pink-500/10 border-pink-500/30 text-pink-700',
  'bg-teal-500/10 border-teal-500/30 text-teal-700',
  'bg-indigo-500/10 border-indigo-500/30 text-indigo-700',
  'bg-amber-500/10 border-amber-500/30 text-amber-700',
]

// Appointment type colors
const APPOINTMENT_COLORS = {
  adoption: 'bg-green-600/15 border-green-600/40 text-green-800',
  veterinary: 'bg-orange-600/15 border-orange-600/40 text-orange-800',
}

// Unified event type
type CalendarEvent =
  | { type: 'schedule'; data: StaffSchedule }
  | { type: 'appointment'; data: Appointment }

export function ScheduleView({ schedules, appointments = [], userNames, animalNames = {}, minDailyStaff = 0, standardSchedules = [] }: Readonly<ScheduleViewProps>) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(() => {
    const users = Array.from(new Set(schedules.map((s) => s.user_id)))
    return new Set(users)
  })
  const [showFilters, setShowFilters] = useState(false)

  // Calculate current week range
  const today = new Date()
  const currentWeekStart = new Date(today)
  currentWeekStart.setDate(today.getDate() - today.getDay() + 1 + weekOffset * 7) // Monday
  currentWeekStart.setHours(0, 0, 0, 0)

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(currentWeekStart)
    day.setDate(currentWeekStart.getDate() + i)
    return day
  })

  // Merge schedules and appointments into unified events
  const allEvents = useMemo<CalendarEvent[]>(() => {
    const scheduleEvents: CalendarEvent[] = schedules.map((s) => ({ type: 'schedule' as const, data: s }))
    const appointmentEvents: CalendarEvent[] = appointments.map((a) => ({ type: 'appointment' as const, data: a }))
    return [...scheduleEvents, ...appointmentEvents]
  }, [schedules, appointments])

  // Get unique users from schedules
  const uniqueUsers = useMemo(() => {
    const users = Array.from(new Set(schedules.map((s) => s.user_id)))
    return users.map((userId) => ({
      id: userId,
      name: userNames[userId] || 'Inconnu',
    }))
  }, [schedules, userNames])

  // Filter events based on selected users (schedules only)
  const filteredEvents = useMemo(() => {
    if (selectedUsers.size === 0) return allEvents
    return allEvents.filter((event) => {
      if (event.type === 'schedule') {
        return selectedUsers.has(event.data.user_id)
      }
      // Always show appointments
      return true
    })
  }, [allEvents, selectedUsers])

  // Group filtered events by date
  const eventsByDate = filteredEvents.reduce<Record<string, CalendarEvent[]>>((acc, event) => {
    const dateStr = event.data.date
    if (!acc[dateStr]) acc[dateStr] = []
    acc[dateStr].push(event)
    return acc
  }, {})

  // Get color for user (consistent across renders)
  const getUserColor = (userId: string) => {
    const index = uniqueUsers.findIndex((u) => u.id === userId)
    return USER_COLORS[index % USER_COLORS.length]
  }

  // Toggle user filter
  const toggleUser = (userId: string) => {
    setSelectedUsers((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }

  // Select all users
  const selectAllUsers = () => {
    setSelectedUsers(new Set(uniqueUsers.map((u) => u.id)))
  }

  // Deselect all users
  const deselectAllUsers = () => {
    setSelectedUsers(new Set())
  }

  const handleDelete = (id: string, userName: string) => {
    if (!confirm(`Supprimer la planification de ${userName} ?`)) return

    setDeletingId(id)
    startTransition(async () => {
      const result = await deleteSchedule(id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Planification supprimee')
        router.refresh()
      }
      setDeletingId(null)
    })
  }

  const handleDeleteAppointment = (id: string, clientName: string) => {
    if (!confirm(`Supprimer le rendez-vous de ${clientName} ?`)) return

    setDeletingId(id)
    startTransition(async () => {
      const result = await deleteAppointment(id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Rendez-vous supprime')
        router.refresh()
      }
      setDeletingId(null)
    })
  }

  const handleDuplicateWeek = () => {
    const weekStart = currentWeekStart.toISOString().split('T')[0]
    if (
      !confirm(
        `Dupliquer toutes les planifications de cette semaine vers la semaine suivante ?\n\nCela va copier ${
          schedules.filter(
            (s) =>
              s.date >= weekDays[0].toISOString().split('T')[0] &&
              s.date <= weekDays[6].toISOString().split('T')[0]
          ).length
        } planifications.`
      )
    )
      return

    startTransition(async () => {
      const result = await duplicateWeek(weekStart)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`${result.count} planifications dupliquees vers la semaine suivante`)
        // Move to next week to show the duplicated schedules
        setWeekOffset(weekOffset + 1)
        router.refresh()
      }
    })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  const formatTime = (time: string) => {
    return time.slice(0, 5) // HH:MM
  }

  const getWeekLabel = () => {
    if (weekOffset === 0) return "Cette semaine"
    if (weekOffset === -1) return "Semaine derniere"
    if (weekOffset === 1) return "Semaine prochaine"
    return `Semaine du ${weekDays[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
  }

  return (
    <div className="space-y-4">
      {/* Filters and actions bar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-3 py-2 rounded-lg border transition-colors flex items-center gap-2 ${
            showFilters
              ? 'bg-primary/10 border-primary/30 text-primary'
              : 'bg-surface border-border hover:bg-surface-hover'
          }`}
        >
          <Filter className="w-4 h-4" />
          <span className="text-sm font-medium">Filtres</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-surface-hover">
            {selectedUsers.size}/{uniqueUsers.length}
          </span>
        </button>

        <button
          onClick={handleDuplicateWeek}
          disabled={isPending}
          className="px-3 py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
          <span className="text-sm font-medium">Dupliquer cette semaine</span>
        </button>

        <div className="ml-auto text-xs text-muted flex items-center gap-1">
          <Users className="w-3.5 h-3.5" />
          <span>
            {filteredEvents.filter(
              (e) =>
                e.data.date >= weekDays[0].toISOString().split('T')[0] &&
                e.data.date <= weekDays[6].toISOString().split('T')[0]
            ).length}{' '}
            événements cette semaine
          </span>
        </div>
      </div>

      {/* User filters */}
      {showFilters && (
        <div className="bg-surface rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Collaborateurs
            </p>
            <div className="flex gap-2">
              <button
                onClick={selectAllUsers}
                className="text-xs text-primary hover:underline"
              >
                Tout sélectionner
              </button>
              <span className="text-xs text-muted">|</span>
              <button
                onClick={deselectAllUsers}
                className="text-xs text-muted hover:text-text hover:underline"
              >
                Tout désélectionner
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {uniqueUsers.map((user) => {
              const isSelected = selectedUsers.has(user.id)
              const colorClass = getUserColor(user.id)
              return (
                <button
                  key={user.id}
                  onClick={() => toggleUser(user.id)}
                  className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                    isSelected
                      ? colorClass
                      : 'bg-surface-hover border-border text-muted hover:border-border/50'
                  }`}
                >
                  {user.name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Week navigation */}
      <div className="flex items-center justify-between bg-surface rounded-xl border border-border p-3">
        <button
          onClick={() => setWeekOffset(weekOffset - 1)}
          className="px-3 py-1.5 rounded-lg hover:bg-surface-hover transition-colors flex items-center gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="text-sm">Semaine precedente</span>
        </button>

        <div className="text-center">
          <p className="text-sm font-semibold">{getWeekLabel()}</p>
          <p className="text-xs text-muted">
            {weekDays[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} -{' '}
            {weekDays[6].toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
          </p>
        </div>

        <button
          onClick={() => setWeekOffset(weekOffset + 1)}
          className="px-3 py-1.5 rounded-lg hover:bg-surface-hover transition-colors flex items-center gap-2"
        >
          <span className="text-sm">Semaine suivante</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Calendrier hebdomadaire — grille type Google Calendar (jours en colonnes,
          heures en lignes). Plage horaire 7h → 21h ; events positionnés en absolute
          dans la colonne du jour avec top/height proportionnels à l'horaire. */}
      <WeeklyGrid
        weekDays={weekDays}
        eventsByDate={eventsByDate}
        userNames={userNames}
        animalNames={animalNames}
        getUserColor={getUserColor}
        today={today}
        isPending={isPending}
        deletingId={deletingId}
        minDailyStaff={minDailyStaff}
        standardSchedules={standardSchedules}
        selectedUsers={selectedUsers}
        onDeleteSchedule={handleDelete}
        onDeleteAppointment={handleDeleteAppointment}
      />
    </div>
  )
}

// ============================================================
// WeeklyGrid — composant interne, grille hebdo type Google Calendar
// ============================================================

const HOUR_START = 7  // 07h00 — début de la grille
const HOUR_END = 21   // 21h00 — fin
const HOUR_HEIGHT_PX = 56  // hauteur d'une ligne d'1h (assez large pour caler texte)

function parseTime(t: string): number {
  // "08:30:00" ou "08:30" -> 8.5 (heures décimales depuis minuit)
  const [hStr, mStr] = t.split(':')
  return parseInt(hStr) + (parseInt(mStr) / 60)
}

function topPxForTime(t: string): number {
  return (parseTime(t) - HOUR_START) * HOUR_HEIGHT_PX
}

function heightPxForDuration(start: string, end: string): number {
  const dur = parseTime(end) - parseTime(start)
  return Math.max(28, dur * HOUR_HEIGHT_PX)  // min 28px pour rester lisible
}

interface WeeklyGridProps {
  weekDays: Date[]
  eventsByDate: Record<string, CalendarEvent[]>
  userNames: Record<string, string>
  animalNames: Record<string, string>
  getUserColor: (id: string) => string
  today: Date
  isPending: boolean
  deletingId: string | null
  minDailyStaff: number
  standardSchedules: StandardScheduleDay[]
  selectedUsers: Set<string>
  onDeleteSchedule: (id: string, name: string) => void
  onDeleteAppointment: (id: string, name: string) => void
}

/** Bloc shadow event (présence récurrente issue de member_work_schedules). */
interface ShadowBlock {
  user_id: string
  start_time: string
  end_time: string
}

function WeeklyGrid({
  weekDays,
  eventsByDate,
  userNames,
  animalNames,
  getUserColor,
  today,
  isPending,
  deletingId,
  minDailyStaff,
  standardSchedules,
  selectedUsers,
  onDeleteSchedule,
  onDeleteAppointment,
}: Readonly<WeeklyGridProps>) {
  // Pour chaque jour de la semaine, on calcule les "shadow blocks" issus
  // des semaines-types des salariés. Un user qui a un staff_schedule
  // explicite ce jour-là voit ses shadow blocks supprimés (l'explicite gagne).
  const shadowsByDate: Record<string, ShadowBlock[]> = {}
  for (const day of weekDays) {
    const dateStr = day.toISOString().split('T')[0]
    const dow = day.getDay()
    const dayEvents = eventsByDate[dateStr] || []
    const usersWithExplicitSchedule = new Set(
      dayEvents
        .filter((e): e is { type: 'schedule'; data: StaffSchedule } => e.type === 'schedule')
        .map((e) => e.data.user_id),
    )

    const blocks: ShadowBlock[] = []
    for (const std of standardSchedules) {
      if (std.day_of_week !== dow) continue
      if (std.is_rest_day) continue
      if (usersWithExplicitSchedule.has(std.user_id)) continue
      if (selectedUsers.size > 0 && !selectedUsers.has(std.user_id)) continue
      if (std.start_am && std.end_am) {
        blocks.push({ user_id: std.user_id, start_time: std.start_am, end_time: std.end_am })
      }
      if (std.start_pm && std.end_pm) {
        blocks.push({ user_id: std.user_id, start_time: std.start_pm, end_time: std.end_pm })
      }
    }
    if (blocks.length > 0) shadowsByDate[dateStr] = blocks
  }
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i)
  const todayStr = today.toISOString().split('T')[0]
  const dayShort = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

  // Position de la ligne "now" si la semaine affichée contient aujourd'hui
  const nowTopPx = (() => {
    const idx = weekDays.findIndex((d) => d.toISOString().split('T')[0] === todayStr)
    if (idx === -1) return null
    const now = today.getHours() + today.getMinutes() / 60
    if (now < HOUR_START || now > HOUR_END) return null
    return { col: idx, top: (now - HOUR_START) * HOUR_HEIGHT_PX }
  })()

  const gridHeight = (HOUR_END - HOUR_START) * HOUR_HEIGHT_PX

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      {/* Header jours */}
      <div className="grid sticky top-0 z-10 bg-surface-dark border-b border-border" style={{ gridTemplateColumns: '64px repeat(7, 1fr)' }}>
        <div className="px-2 py-3 border-r border-border" />
        {weekDays.map((d) => {
          const dateStr = d.toISOString().split('T')[0]
          const isToday = dateStr === todayStr
          const dayEvents = eventsByDate[dateStr] || []
          // Capacitif : on compte les utilisateurs distincts présents ce jour,
          // que ce soit via un staff_schedule explicite OU via leur semaine-type.
          const explicitUsers = new Set(
            dayEvents
              .filter((e): e is { type: 'schedule'; data: StaffSchedule } => e.type === 'schedule')
              .map((e) => e.data.user_id),
          )
          const shadowUsers = new Set((shadowsByDate[dateStr] || []).map((b) => b.user_id))
          const presentUsers = new Set([...explicitUsers, ...shadowUsers])
          const present = presentUsers.size
          const isUnderstaffed = minDailyStaff > 0 && present < minDailyStaff
          const isExactlyOk = minDailyStaff > 0 && present === minDailyStaff
          const badgeClass = isUnderstaffed
            ? 'bg-red-500/20 text-red-500'
            : isExactlyOk
              ? 'bg-warning/20 text-warning'
              : minDailyStaff > 0
                ? 'bg-success/20 text-success'
                : 'bg-surface text-muted'
          return (
            <div
              key={dateStr}
              className={`px-2 py-3 text-center border-r border-border last:border-r-0 ${
                isToday ? 'bg-accent/10' : ''
              }`}
            >
              <div className="text-[11px] uppercase tracking-wide text-muted font-medium">{dayShort[d.getDay()]}</div>
              <div
                className={`mt-1 inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${
                  isToday ? 'bg-accent text-white' : 'text-text'
                }`}
              >
                {d.getDate()}
              </div>
              {minDailyStaff > 0 && (
                <div
                  className={`mt-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${badgeClass}`}
                  title={`${present} collaborateur(s) présent(s) sur ${minDailyStaff} requis`}
                >
                  <Users className="w-2.5 h-2.5" />
                  {present}/{minDailyStaff}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Corps grille + events */}
      <div className="overflow-x-auto">
        <div className="relative grid min-w-[800px]" style={{ gridTemplateColumns: '64px repeat(7, 1fr)', height: gridHeight }}>
          {/* Colonne heures */}
          <div className="relative border-r border-border">
            {hours.map((h) => (
              <div
                key={h}
                className="absolute left-0 right-0 px-2 text-[11px] text-muted text-right pr-2"
                style={{ top: (h - HOUR_START) * HOUR_HEIGHT_PX - 6 }}
              >
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* Colonnes jours */}
          {weekDays.map((d, dayIdx) => {
            const dateStr = d.toISOString().split('T')[0]
            const dayEvents = eventsByDate[dateStr] || []
            const dayShadows = shadowsByDate[dateStr] || []
            const isToday = dateStr === todayStr
            return (
              <div
                key={dateStr}
                className={`relative border-r border-border last:border-r-0 ${isToday ? 'bg-accent/5' : ''}`}
              >
                {/* Lignes horaires */}
                {hours.map((h) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-t border-border/40"
                    style={{ top: (h - HOUR_START) * HOUR_HEIGHT_PX }}
                  />
                ))}

                {/* Shadow events (présences récurrentes depuis semaine-type) — rendus
                    EN PREMIER pour passer sous les events explicites. Style : rayures
                    diagonales subtiles + bordure pointillée + opacité 65% + hover plein. */}
                {dayShadows.map((shadow, idx) => {
                  const userName = userNames[shadow.user_id] || 'Inconnu'
                  const colorClass = getUserColor(shadow.user_id)
                  const top = topPxForTime(shadow.start_time)
                  const height = heightPxForDuration(shadow.start_time, shadow.end_time)
                  // Extrait la couleur seule (border-X-500/30) pour les rayures
                  const borderColorMatch = colorClass.match(/border-([a-z]+)-(\d+)/)
                  const stripeColorVar = borderColorMatch
                    ? `rgba(0,0,0,0.04)`
                    : 'rgba(0,0,0,0.04)'
                  return (
                    <div
                      key={`shadow-${dateStr}-${idx}`}
                      className={`absolute left-1 right-1 rounded-md px-2 py-1 overflow-hidden text-[11px] leading-tight ${colorClass} opacity-60 hover:opacity-95 transition-opacity group`}
                      style={{
                        top,
                        height,
                        borderStyle: 'dashed',
                        borderWidth: '1px',
                        backgroundImage: `repeating-linear-gradient(135deg, transparent, transparent 6px, ${stripeColorVar} 6px, ${stripeColorVar} 7px)`,
                      }}
                      title={`Présence récurrente : ${userName} (${shadow.start_time.slice(0, 5)} – ${shadow.end_time.slice(0, 5)})`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="italic truncate flex-1">{userName}</div>
                        <span className="opacity-50 text-[9px] uppercase tracking-wider shrink-0">Récurrent</span>
                      </div>
                      <div className="text-[10px] opacity-70">
                        {shadow.start_time.slice(0, 5)} – {shadow.end_time.slice(0, 5)}
                      </div>
                    </div>
                  )
                })}

                {/* Ligne "maintenant" */}
                {nowTopPx && nowTopPx.col === dayIdx && (
                  <>
                    <div
                      className="absolute left-0 right-0 h-px bg-red-500 z-20"
                      style={{ top: nowTopPx.top }}
                    />
                    <div
                      className="absolute w-2 h-2 rounded-full bg-red-500 -translate-x-1/2 -translate-y-1/2 z-20"
                      style={{ top: nowTopPx.top, left: 0 }}
                    />
                  </>
                )}

                {/* Events */}
                {dayEvents.map((event) => {
                  if (event.type === 'schedule') {
                    const schedule = event.data
                    const userName = userNames[schedule.user_id] || 'Inconnu'
                    const colorClass = getUserColor(schedule.user_id)
                    const top = topPxForTime(schedule.start_time)
                    const height = heightPxForDuration(schedule.start_time, schedule.end_time)
                    return (
                      <div
                        key={`schedule-${schedule.id}`}
                        className={`absolute left-1 right-1 rounded-md border px-2 py-1 overflow-hidden text-[11px] leading-tight ${colorClass} group`}
                        style={{ top, height }}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="font-semibold truncate flex-1">{userName}</div>
                          <button
                            onClick={() => onDeleteSchedule(schedule.id, userName)}
                            disabled={isPending && deletingId === schedule.id}
                            className="opacity-0 group-hover:opacity-100 shrink-0 text-error hover:text-error/80 disabled:opacity-30 transition-opacity"
                            title="Supprimer"
                          >
                            {isPending && deletingId === schedule.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Trash2 className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        <div className="text-[10px] opacity-70">
                          {schedule.start_time.slice(0, 5)} – {schedule.end_time.slice(0, 5)}
                        </div>
                        {schedule.notes && height >= HOUR_HEIGHT_PX * 1.5 && (
                          <div className="text-[10px] opacity-60 italic line-clamp-2 mt-0.5">{schedule.notes}</div>
                        )}
                      </div>
                    )
                  } else {
                    const appointment = event.data
                    const colorClass =
                      APPOINTMENT_COLORS[appointment.type as keyof typeof APPOINTMENT_COLORS] ||
                      'bg-gray-600/15 border-gray-600/40 text-gray-800'
                    const Icon = appointment.type === 'adoption' ? Heart : Stethoscope
                    const animalName = appointment.animal_id ? animalNames[appointment.animal_id] : null
                    const top = topPxForTime(appointment.start_time)
                    const height = heightPxForDuration(appointment.start_time, appointment.end_time)
                    return (
                      <div
                        key={`appointment-${appointment.id}`}
                        className={`absolute left-1 right-1 rounded-md border px-2 py-1 overflow-hidden text-[11px] leading-tight ${colorClass} group`}
                        style={{ top, height }}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex items-center gap-1 font-semibold truncate flex-1">
                            <Icon className="w-3 h-3 shrink-0" />
                            <span className="truncate">{appointment.client_name}</span>
                          </div>
                          <button
                            onClick={() =>
                              onDeleteAppointment(appointment.id, appointment.client_name || 'Client inconnu')
                            }
                            disabled={isPending && deletingId === appointment.id}
                            className="opacity-0 group-hover:opacity-100 shrink-0 text-error hover:text-error/80 disabled:opacity-30 transition-opacity"
                            title="Supprimer"
                          >
                            {isPending && deletingId === appointment.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Trash2 className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        {animalName && (
                          <div className="text-[10px] font-medium opacity-75">🐾 {animalName}</div>
                        )}
                        <div className="text-[10px] opacity-70">
                          {appointment.start_time.slice(0, 5)} – {appointment.end_time.slice(0, 5)}
                        </div>
                        {appointment.notes && height >= HOUR_HEIGHT_PX * 1.5 && (
                          <div className="text-[10px] opacity-60 italic line-clamp-2 mt-0.5">{appointment.notes}</div>
                        )}
                      </div>
                    )
                  }
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
