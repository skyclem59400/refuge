'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

interface ScheduleDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (scheduledAt: string) => void
  initialDate?: string
  isPending?: boolean
}

export function ScheduleDialog({ isOpen, onClose, onConfirm, initialDate, isPending }: ScheduleDialogProps) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('09:00')
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      if (initialDate) {
        const d = new Date(initialDate)
        setDate(d.toISOString().split('T')[0])
        setTime(d.toTimeString().slice(0, 5))
      } else {
        // Default to tomorrow at 9:00
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        setDate(tomorrow.toISOString().split('T')[0])
        setTime('09:00')
      }
      setError('')
    }
  }, [isOpen, initialDate])

  if (!isOpen) return null

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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-surface rounded-xl border border-border p-6 w-full max-w-sm shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Programmer la publication</h3>
          <button onClick={onClose} className="text-muted hover:text-text transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
              Date
            </label>
            <input
              type="date"
              value={date}
              min={today}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
              Heure
            </label>
            <input
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
