'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

interface ScheduleDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (scheduledAt: string) => void
  initialDate?: string
  isPending?: boolean
}

function getInitialDate(initialDate?: string): string {
  if (initialDate) {
    return new Date(initialDate).toISOString().split('T')[0]
  }
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return tomorrow.toISOString().split('T')[0]
}

function getInitialTime(initialDate?: string): string {
  if (initialDate) {
    return new Date(initialDate).toTimeString().slice(0, 5)
  }
  return '09:00'
}

export function ScheduleDialog({ isOpen, onClose, onConfirm, initialDate, isPending }: Readonly<ScheduleDialogProps>) {
  if (!isOpen) return null

  return (
    <ScheduleDialogContent
      onClose={onClose}
      onConfirm={onConfirm}
      initialDate={initialDate}
      isPending={isPending}
    />
  )
}

interface ScheduleDialogContentProps {
  onClose: () => void
  onConfirm: (scheduledAt: string) => void
  initialDate?: string
  isPending?: boolean
}

function ScheduleDialogContent({ onClose, onConfirm, initialDate, isPending }: Readonly<ScheduleDialogContentProps>) {
  const [date, setDate] = useState(() => getInitialDate(initialDate))
  const [time, setTime] = useState(() => getInitialTime(initialDate))
  const [error, setError] = useState('')

  const today = new Date().toISOString().split('T')[0]

  function handleConfirm() {
    if (!date || !time) {
      setError('Veuillez remplir la date et l\'heure')
      return
    }

    const scheduledDate = new Date(`${date}T${time}:00`)
    const now = new Date()
    const minDate = new Date(now.getTime() + 10 * 60 * 1000) // 10 min in the future

    if (scheduledDate < minDate) {
      setError('La date doit etre au moins 10 minutes dans le futur')
      return
    }

    setError('')
    onConfirm(scheduledDate.toISOString())
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose} onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
      <div
        role="dialog"
        aria-modal="true"
        className="bg-surface rounded-xl border border-border p-6 w-full max-w-sm shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Programmer la publication</h3>
          <button onClick={onClose} className="text-muted hover:text-text transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="schedule-dialog-date" className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
              Date
            </label>
            <input
              id="schedule-dialog-date"
              type="date"
              value={date}
              min={today}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div>
            <label htmlFor="schedule-dialog-time" className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
              Heure
            </label>
            <input
              id="schedule-dialog-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {error && (
            <p className="text-sm text-error">{error}</p>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-3 py-2 rounded-lg border border-border text-sm hover:bg-surface-hover transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleConfirm}
              disabled={isPending}
              className="flex-1 gradient-primary hover:opacity-90 transition-opacity text-white px-3 py-2 rounded-lg font-semibold text-sm disabled:opacity-50"
            >
              {isPending ? 'Programmation...' : 'Confirmer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
