'use client'

import { useState, useMemo, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { TimelineEventBlock } from './timeline-event-block'
import { TimelineFiltersComponent, type TimelineFilters } from './timeline-filters'
import { EditScheduleModal } from './edit-schedule-modal'
import { EditAppointmentModal } from './edit-appointment-modal'
import { groupEventsByDate, assignColumns, type TimelineEvent, type PositionedEvent } from '@/lib/utils/timeline'
import type { StaffSchedule, Appointment } from '@/lib/types/database'
import { updateSchedule, deleteSchedule } from '@/lib/actions/schedule'
import { updateAppointment, deleteAppointment } from '@/lib/actions/appointments'
import { toast } from 'sonner'

interface TimelineCalendarViewProps {
  schedules: StaffSchedule[]
  appointments: Appointment[]
  animals: { id: string; nom: string }[]
  members: { user_id: string; full_name?: string | null; pseudo: string | null; email?: string }[]
  userNames: Record<string, string>
  animalNames: Record<string, string>
  canManage: boolean
}

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const TIMELINE_START = 8 // 8h
const TIMELINE_END = 20 // 20h
const TOTAL_HOURS = TIMELINE_END - TIMELINE_START

export function TimelineCalendarView({
  schedules,
  appointments,
  animals,
  members,
  userNames,
  animalNames,
  canManage,
}: Readonly<TimelineCalendarViewProps>) {
  const router = useRouter()
  const [weekOffset, setWeekOffset] = useState(0)
  const [editingSchedule, setEditingSchedule] = useState<StaffSchedule | null>(null)
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null)
  const [draggedEvent, setDraggedEvent] = useState<TimelineEvent | null>(null)
  const [dragOverDate, setDragOverDate] = useState<string | null>(null)
  const [dragOverMinutes, setDragOverMinutes] = useState<number | null>(null)

  // Extract all unique appointment types and users
  const allAppointmentTypes = useMemo(() => {
    const types = new Set<string>()
    appointments.forEach((a) => types.add(a.type))
    return Array.from(types).sort((a, b) => a.localeCompare(b))
  }, [appointments])

  const allUsers = useMemo(() => {
    const userIds = new Set<string>()
    schedules.forEach((s) => userIds.add(s.user_id))
    appointments.forEach((a) => {
      if (a.assigned_user_id) userIds.add(a.assigned_user_id)
    })
    return Array.from(userIds)
      .map((id) => ({ id, name: userNames[id] || 'Inconnu' }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [schedules, appointments, userNames])

  // Filter state
  const [filters, setFilters] = useState<TimelineFilters>(() => ({
    showSchedules: true,
    appointmentTypes: new Set(allAppointmentTypes),
    userIds: new Set(allUsers.map((u) => u.id)),
  }))

  // Merge new types/users into filters when data changes
  const effectiveFilters = useMemo<TimelineFilters>(() => ({
    ...filters,
    appointmentTypes: new Set([...filters.appointmentTypes, ...allAppointmentTypes]),
    userIds: new Set([...filters.userIds, ...allUsers.map((u) => u.id)]),
  }), [filters, allAppointmentTypes, allUsers])

  // Calculate week dates
  const weekDates = useMemo(() => {
    const today = new Date()
    const monday = new Date(today)
    monday.setDate(today.getDay() === 0 ? today.getDate() - 6 : today.getDate() - today.getDay() + 1)
    monday.setDate(monday.getDate() + weekOffset * 7)

    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(monday)
      date.setDate(monday.getDate() + i)
      return date.toISOString().split('T')[0]
    })
  }, [weekOffset])

  // Convert to unified event format and apply filters
  const allEvents: TimelineEvent[] = useMemo(() => {
    const scheduleEvents: TimelineEvent[] = effectiveFilters.showSchedules
      ? schedules
          .filter((s) => effectiveFilters.userIds.has(s.user_id))
          .map((s) => ({
            id: s.id,
            date: s.date,
            start_time: s.start_time,
            end_time: s.end_time,
            type: 'schedule' as const,
            data: s,
          }))
      : []

    const appointmentEvents: TimelineEvent[] = appointments
      .filter((a) => {
        // Filter by appointment type
        if (!effectiveFilters.appointmentTypes.has(a.type)) return false
        // Filter by assigned user
        if (a.assigned_user_id && !effectiveFilters.userIds.has(a.assigned_user_id)) return false
        return true
      })
      .map((a) => ({
        id: a.id,
        date: a.date,
        start_time: a.start_time,
        end_time: a.end_time,
        type: 'appointment' as const,
        data: a,
      }))

    return [...scheduleEvents, ...appointmentEvents]
  }, [schedules, appointments, effectiveFilters])

  // Group and position events
  const eventsByDate = useMemo(() => {
    return groupEventsByDate(allEvents)
  }, [allEvents])

  const positionedEventsByDate = useMemo(() => {
    const result: Record<string, PositionedEvent[]> = {}
    for (const [date, events] of Object.entries(eventsByDate)) {
      result[date] = assignColumns(events)
    }
    return result
  }, [eventsByDate])

  // Handlers
  const handleDelete = async (id: string, type: 'schedule' | 'appointment') => {
    if (type === 'schedule') {
      await deleteSchedule(id)
    } else {
      await deleteAppointment(id)
    }
  }

  const handleEdit = useCallback((event: TimelineEvent) => {
    if (event.type === 'schedule') {
      setEditingSchedule(event.data as StaffSchedule)
    } else {
      setEditingAppointment(event.data as Appointment)
    }
  }, [])

  const handleDragStart = useCallback((event: TimelineEvent) => {
    setDraggedEvent(event)
  }, [])

  // Helper: Calculate drop position from mouse event
  const calculateDropPosition = useCallback((e: React.DragEvent, columnElement: HTMLDivElement) => {
    const rect = columnElement.getBoundingClientRect()
    const y = e.clientY - rect.top
    const hourHeight = rect.height / TOTAL_HOURS
    const minutesFromStart = (y / hourHeight) * 60
    const roundedMinutes = Math.round(minutesFromStart / 5) * 5
    const totalMinutes = TIMELINE_START * 60 + roundedMinutes
    return totalMinutes
  }, [])

  // Helper: Calculate event duration in minutes
  const getEventDuration = useCallback((event: TimelineEvent) => {
    const startMinutes =
      parseInt(event.start_time.split(':')[0]) * 60 +
      parseInt(event.start_time.split(':')[1])
    const endMinutes =
      parseInt(event.end_time.split(':')[0]) * 60 +
      parseInt(event.end_time.split(':')[1])
    return endMinutes - startMinutes
  }, [])

  const handleDrop = useCallback(
    async (targetDate: string, targetMinutes: number) => {
      if (!draggedEvent || !canManage) return

      // Calculate new times
      const hours = Math.floor(targetMinutes / 60)
      const minutes = targetMinutes % 60
      const newStartTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`

      // Calculate duration to preserve it
      const durationMinutes = getEventDuration(draggedEvent)

      const endMinutes = targetMinutes + durationMinutes
      const endHours = Math.floor(endMinutes / 60)
      const endMins = endMinutes % 60
      const newEndTime = `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`

      try {
        if (draggedEvent.type === 'schedule') {
          const result = await updateSchedule(draggedEvent.id, {
            date: targetDate,
            start_time: newStartTime,
            end_time: newEndTime,
          })
          if (result.error) {
            toast.error(result.error)
          } else {
            toast.success('Planning déplacé')
            router.refresh()
          }
        } else {
          const result = await updateAppointment(draggedEvent.id, {
            date: targetDate,
            start_time: newStartTime,
            end_time: newEndTime,
          })
          if (result.error) {
            toast.error(result.error)
          } else {
            toast.success('Rendez-vous déplacé')
            router.refresh()
          }
        }
      } catch {
        toast.error('Erreur lors du déplacement')
      } finally {
        setDraggedEvent(null)
      }
    },
    [draggedEvent, canManage, router, getEventDuration]
  )

  return (
    <div className="space-y-4">
      {/* Filters */}
      <TimelineFiltersComponent
        allAppointmentTypes={allAppointmentTypes}
        allUsers={allUsers}
        filters={filters}
        onFiltersChange={setFilters}
      />

      {/* Timeline */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        {/* Week navigation */}
        <div className="flex items-center justify-between p-4 border-b border-border">
        <button
          onClick={() => setWeekOffset(weekOffset - 1)}
          className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="text-center">
          <p className="text-sm font-semibold">
            {new Date(weekDates[0]).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
            {' - '}
            {new Date(weekDates[6]).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        <button
          onClick={() => setWeekOffset(weekOffset + 1)}
          className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Timeline grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Header - Days */}
          <div className="grid grid-cols-8 border-b border-border bg-surface-hover">
            <div className="p-2 text-xs font-semibold text-muted border-r border-border" />
            {DAYS.map((day, i) => (
              <div key={day} className="p-2 text-center border-r border-border last:border-r-0">
                <p className="text-xs font-semibold text-muted">{day}</p>
                <p className="text-lg font-bold mt-1">
                  {new Date(weekDates[i]).getDate()}
                </p>
              </div>
            ))}
          </div>

          {/* Timeline body */}
          <div className="grid grid-cols-8 relative">
            {/* Hour labels column */}
            <div className="border-r border-border">
              {Array.from({ length: TOTAL_HOURS }, (_, i) => {
                const hour = TIMELINE_START + i
                return (
                  <div
                    key={hour}
                    className="h-16 flex items-center justify-end pr-2 text-xs text-muted border-b border-border"
                  >
                    {hour.toString().padStart(2, '0')}:00
                  </div>
                )
              })}
            </div>

            {/* Day columns */}
            {weekDates.map((date) => (
              <div
                key={date}
                className="relative border-r border-border last:border-r-0"
                onDragOver={(e) => {
                  if (canManage && draggedEvent) {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'

                    // Calculate hover position in real-time for preview
                    const totalMinutes = calculateDropPosition(e, e.currentTarget)

                    setDragOverDate(date)
                    setDragOverMinutes(totalMinutes)
                  }
                }}
                onDragLeave={() => {
                  setDragOverDate(null)
                  setDragOverMinutes(null)
                }}
                onDrop={(e) => {
                  if (!canManage || !draggedEvent) return
                  e.preventDefault()

                  // Calculate drop position
                  const totalMinutes = calculateDropPosition(e, e.currentTarget)

                  setDragOverDate(null)
                  setDragOverMinutes(null)
                  handleDrop(date, totalMinutes)
                }}
              >
                {/* Hour lines */}
                {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                  <div key={i} className="h-16 border-b border-border" />
                ))}

                {/* Events */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="relative h-full pointer-events-auto">
                    {(positionedEventsByDate[date] || []).map((event) => (
                      <TimelineEventBlock
                        key={`${event.type}-${event.id}`}
                        event={event}
                        userNames={userNames}
                        animalNames={animalNames}
                        timelineStart={TIMELINE_START}
                        totalHours={TOTAL_HOURS}
                        canManage={canManage}
                        onDelete={handleDelete}
                        onEdit={handleEdit}
                        onDragStart={handleDragStart}
                      />
                    ))}

                    {/* Drop preview indicator */}
                    {draggedEvent && dragOverDate === date && dragOverMinutes !== null && (() => {
                      // Calculate duration of dragged event
                      const durationMinutes = getEventDuration(draggedEvent)

                      // Calculate position
                      const offsetMinutes = dragOverMinutes - (TIMELINE_START * 60)
                      const top = (offsetMinutes / (TOTAL_HOURS * 60)) * 100
                      const height = Math.max((durationMinutes / (TOTAL_HOURS * 60)) * 100, 2)

                      return (
                        <div
                          className="absolute left-0 right-0 border-2 border-dashed border-primary bg-primary/20 rounded-lg pointer-events-none"
                          style={{
                            top: `${top}%`,
                            height: `${height}%`,
                          }}
                        >
                          <div className="flex items-center justify-center h-full text-xs font-medium text-primary">
                            {Math.floor(dragOverMinutes / 60).toString().padStart(2, '0')}:
                            {(dragOverMinutes % 60).toString().padStart(2, '0')}
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      </div>

      {/* Edit modals */}
      {editingSchedule && (
        <EditScheduleModal
          schedule={editingSchedule}
          userNames={userNames}
          onClose={() => setEditingSchedule(null)}
          onSuccess={() => {
            router.refresh()
          }}
        />
      )}

      {editingAppointment && (
        <EditAppointmentModal
          appointment={editingAppointment}
          animals={animals}
          members={members}
          userNames={userNames}
          onClose={() => setEditingAppointment(null)}
          onSuccess={() => {
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
