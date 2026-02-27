'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Clock, PawPrint, Loader2 } from 'lucide-react'
import { createOuting } from '@/lib/actions/outings'
import {
  getOutingUrgencyLevel,
  getOutingUrgencyColor,
  getOutingUrgencyLabel,
  getSpeciesLabel,
} from '@/lib/sda-utils'

interface AnimalWithPriority {
  id: string
  name: string
  species: string
  photo_url: string | null
  status: string
  box_id: string | null
  animal_photos: { id: string; url: string; is_primary: boolean }[]
  last_outing_at: string | null
  days_since_last_outing: number | null
}

interface OutingPriorityListProps {
  animals: AnimalWithPriority[]
  canManageOutings: boolean
}

const QUICK_DURATIONS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '1h', value: 60 },
]

function getAnimalPhoto(animal: AnimalWithPriority): string | null {
  const primary = animal.animal_photos?.find((p) => p.is_primary)
  if (primary) return primary.url
  if (animal.animal_photos?.length > 0) return animal.animal_photos[0].url
  return animal.photo_url
}

export function OutingPriorityList({ animals, canManageOutings }: OutingPriorityListProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [activeAnimalId, setActiveAnimalId] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [speciesFilter, setSpeciesFilter] = useState<'all' | 'dog' | 'cat'>('all')

  const filtered = speciesFilter === 'all'
    ? animals
    : animals.filter((a) => a.species === speciesFilter)

  function handleRecord(animalId: string, duration: number) {
    startTransition(async () => {
      const result = await createOuting({
        animal_id: animalId,
        duration_minutes: duration,
        notes: notes.trim() || null,
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Sortie enregistree')
        setActiveAnimalId(null)
        setNotes('')
        router.refresh()
      }
    })
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Priorite de sortie</h2>
        <div className="flex gap-1">
          {(['all', 'dog', 'cat'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setSpeciesFilter(f)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors
                ${speciesFilter === f
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted hover:text-text hover:bg-surface-hover'
                }`}
            >
              {f === 'all' ? 'Tous' : f === 'dog' ? 'Chiens' : 'Chats'}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-surface rounded-xl border border-border p-8 text-center">
          <PawPrint className="w-10 h-10 text-muted mx-auto mb-3" />
          <p className="text-muted text-sm">Aucun animal actif</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((animal) => {
            const urgency = getOutingUrgencyLevel(animal.days_since_last_outing)
            const urgencyColor = getOutingUrgencyColor(urgency)
            const urgencyLabel = getOutingUrgencyLabel(animal.days_since_last_outing)
            const photo = getAnimalPhoto(animal)
            const isActive = activeAnimalId === animal.id

            return (
              <div
                key={animal.id}
                className={`bg-surface rounded-xl border p-3 transition-all ${urgencyColor}`}
              >
                <div className="flex items-center gap-3 mb-2">
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo}
                      alt={animal.name}
                      className="w-10 h-10 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-muted/20 flex items-center justify-center shrink-0">
                      <PawPrint className="w-5 h-5 text-muted" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">{animal.name}</p>
                    <p className="text-xs opacity-75">{getSpeciesLabel(animal.species)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 mb-2">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-xs font-medium">{urgencyLabel}</span>
                </div>

                {canManageOutings && !isActive && (
                  <button
                    onClick={() => setActiveAnimalId(animal.id)}
                    className="w-full text-center px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  >
                    Enregistrer une sortie
                  </button>
                )}

                {isActive && (
                  <div className="space-y-2 pt-1 border-t border-current/10 mt-2">
                    <div className="flex gap-1.5">
                      {QUICK_DURATIONS.map((d) => (
                        <button
                          key={d.value}
                          onClick={() => handleRecord(animal.id, d.value)}
                          disabled={isPending}
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
                      placeholder="Commentaire (optionnel)"
                      className="w-full px-2 py-1.5 bg-surface border border-border rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                    <button
                      onClick={() => { setActiveAnimalId(null); setNotes('') }}
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
    </div>
  )
}
