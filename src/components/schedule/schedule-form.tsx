'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { X, Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { createSchedule } from '@/lib/actions/schedule'

interface Member {
  user_id: string
  full_name?: string | null
  pseudo: string | null
  email?: string
}

interface ScheduleFormProps {
  members: Member[]
  userNames: Record<string, string>
  onClose?: () => void
}

export function ScheduleForm({ members, userNames, onClose }: Readonly<ScheduleFormProps>) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedUserId, setSelectedUserId] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [notes, setNotes] = useState('')

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!selectedUserId || !date || !startTime || !endTime) {
      toast.error('Veuillez remplir tous les champs obligatoires')
      return
    }

    startTransition(async () => {
      const result = await createSchedule({
        user_id: selectedUserId,
        date,
        start_time: startTime,
        end_time: endTime,
        notes: notes.trim() || null,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Planification creee')
        setSelectedUserId('')
        setDate('')
        setStartTime('09:00')
        setEndTime('17:00')
        setNotes('')
        router.refresh()
        if (onClose) onClose()
      }
    })
  }

  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Nouvelle planification</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-muted hover:text-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="schedule-person" className="block text-xs font-medium text-muted mb-1">
            Personne *
          </label>
          <select
            id="schedule-person"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            required
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
            disabled={isPending}
          >
            <option value="">Selectionner une personne</option>
            {members.map((member) => (
              <option key={member.user_id} value={member.user_id}>
                {userNames[member.user_id] || member.full_name || member.pseudo || member.email}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="schedule-date" className="block text-xs font-medium text-muted mb-1">
            Date *
          </label>
          <input
            id="schedule-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
            disabled={isPending}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="schedule-start-time" className="block text-xs font-medium text-muted mb-1">
              Heure debut *
            </label>
            <input
              id="schedule-start-time"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
              disabled={isPending}
            />
          </div>
          <div>
            <label htmlFor="schedule-end-time" className="block text-xs font-medium text-muted mb-1">
              Heure fin *
            </label>
            <input
              id="schedule-end-time"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
              disabled={isPending}
            />
          </div>
        </div>

        <div>
          <label htmlFor="schedule-notes" className="block text-xs font-medium text-muted mb-1">
            Notes (optionnel)
          </label>
          <textarea
            id="schedule-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Ajouter des notes..."
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
            disabled={isPending}
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 font-medium flex items-center justify-center gap-2"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Creation...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              Creer la planification
            </>
          )}
        </button>
      </form>
    </div>
  )
}
