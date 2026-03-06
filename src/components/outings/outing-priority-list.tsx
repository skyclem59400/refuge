'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Clock, PawPrint, Loader2, Search, HardHat } from 'lucide-react'
import { createOuting } from '@/lib/actions/outings'
import {
  getOutingUrgencyLevel,
  getOutingUrgencyColor,
  getOutingUrgencyLabel,
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
  canCreateTig?: boolean
}

const QUICK_DURATIONS = [
  { label: '15', value: 15 },
  { label: '30', value: 30 },
  { label: '45', value: 45 },
  { label: '60', value: 60 },
]

function getAnimalPhoto(animal: AnimalWithPriority): string | null {
  const primary = animal.animal_photos?.find((p) => p.is_primary)
  if (primary) return primary.url
  if (animal.animal_photos?.length > 0) return animal.animal_photos[0].url
  return animal.photo_url
}

export function OutingPriorityList({ animals, canManageOutings, canCreateTig = false }: Readonly<OutingPriorityListProps>) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [activeAnimalId, setActiveAnimalId] = useState<string | null>(null)
  const [isTigMode, setIsTigMode] = useState(false)
  const [tigName, setTigName] = useState('')
  const [notes, setNotes] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [ratingComment, setRatingComment] = useState('')
  const [customDuration, setCustomDuration] = useState('')
  const [search, setSearch] = useState('')

  const filtered = search.trim()
    ? animals.filter((a) => a.name.toLowerCase().includes(search.trim().toLowerCase()))
    : animals

  function resetForm() {
    setActiveAnimalId(null)
    setIsTigMode(false)
    setTigName('')
    setNotes('')
    setRating(null)
    setRatingComment('')
    setCustomDuration('')
  }

  function handleRecord(animalId: string, duration: number) {
    if (rating != null && rating <= 5 && !ratingComment.trim()) {
      toast.error('Un commentaire est obligatoire pour une note de 5 ou moins')
      return
    }
    startTransition(async () => {
      const result = await createOuting({
        animal_id: animalId,
        duration_minutes: duration,
        notes: notes.trim() || null,
        rating,
        rating_comment: ratingComment.trim() || null,
        is_tig: isTigMode,
        tig_walker_name: isTigMode ? (tigName.trim() || null) : null,
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(isTigMode ? 'Sortie TIG enregistree' : 'Sortie enregistree')
        resetForm()
        router.refresh()
      }
    })
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4 gap-3">
        <h2 className="text-lg font-semibold shrink-0">Priorite de sortie</h2>
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un chien..."
            className="w-full pl-8 pr-3 py-1.5 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-surface rounded-xl border border-border p-8 text-center">
          <PawPrint className="w-10 h-10 text-muted mx-auto mb-3" />
          <p className="text-muted text-sm">
            {search.trim() !== '' ? 'Aucun chien trouve' : 'Aucun chien actif'}
          </p>
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
                  </div>
                </div>

                <div className="flex items-center gap-1.5 mb-2">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-xs font-medium">{urgencyLabel}</span>
                </div>

                {canManageOutings && !isActive && (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => { setActiveAnimalId(animal.id); setIsTigMode(false) }}
                      className="flex-1 text-center px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    >
                      Enregistrer une sortie
                    </button>
                    {canCreateTig && (
                      <button
                        onClick={() => { setActiveAnimalId(animal.id); setIsTigMode(true) }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition-colors"
                        title="Sortie effectuee par un TIG"
                      >
                        <HardHat className="w-3.5 h-3.5" />
                        TIG
                      </button>
                    )}
                  </div>
                )}

                {isActive && (
                  <div className="space-y-2 pt-1 border-t border-current/10 mt-2">
                    {/* TIG indicator + name field */}
                    {isTigMode && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-amber-500">
                          <HardHat className="w-3.5 h-3.5" />
                          <span className="text-xs font-bold">Sortie TIG</span>
                        </div>
                        <input
                          type="text"
                          value={tigName}
                          onChange={(e) => setTigName(e.target.value)}
                          placeholder="Nom du TIG (optionnel)"
                          className="w-full px-2 py-1.5 bg-surface border border-amber-500/30 rounded text-xs focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                        />
                      </div>
                    )}

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

                    {/* Rating comment (mandatory for 1-5) */}
                    {rating != null && rating <= 5 && (
                      <textarea
                        value={ratingComment}
                        onChange={(e) => setRatingComment(e.target.value)}
                        placeholder="Commentaire obligatoire pour une note <= 5"
                        required
                        rows={2}
                        className="w-full px-2 py-1.5 bg-surface border border-red-500/30 rounded text-xs focus:outline-none focus:ring-1 focus:ring-red-500/50 resize-none"
                      />
                    )}
                    {rating != null && rating > 5 && (
                      <textarea
                        value={ratingComment}
                        onChange={(e) => setRatingComment(e.target.value)}
                        placeholder="Commentaire (optionnel)"
                        rows={2}
                        className="w-full px-2 py-1.5 bg-surface border border-border rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
                      />
                    )}

                    {/* Duration input */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="1"
                          value={customDuration}
                          onChange={(e) => setCustomDuration(e.target.value)}
                          placeholder="Duree (min)"
                          className="flex-1 px-2 py-1.5 bg-surface border border-border rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
                        />
                        <button
                          onClick={() => {
                            const d = parseInt(customDuration)
                            if (!d || d < 1) { toast.error('Duree invalide'); return }
                            handleRecord(animal.id, d)
                          }}
                          disabled={isPending || !customDuration || (rating != null && rating <= 5 && !ratingComment.trim())}
                          className="px-3 py-1.5 rounded text-xs font-medium bg-primary text-white hover:bg-primary-dark transition-colors disabled:opacity-50"
                        >
                          {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'OK'}
                        </button>
                      </div>
                      <div className="flex gap-1">
                        {QUICK_DURATIONS.map((d) => (
                          <button
                            key={d.value}
                            type="button"
                            onClick={() => setCustomDuration(String(d.value))}
                            className={`flex-1 py-1 rounded text-[11px] font-medium transition-colors ${
                              customDuration === String(d.value)
                                ? 'bg-primary/20 text-primary'
                                : 'bg-surface-hover text-muted hover:text-text'
                            }`}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
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
    </div>
  )
}
