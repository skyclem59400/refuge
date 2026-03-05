'use client'

import { useState, useTransition } from 'react'
import { X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { updateSchedule } from '@/lib/actions/schedule'
import type { StaffSchedule } from '@/lib/types/database'

interface EditScheduleModalProps {
  schedule: StaffSchedule
  userNames: Record<string, string>
  onClose: () => void
  onSuccess: () => void
}

export function EditScheduleModal({
  schedule,
  userNames,
  onClose,
  onSuccess,
}: EditScheduleModalProps) {
  const [isPending, startTransition] = useTransition()
  const [date, setDate] = useState(schedule.date)
  const [startTime, setStartTime] = useState(schedule.start_time)
  const [endTime, setEndTime] = useState(schedule.end_time)
  const [notes, setNotes] = useState(schedule.notes || '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!date || !startTime || !endTime) {
      toast.error('Veuillez remplir tous les champs obligatoires')
      return
    }

    startTransition(async () => {
      const result = await updateSchedule(schedule.id, {
        date,
        start_time: startTime,
        end_time: endTime,
        notes: notes.trim() || null,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Planning mis à jour avec succès')
        onSuccess()
        onClose()
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface rounded-xl border border-border p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Modifier le planning</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* User (read-only) */}
          <div>
            <label className="block text-sm font-medium mb-2">Collaborateur</label>
            <input
              type="text"
              value={userNames[schedule.user_id] || 'Inconnu'}
              disabled
              className="w-full px-3 py-2 bg-surface-hover border border-border rounded-lg text-sm opacity-60 cursor-not-allowed"
            />
          </div>

          {/* Date */}
          <div>
            <label htmlFor="date" className="block text-sm font-medium mb-2">
              Date <span className="text-error">*</span>
            </label>
            <input
              type="date"
              id="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Start time */}
          <div>
            <label htmlFor="startTime" className="block text-sm font-medium mb-2">
              Heure de début <span className="text-error">*</span>
            </label>
            <input
              type="time"
              id="startTime"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* End time */}
          <div>
            <label htmlFor="endTime" className="block text-sm font-medium mb-2">
              Heure de fin <span className="text-error">*</span>
            </label>
            <input
              type="time"
              id="endTime"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium mb-2">
              Notes
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border hover:bg-surface-hover transition-colors text-sm"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2 text-sm"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {isPending ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
