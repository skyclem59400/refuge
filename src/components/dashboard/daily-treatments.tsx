'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pill, Check, Clock, PawPrint } from 'lucide-react'
import { administerTreatment } from '@/lib/actions/treatments'

interface TreatmentItem {
  id: string
  name: string
  description: string | null
  frequency: string
  times: string[]
  animal_name: string
  animal_photo: string | null
  animal_species: string
  administrations_today: {
    id: string
    time_slot: string | null
    administered_by: string
    created_at: string
  }[]
  is_complete: boolean
  completed_count: number
  expected_count: number
}

interface DailyTreatmentsProps {
  treatments: TreatmentItem[]
  userNames?: Record<string, string>
}

export function DailyTreatments({ treatments, userNames = {} }: Readonly<DailyTreatmentsProps>) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const totalExpected = treatments.reduce((sum, t) => sum + t.expected_count, 0)
  const totalCompleted = treatments.reduce((sum, t) => sum + t.completed_count, 0)
  const progressPercent = totalExpected > 0 ? Math.round((totalCompleted / totalExpected) * 100) : 100

  function handleAdminister(treatmentId: string, timeSlot?: string) {
    startTransition(async () => {
      const result = await administerTreatment({
        treatment_id: treatmentId,
        time_slot: timeSlot,
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Traitement valide')
        router.refresh()
      }
    })
  }

  // Group treatments by animal
  const byAnimal = new Map<string, TreatmentItem[]>()
  for (const t of treatments) {
    const key = t.animal_name
    if (!byAnimal.has(key)) byAnimal.set(key, [])
    byAnimal.get(key)!.push(t)
  }

  if (treatments.length === 0) {
    return (
      <div className="bg-surface rounded-xl border border-border p-5">
        <div className="flex items-center gap-2 mb-3">
          <Pill className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Traitements du jour</h3>
        </div>
        <p className="text-sm text-muted text-center py-4">
          Aucun traitement prevu aujourd&apos;hui
        </p>
      </div>
    )
  }

  return (
    <div className="bg-surface rounded-xl border border-border p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Pill className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Traitements du jour</h3>
        </div>
        <span className={`text-sm font-semibold ${progressPercent === 100 ? 'text-success' : 'text-warning'}`}>
          {totalCompleted}/{totalExpected}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-surface-dark rounded-full mb-4 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            progressPercent === 100 ? 'bg-success' : progressPercent > 50 ? 'bg-primary' : 'bg-warning'
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Treatments grouped by animal */}
      <div className="space-y-4">
        {Array.from(byAnimal.entries()).map(([animalName, animalTreatments]) => (
          <div key={animalName}>
            {/* Animal header */}
            <div className="flex items-center gap-2 mb-2">
              <PawPrint className="w-3.5 h-3.5 text-muted" />
              <span className="text-sm font-semibold text-text">{animalName}</span>
            </div>

            {/* Treatment slots */}
            <div className="space-y-1.5 ml-5">
              {animalTreatments.map((treatment) => {
                const slots = treatment.times.length > 0 ? treatment.times : [null]
                return slots.map((timeSlot, idx) => {
                  const administered = treatment.administrations_today.find(
                    (a) => (a.time_slot || '') === (timeSlot || '')
                  )
                  const done = !!administered

                  return (
                    <div
                      key={`${treatment.id}-${idx}`}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        done ? 'bg-success/5 border border-success/20' : 'bg-surface-dark border border-border'
                      }`}
                    >
                      {/* Check button or done indicator */}
                      {done ? (
                        <div className="w-6 h-6 rounded-full bg-success/15 flex items-center justify-center flex-shrink-0">
                          <Check className="w-3.5 h-3.5 text-success" />
                        </div>
                      ) : (
                        <button
                          onClick={() => handleAdminister(treatment.id, timeSlot || undefined)}
                          disabled={isPending}
                          className="w-6 h-6 rounded-full border-2 border-border hover:border-primary hover:bg-primary/10
                            transition-colors flex-shrink-0 disabled:opacity-50"
                          title="Valider le traitement"
                        />
                      )}

                      {/* Treatment info */}
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm ${done ? 'text-muted line-through' : 'text-text font-medium'}`}>
                          {treatment.name}
                        </span>
                        {treatment.description && (
                          <p className="text-[11px] text-muted truncate">{treatment.description}</p>
                        )}
                      </div>

                      {/* Time */}
                      {timeSlot && (
                        <span className="text-xs text-muted flex items-center gap-1 flex-shrink-0">
                          <Clock className="w-3 h-3" />
                          {timeSlot}
                        </span>
                      )}

                      {/* Who administered */}
                      {done && administered && (
                        <span className="text-[11px] text-muted flex-shrink-0">
                          {userNames[administered.administered_by] || 'Membre'}
                          {' — '}
                          {new Date(administered.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  )
                })
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
