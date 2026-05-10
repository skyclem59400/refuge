'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, X, Move, AlertCircle, Trash2 } from 'lucide-react'
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

  // Esc pour fermer
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm max-h-[80vh] flex flex-col rounded-2xl border border-border bg-surface shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/15 text-primary shrink-0">
              <Move className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-bold truncate">Déplacer {animalName}</h3>
              <p className="text-[11px] text-muted">
                {candidates.length} box compatible{candidates.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="text-muted hover:text-text shrink-0 p-1 rounded-lg hover:bg-surface-hover"
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pt-3 pb-2">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Chercher un box..."
            autoFocus
            className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {candidates.length === 0 ? (
            <p className="text-xs text-muted py-6 text-center italic">
              Aucun box compatible disponible.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {candidates.map((b) => {
                const remaining = b.capacity - b.current_count
                return (
                  <li key={b.id}>
                    <button
                      onClick={() => move(b.id)}
                      disabled={pending}
                      type="button"
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-surface-hover text-left disabled:opacity-50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{b.name}</div>
                        {b.zone_label && (
                          <div className="text-[11px] text-muted truncate">
                            {b.zone_label}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] font-mono text-muted">
                          {b.current_count}/{b.capacity}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-success/15 text-success">
                          +{remaining}
                        </span>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border/50 space-y-2">
          <button
            onClick={() => move(null)}
            disabled={pending}
            type="button"
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-border hover:bg-error/10 hover:text-error hover:border-error/40 transition-colors disabled:opacity-50"
          >
            {pending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Trash2 size={12} />
            )}
            Retirer du box
          </button>
          {error && (
            <p className="text-[11px] text-error flex items-center gap-1.5">
              <AlertCircle size={11} /> {error}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
