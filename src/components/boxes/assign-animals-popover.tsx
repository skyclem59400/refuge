'use client'

import { useState, useTransition, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Loader2, X, Plus, Search, UserPlus, AlertCircle, Check } from 'lucide-react'
import {
  listAssignableAnimals,
  assignAnimalsToBox,
  type AssignableAnimal,
} from '@/lib/actions/box-assignments'

interface Props {
  boxId: string
  boxName: string
  boxSpeciesType: string
  remainingCapacity: number
  onClose: () => void
}

function speciesLabel(s: string): string {
  if (s === 'cat') return 'Chats'
  if (s === 'dog') return 'Chiens'
  if (s === 'mixed') return 'Mixte'
  return s
}

function ineligibilityLabel(reason: string | null, boxSpecies: string): string {
  if (reason === 'species_mismatch') return `Box réservé aux ${speciesLabel(boxSpecies).toLowerCase()}`
  if (reason === 'wrong_status') return 'En famille d’accueil ou pension'
  return ''
}

export function AssignAnimalsPopover({
  boxId,
  boxName,
  boxSpeciesType,
  remainingCapacity,
  onClose,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [animals, setAnimals] = useState<AssignableAnimal[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Mount client-only (createPortal n'existe pas en SSR)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Bloque le scroll du body pendant que le drawer est ouvert
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // Charger les animaux candidats
  useEffect(() => {
    let cancelled = false
    listAssignableAnimals(boxId).then((res) => {
      if (cancelled) return
      if (res.error) setError(res.error)
      else setAnimals(res.data ?? [])
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [boxId])

  // Esc pour fermer
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const filtered = animals.filter((a) =>
    filter ? a.name.toLowerCase().includes(filter.toLowerCase()) : true
  )

  const limitReached = selected.size >= remainingCapacity

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < remainingCapacity) next.add(id)
      return next
    })
  }

  const eligibleCount = animals.filter((a) => a.eligible).length
  const ineligibleCount = animals.length - eligibleCount

  function submit() {
    if (selected.size === 0) return
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      const result = await assignAnimalsToBox(boxId, Array.from(selected))
      if (result.error) setError(result.error)
      else {
        setSuccess(
          `${result.assigned} animal${result.assigned !== 1 ? 'x' : ''} assigné${
            result.assigned !== 1 ? 's' : ''
          }.`
        )
        router.refresh()
        setTimeout(() => onClose(), 800)
      }
    })
  }

  if (!mounted) return null

  return createPortal(
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[99] bg-black/50" onClick={onClose} aria-hidden />

      {/* Drawer */}
      <aside
        className="fixed top-0 right-0 z-[100] h-screen w-full sm:w-[440px] bg-surface border-l border-border shadow-2xl flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label={`Assigner des animaux à ${boxName}`}
      >
        {/* Header */}
        <header className="px-5 py-4 border-b border-border/50 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/15 text-primary shrink-0">
              <UserPlus className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h3 className="text-base font-bold truncate">Assigner à {boxName}</h3>
              <p className="text-xs text-muted">
                {selected.size}/{remainingCapacity} sélectionné
                {selected.size !== 1 ? 's' : ''}
                {limitReached && (
                  <span className="ml-1 text-warning">· capacité atteinte</span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="text-muted hover:text-text shrink-0 p-1.5 rounded-lg hover:bg-surface-hover"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </header>

        {/* Search */}
        <div className="px-5 pt-3 pb-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Chercher un animal..."
              autoFocus
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <p className="mt-2 text-[11px] text-muted">
            <span className="text-success">{eligibleCount} compatible{eligibleCount !== 1 ? 's' : ''}</span>
            {ineligibleCount > 0 && (
              <> · <span className="text-warning">{ineligibleCount} non éligible{ineligibleCount !== 1 ? 's' : ''}</span></>
            )}
            {filter && (
              <> · {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}</>
            )}
          </p>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-2 py-1 min-h-0">
          {loading ? (
            <div className="py-12 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted" />
            </div>
          ) : error ? (
            <div className="py-10 px-4 text-center">
              <AlertCircle className="w-8 h-8 text-error mx-auto mb-2 opacity-70" />
              <p className="text-sm text-error">{error}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 px-4 text-center">
              <p className="text-sm text-muted italic">
                {animals.length === 0
                  ? 'Aucun animal au refuge.'
                  : 'Aucun résultat pour cette recherche.'}
              </p>
            </div>
          ) : (
            <ul className="space-y-0.5">
              {filtered.map((a) => {
                const isSelected = selected.has(a.id)
                const limitForCheckbox = !isSelected && limitReached
                // Non-eligible : non cliquable mais visible avec raison
                const isClickable = a.eligible && !limitForCheckbox
                const inOtherBox = a.current_box_id !== null
                const reasonLabel = ineligibilityLabel(a.ineligibility_reason, boxSpeciesType)
                return (
                  <li key={a.id}>
                    <button
                      onClick={() => isClickable && toggle(a.id)}
                      disabled={!isClickable}
                      type="button"
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                        isSelected
                          ? 'bg-primary/10 ring-1 ring-primary/40'
                          : a.eligible
                            ? 'hover:bg-surface-hover'
                            : 'bg-muted/5 cursor-not-allowed'
                      } ${limitForCheckbox ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      {/* Avatar */}
                      <div
                        className={`relative w-10 h-10 rounded-full overflow-hidden bg-muted/15 shrink-0 ${
                          !a.eligible ? 'grayscale opacity-60' : ''
                        }`}
                      >
                        {a.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={a.photo_url}
                            alt={a.name}
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-lg">
                            {a.species === 'cat' ? '🐱' : '🐶'}
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-sm font-semibold truncate ${
                              !a.eligible ? 'text-muted' : ''
                            }`}
                          >
                            {a.name}
                          </span>
                          {a.sex === 'male' && (
                            <span className="text-blue-500 text-sm font-bold">♂</span>
                          )}
                          {a.sex === 'female' && (
                            <span className="text-pink-500 text-sm font-bold">♀</span>
                          )}
                        </div>
                        {!a.eligible ? (
                          <span className="block text-[11px] text-warning truncate flex items-center gap-1">
                            <AlertCircle size={10} />
                            {reasonLabel}
                          </span>
                        ) : inOtherBox ? (
                          <span className="block text-[11px] text-amber-600 dark:text-amber-400 truncate flex items-center gap-1">
                            <AlertCircle size={10} />
                            Actuellement dans « {a.current_box_name} »
                          </span>
                        ) : (
                          <span className="block text-[11px] text-muted">Sans box</span>
                        )}
                      </div>

                      {/* Checkbox / lock */}
                      {a.eligible ? (
                        <span
                          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                            isSelected
                              ? 'bg-primary border-primary'
                              : 'border-border bg-surface'
                          }`}
                        >
                          {isSelected && <Check size={12} className="text-white" />}
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase tracking-wider font-bold text-muted shrink-0">
                          —
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <footer className="px-5 py-4 border-t border-border/50 space-y-2 shrink-0">
          {error && (
            <p className="text-xs text-error flex items-start gap-1.5">
              <AlertCircle size={12} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </p>
          )}
          {success && (
            <p className="text-xs text-success flex items-center gap-1.5">
              <Check size={12} /> {success}
            </p>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              type="button"
              className="flex-1 px-3 py-2.5 rounded-lg text-sm font-semibold border border-border hover:bg-surface-hover"
            >
              Annuler
            </button>
            <button
              onClick={submit}
              disabled={pending || selected.size === 0}
              type="button"
              className="flex-[2] inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-bold gradient-primary text-white hover:opacity-90 disabled:opacity-50 shadow-md shadow-primary/30 transition-all"
            >
              {pending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Plus size={14} />
              )}
              Assigner {selected.size > 0 && `(${selected.size})`}
            </button>
          </div>
        </footer>
      </aside>
    </>,
    document.body
  )
}
