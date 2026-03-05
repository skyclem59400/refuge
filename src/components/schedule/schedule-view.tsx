'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, Clock, Trash2, Loader2, ChevronLeft, ChevronRight, Copy, Filter, Users, Heart, Stethoscope } from 'lucide-react'
import { toast } from 'sonner'
import { deleteSchedule, duplicateWeek } from '@/lib/actions/schedule'
import { deleteAppointment } from '@/lib/actions/appointments'
import type { StaffSchedule, Appointment } from '@/lib/types/database'

interface ScheduleViewProps {
  schedules: StaffSchedule[]
  appointments?: Appointment[]
  userNames: Record<string, string>
  animalNames?: Record<string, string>
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

export function ScheduleView({ schedules, appointments = [], userNames, animalNames = {} }: ScheduleViewProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
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

  // Auto-select all users on first render
  useMemo(() => {
    if (selectedUsers.size === 0 && uniqueUsers.length > 0) {
      setSelectedUsers(new Set(uniqueUsers.map((u) => u.id)))
    }
  }, [uniqueUsers])

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

      {/* Calendar grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {weekDays.map((day) => {
          const dateStr = day.toISOString().split('T')[0]
          const dayEvents = eventsByDate[dateStr] || []
          const isToday = dateStr === today.toISOString().split('T')[0]
          const isPast = day < today && !isToday

          return (
            <div
              key={dateStr}
              className={`bg-surface rounded-xl border p-3 ${
                isToday ? 'border-primary ring-1 ring-primary/20' : 'border-border'
              } ${isPast ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                <Calendar className="w-4 h-4 text-primary" />
                <div>
                  <p className={`text-sm font-semibold ${isToday ? 'text-primary' : ''}`}>
                    {formatDate(day)}
                  </p>
                  {isToday && <p className="text-xs text-primary">Aujourd'hui</p>}
                </div>
              </div>

              {dayEvents.length === 0 ? (
                <p className="text-xs text-muted text-center py-4">Aucun événement</p>
              ) : (
                <div className="space-y-2">
                  {dayEvents.map((event) => {
                    if (event.type === 'schedule') {
                      const schedule = event.data
                      const userName = userNames[schedule.user_id] || 'Inconnu'
                      const colorClass = getUserColor(schedule.user_id)
                      const duration =
                        (new Date(`2000-01-01T${schedule.end_time}`).getTime() -
                          new Date(`2000-01-01T${schedule.start_time}`).getTime()) /
                        (1000 * 60 * 60)

                      return (
                        <div
                          key={`schedule-${schedule.id}`}
                          className={`rounded-lg p-2 border ${colorClass}`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="text-sm font-semibold truncate">{userName}</p>
                            <button
                              onClick={() => handleDelete(schedule.id, userName)}
                              disabled={isPending && deletingId === schedule.id}
                              className="text-error hover:text-error/80 transition-colors disabled:opacity-50 shrink-0"
                              title="Supprimer"
                            >
                              {isPending && deletingId === schedule.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                          <div className="flex items-center gap-1 text-xs opacity-80">
                            <Clock className="w-3 h-3" />
                            <span>
                              {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                            </span>
                            <span className="text-[10px]">({duration.toFixed(1)}h)</span>
                          </div>
                          {schedule.notes && (
                            <p className="text-xs mt-1 italic line-clamp-2 opacity-70">{schedule.notes}</p>
                          )}
                        </div>
                      )
                    } else {
                      const appointment = event.data
                      const colorClass = APPOINTMENT_COLORS[appointment.type as keyof typeof APPOINTMENT_COLORS] || 'bg-gray-600/15 border-gray-600/40 text-gray-800'
                      const icon = appointment.type === 'adoption' ? Heart : Stethoscope
                      const Icon = icon
                      const duration =
                        (new Date(`2000-01-01T${appointment.end_time}`).getTime() -
                          new Date(`2000-01-01T${appointment.start_time}`).getTime()) /
                        (1000 * 60 * 60)
                      const animalName = appointment.animal_id ? animalNames[appointment.animal_id] : null

                      return (
                        <div
                          key={`appointment-${appointment.id}`}
                          className={`rounded-lg p-2 border ${colorClass}`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              <Icon className="w-3.5 h-3.5 shrink-0" />
                              <p className="text-sm font-semibold truncate">{appointment.client_name}</p>
                            </div>
                            <button
                              onClick={() => handleDeleteAppointment(appointment.id, appointment.client_name || 'Client inconnu')}
                              disabled={isPending && deletingId === appointment.id}
                              className="text-error hover:text-error/80 transition-colors disabled:opacity-50 shrink-0"
                              title="Supprimer"
                            >
                              {isPending && deletingId === appointment.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                          {animalName && (
                            <p className="text-xs font-medium opacity-75 mb-0.5">🐾 {animalName}</p>
                          )}
                          <div className="flex items-center gap-1 text-xs opacity-80">
                            <Clock className="w-3 h-3" />
                            <span>
                              {formatTime(appointment.start_time)} - {formatTime(appointment.end_time)}
                            </span>
                            <span className="text-[10px]">({duration.toFixed(1)}h)</span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] opacity-70 mt-0.5">
                            <span className="px-1.5 py-0.5 rounded bg-black/10">
                              {appointment.status === 'scheduled' && 'Planifié'}
                              {appointment.status === 'confirmed' && 'Confirmé'}
                              {appointment.status === 'completed' && 'Terminé'}
                              {appointment.status === 'cancelled' && 'Annulé'}
                            </span>
                          </div>
                          {appointment.notes && (
                            <p className="text-xs mt-1 italic line-clamp-2 opacity-70">{appointment.notes}</p>
                          )}
                        </div>
                      )
                    }
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
