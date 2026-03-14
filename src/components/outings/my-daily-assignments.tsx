'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PawPrint, Loader2, Check, ListChecks, AlertTriangle } from 'lucide-react'
import { createOuting } from '@/lib/actions/outings'

interface Assignment {
  id: string
  animal_id: string
  assigned_to: string
  assigned_by: string
  date: string
  outing_id: string | null
  notes: string | null
  animals: {
    id: string
    name: string
    species: string
    photo_url: string | null
    establishment_id: string
    animal_photos: { id: string; url: string; is_primary: boolean }[]
  }
}

interface MyDailyAssignmentsProps {
  assignments: Assignment[]
  canManageOutings: boolean
}

const QUICK_DURATIONS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '1h', value: 60 },
]

function getAnimalPhoto(animal: Assignment['animals']): string | null {
  const primary = animal.animal_photos?.find((p) => p.is_primary)
  if (primary) return primary.url
  if (animal.animal_photos?.length > 0) return animal.animal_photos[0].url
  return animal.photo_url
}

export function MyDailyAssignments({ assignments, canManageOutings }: Readonly<MyDailyAssignmentsProps>) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [ratingComment, setRatingComment] = useState('')

  if (assignments.length === 0) return null

  const pending = assignments.filter((a) => a.outing_id === null)
  const completed = assignments.filter((a) => a.outing_id !== null)

  function handleRecord(animalId: string, duration: number) {
    if (rating == null) {
      toast.error('Une notation de 1 a 10 est obligatoire')
      return
    }
    if (!ratingComment.trim()) {
      toast.error('Un commentaire est obligatoire pour toute sortie')
      return
    }
    startTransition(async () => {
      const result = await createOuting({
        animal_id: animalId,
        duration_minutes: duration,
        notes: notes.trim() || null,
        rating,
        rating_comment: ratingComment.trim() || null,
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Sortie enregistree')
        setActiveAssignmentId(null)
        setNotes('')
        setRating(null)
        setRatingComment('')
        router.refresh()
      }
    })
  }

  function resetForm() {
    setActiveAssignmentId(null)
    setNotes('')
    setRating(null)
    setRatingComment('')
  }

  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-4">
        <ListChecks className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Mes sorties du jour</h2>
        <span className="text-sm text-muted">
          {completed.length}/{assignments.length} effectuees
        </span>
      </div>

      {/* Pending assignments */}
      {pending.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-3">
          {pending.map((assignment) => {
            const photo = getAnimalPhoto(assignment.animals)
            const isActive = activeAssignmentId === assignment.id
            const today = new Date().toISOString().split('T')[0]
            const isOverdue = assignment.date < today

            return (
              <div
                key={assignment.id}
                className={`bg-surface rounded-xl border p-3 ${isOverdue ? 'border-warning/40' : 'border-border'}`}
              >
                {isOverdue && (
                  <div className="flex items-center gap-1.5 mb-2 text-warning">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-medium">
                      En retard (depuis le {new Date(assignment.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })})
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-3 mb-2">
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo}
                      alt={assignment.animals.name}
                      className="w-10 h-10 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-muted/20 flex items-center justify-center shrink-0">
                      <PawPrint className="w-5 h-5 text-muted" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">{assignment.animals.name}</p>
                    {assignment.notes && (
                      <p className="text-[11px] text-muted truncate">{assignment.notes}</p>
                    )}
                  </div>
                </div>

                {canManageOutings && !isActive && (
                  <button
                    onClick={() => {
                      resetForm()
                      setActiveAssignmentId(assignment.id)
                    }}
                    className="w-full text-center px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  >
                    Enregistrer une sortie
                  </button>
                )}

                {isActive && (
                  <div className="space-y-2 pt-1 border-t border-border mt-2">
                    {/* Rating selector */}
                    <div>
                      <p className="text-[11px] font-medium text-muted mb-1">Note de la sortie</p>
                      <div className="flex gap-1">
                        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
                          let ratingColorClass = 'bg-surface-hover text-muted hover:text-text'
                          if (rating === n) {
                            if (n <= 3) ratingColorClass = 'bg-red-500 text-white'
                            else if (n <= 5) ratingColorClass = 'bg-orange-500 text-white'
                            else if (n <= 7) ratingColorClass = 'bg-yellow-500 text-white'
                            else ratingColorClass = 'bg-green-500 text-white'
                          }
                          return (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setRating(rating === n ? null : n)}
                              className={`flex-1 py-1 rounded text-[11px] font-bold transition-colors ${ratingColorClass}`}
                            >
                              {n}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Rating comment (always mandatory) */}
                    {rating != null && (
                      <textarea
                        value={ratingComment}
                        onChange={(e) => setRatingComment(e.target.value)}
                        placeholder="Commentaire obligatoire pour toute sortie"
                        required
                        rows={2}
                        className={`w-full px-2 py-1.5 bg-surface border rounded text-xs focus:outline-none focus:ring-1 resize-none ${
                          rating <= 5
                            ? 'border-red-500/30 focus:ring-red-500/50'
                            : 'border-border focus:ring-primary/50'
                        }`}
                      />
                    )}

                    {/* Duration buttons */}
                    <div className="flex gap-1.5">
                      {QUICK_DURATIONS.map((d) => (
                        <button
                          key={d.value}
                          onClick={() => handleRecord(assignment.animal_id, d.value)}
                          disabled={isPending || rating == null || !ratingComment.trim()}
                          className="flex-1 px-1 py-1.5 rounded text-xs font-medium bg-primary text-white hover:bg-primary-dark transition-colors disabled:opacity-50"
                        >
                          {isPending ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : d.label}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Notes (optionnel)"
                      className="w-full px-2 py-1.5 bg-surface border border-border rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                    <button
                      onClick={resetForm}
                      className="w-full text-center text-xs text-muted hover:text-text transition-colors"
                    >
                      Annuler
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Completed assignments */}
      {completed.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {completed.map((assignment) => {
            const photo = getAnimalPhoto(assignment.animals)

            return (
              <div
                key={assignment.id}
                className="bg-surface rounded-xl border border-border p-3 opacity-60"
              >
                <div className="flex items-center gap-3">
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo}
                      alt={assignment.animals.name}
                      className="w-10 h-10 rounded-full object-cover shrink-0 grayscale"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-muted/20 flex items-center justify-center shrink-0">
                      <PawPrint className="w-5 h-5 text-muted" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">{assignment.animals.name}</p>
                    {assignment.notes && (
                      <p className="text-[11px] text-muted truncate">{assignment.notes}</p>
                    )}
                  </div>
                  <div className="shrink-0 w-6 h-6 rounded-full bg-success/20 flex items-center justify-center">
                    <Check className="w-3.5 h-3.5 text-success" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
