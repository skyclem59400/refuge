'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, X, Move, Check } from 'lucide-react'
import { moveAnimalToBox } from '@/lib/actions/box-assignments'
import type { BoxSummary } from './types'

interface Props {
  animalId: string
  animalName: string
  animalSpecies: string
  currentBoxId: string
  allBoxes: BoxSummary[]
  onClose: () => void
}

export function MoveAnimalMenu({
  animalId,
  animalName,
  animalSpecies,
  currentBoxId,
  allBoxes,
  onClose,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

  // Box compatibles (espece + capacite + pas le box actuel)
  const candidates = allBoxes.filter((b) => {
    if (b.id === currentBoxId) return false
    if (b.species_type !== 'mixed' && b.species_type !== animalSpecies) return false
    if (b.current_count >= b.capacity) return false
    if (filter && !b.name.toLowerCase().includes(filter.toLowerCase())) return false
    return true
  })

  function move(targetBoxId: string | null) {
    setError(null)
    startTransition(async () => {
      const result = await moveAnimalToBox(animalId, targetBoxId)
      if (result.error) setError(result.error)
      else {
        router.refresh()
        onClose()
      }
    })
  }

  return (
    <div
      className="absolute z-50 left-1/2 -translate-x-1/2 top-full mt-1 w-72 rounded-xl border border-border bg-surface shadow-2xl backdrop-blur-md p-3 animate-fade-up ring-1 ring-white/5"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Move className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-bold">Déplacer {animalName}</span>
        </div>
        <button
          onClick={onClose}
          type="button"
          className="text-muted hover:text-text"
        >
          <X size={14} />
        </button>
      </div>

      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Chercher un box..."
        className="w-full mb-2 rounded-md border border-border bg-surface px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
      />

      <div className="max-h-60 overflow-y-auto space-y-0.5">
        {candidates.length === 0 ? (
          <p className="text-[11px] text-muted py-3 text-center italic">
            Aucun box compatible disponible.
          </p>
        ) : (
          candidates.map((b) => {
            const remaining = b.capacity - b.current_count
            return (
              <button
                key={b.id}
                onClick={() => move(b.id)}
                disabled={pending}
                type="button"
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface-hover text-left disabled:opacity-50"
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-semibold truncate">
                    {b.name}
                  </span>
                  {b.zone_label && (
                    <span className="block text-[10px] text-muted truncate">
                      {b.zone_label}
                    </span>
                  )}
                </span>
                <span className="text-[10px] font-mono text-muted shrink-0">
                  {b.current_count}/{b.capacity}
                </span>
                <span className="text-[10px] text-success font-semibold shrink-0">
                  +{remaining}
                </span>
              </button>
            )
          })
        )}
      </div>

      {/* Retirer du box */}
      <div className="mt-2 pt-2 border-t border-border/40">
        <button
          onClick={() => move(null)}
          disabled={pending}
          type="button"
          className="w-full inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] font-semibold border border-border hover:bg-error/10 hover:text-error hover:border-error/40 transition-colors disabled:opacity-50"
        >
          {pending ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
          Retirer du box
        </button>
      </div>

      {error && (
        <p className="mt-2 text-[10px] text-error">{error}</p>
      )}
    </div>
  )
}
