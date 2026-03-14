'use client'

import { useState } from 'react'
import { Clock, User, Heart, Stethoscope, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { PositionedEvent } from '@/lib/utils/timeline'
import type { StaffSchedule, Appointment } from '@/lib/types/database'
import type { TimelineEvent } from '@/lib/utils/timeline'

interface TimelineEventBlockProps {
  event: PositionedEvent
  userNames: Record<string, string>
  animalNames?: Record<string, string>
  timelineStart: number
  totalHours: number
  canManage: boolean
  onDelete: (id: string, type: 'schedule' | 'appointment') => Promise<void>
  onEdit?: (event: TimelineEvent) => void
  onDragStart?: (event: TimelineEvent) => void
}

export function TimelineEventBlock({
  event,
  userNames,
  animalNames = {},
  timelineStart,
  totalHours,
  canManage,
  onDelete,
  onEdit,
  onDragStart,
}: Readonly<TimelineEventBlockProps>) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)

  const top = calculateTopPercent(event.start_time, timelineStart, totalHours)
  const height = calculateHeightPercent(event.start_time, event.end_time, totalHours)

  const isSchedule = event.type === 'schedule'

  const getAppointmentColors = (type: string) => {
    switch (type) {
      case 'adoption':
        return {
          bg: 'bg-green-500/10 border-green-500/30',
          text: 'text-green-700',
        }
      case 'veterinary':
        return {
          bg: 'bg-orange-500/10 border-orange-500/30',
          text: 'text-orange-700',
        }
      default:
        return {
          bg: 'bg-blue-500/10 border-blue-500/30',
          text: 'text-blue-700',
        }
    }
  }

  const colors = isSchedule
    ? { bg: 'bg-primary/10 border-primary/30', text: 'text-primary' }
    : getAppointmentColors((event.data as Appointment).type)

  const bgColor = colors.bg
  const textColor = colors.text

  const handleDelete = async () => {
    if (!confirm('Supprimer cet élément ?')) return

    setIsDeleting(true)
    try {
      await onDelete(event.id, event.type)
      toast.success('Supprimé avec succès')
    } catch {
      toast.error('Erreur lors de la suppression')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={canManage}
      onDragStart={(e) => {
        if (canManage && onDragStart) {
          e.dataTransfer.effectAllowed = 'move'
          onDragStart(event)
        }
      }}
      onClick={(e) => {
        // Don't trigger edit when clicking delete button
        if (!(e.target as HTMLElement).closest('button')) {
          onEdit?.(event)
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onEdit?.(event)
        }
      }}
      className={`absolute border rounded-lg p-1.5 text-xs transition-all hover:shadow-md ${
        canManage ? 'cursor-move' : 'cursor-pointer'
      } ${bgColor} ${textColor}`}
      style={{
        top: `${top}%`,
        height: `${height}%`,
        left: `${event.left}%`,
        width: `${event.width}%`,
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1 truncate flex-1">
          {isSchedule ? (
            <>
              <User className="w-3 h-3 shrink-0" />
              <span className="truncate font-medium">
                {userNames[(event.data as StaffSchedule).user_id] || 'Inconnu'}
              </span>
            </>
          ) : (
            <>
              {(event.data as Appointment).type === 'adoption' ? (
                <Heart className="w-3 h-3 shrink-0" />
              ) : (
                <Stethoscope className="w-3 h-3 shrink-0" />
              )}
              <span className="truncate font-medium">
                {(event.data as Appointment).client_name}
              </span>
            </>
          )}
        </div>
        {canManage && (
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-0.5 hover:bg-error/20 rounded transition-colors shrink-0"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-1 text-[10px] mt-0.5 text-muted">
        <Clock className="w-2.5 h-2.5" />
        <span>
          {event.start_time.substring(0, 5)} - {event.end_time.substring(0, 5)}
        </span>
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute z-50 left-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-lg p-3 min-w-[200px] text-sm text-text">
          {isSchedule ? (
            <>
              <p className="font-semibold">{userNames[(event.data as StaffSchedule).user_id] || 'Inconnu'}</p>
              <p className="text-xs text-muted mt-1">
                {event.start_time} - {event.end_time}
              </p>
              {(event.data as StaffSchedule).notes && (
                <p className="text-xs mt-2 text-muted">{(event.data as StaffSchedule).notes}</p>
              )}
            </>
          ) : (
            <>
              <p className="font-semibold">{(event.data as Appointment).client_name}</p>
              <p className="text-xs text-muted mt-1">
                {(event.data as Appointment).type === 'adoption' ? 'Adoption' : 'Vétérinaire'}
              </p>
              {(() => {
                const assignedId = (event.data as Appointment).assigned_user_id
                return assignedId && userNames[assignedId] ? (
                  <p className="text-xs text-muted">
                    Collaborateur : {userNames[assignedId]}
                  </p>
                ) : null
              })()}
              {(() => {
                const animalId = (event.data as Appointment).animal_id
                return animalId && animalNames[animalId] ? (
                  <p className="text-xs text-muted">
                    Animal : {animalNames[animalId]}
                  </p>
                ) : null
              })()}
              <p className="text-xs mt-1">
                {event.start_time} - {event.end_time}
              </p>
              {(event.data as Appointment).client_phone && (
                <p className="text-xs mt-1 text-muted">
                  Tél : {(event.data as Appointment).client_phone}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// Re-export utils needed
function calculateTopPercent(startTime: string, timelineStart: number, totalHours: number): number {
  const [h, m] = startTime.split(':').map(Number)
  const startMinutes = h * 60 + m
  const offsetMinutes = startMinutes - (timelineStart * 60)
  return (offsetMinutes / (totalHours * 60)) * 100
}

function calculateHeightPercent(startTime: string, endTime: string, totalHours: number): number {
  const [h1, m1] = startTime.split(':').map(Number)
  const [h2, m2] = endTime.split(':').map(Number)
  const durationMinutes = (h2 * 60 + m2) - (h1 * 60 + m1)
  return Math.max((durationMinutes / (totalHours * 60)) * 100, 2)
}
