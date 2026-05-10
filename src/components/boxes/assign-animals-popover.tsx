'use client'

import { useState, useTransition, useEffect } from 'react'
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
  remainingCapacity: number
  onClose: () => void
}

export function AssignAnimalsPopover({
  boxId,
  boxName,
  remainingCapacity,
  onClose,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [loading, setLoading] = useState(true)
  const [animals, setAnimals] = useState<AssignableAnimal[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

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

  return (
    <div
      className="absolute z-50 right-2 top-full mt-1 w-[340px] max-h-[460px] flex flex-col rounded-xl border border-border bg-surface shadow-2xl backdrop-blur-md ring-1 ring-white/5 animate-fade-up"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <UserPlus className="w-4 h-4 text-primary shrink-0" />
          <div className="min-w-0">
            <h3 className="text-sm font-bold truncate">Assigner à {boxName}</h3>
            <p className="text-[10px] text-muted">
              {selected.size}/{remainingCapacity} sélectionné{selected.size !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button onClick={onClose} type="button" className="text-muted hover:text-text shrink-0">
          <X size={14} />
        </button>
      </div>

      {/* Search */}
      <div className="px-4 pt-3">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Chercher un animal..."
            className="w-full pl-7 pr-2 py-1.5 rounded-md border border-border bg-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {loading ? (
          <div className="py-8 flex items-center justify-center">
            <Loader2 className="w-4 h-4 animate-spin text-muted" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-[11px] text-muted italic">
            Aucun animal compatible.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {filtered.map((a) => {
              const isSelected = selected.has(a.id)
              const isDisabled = !isSelected && limitReached
              const inOtherBox = a.current_box_id !== null
              return (
                <li key={a.id}>
                  <button
                    onClick={() => toggle(a.id)}
                    disabled={isDisabled}
                    type="button"
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors ${
                      isSelected
                        ? 'bg-primary/10 ring-1 ring-primary/40'
                        : 'hover:bg-surface-hover'
                    } ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    {/* Avatar */}
                    <div className="relative w-8 h-8 rounded-full overflow-hidden bg-muted/15 shrink-0">
                      {a.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={a.photo_url}
                          alt={a.name}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-base">
                          {a.species === 'cat' ? '🐱' : '🐶'}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-semibold truncate">{a.name}</span>
                        {a.sex === 'male' && (
                          <span className="text-blue-500 text-xs font-bold">♂</span>
                        )}
                        {a.sex === 'female' && (
                          <span className="text-pink-500 text-xs font-bold">♀</span>
                        )}
                      </div>
                      {inOtherBox && (
                        <span className="block text-[10px] text-amber-600 dark:text-amber-400 truncate flex items-center gap-1">
                          <AlertCircle size={9} />
                          Dans « {a.current_box_name} »
                        </span>
                      )}
                    </div>

                    {/* Checkbox */}
                    <span
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-primary border-primary'
                          : 'border-border bg-surface'
                      }`}
                    >
                      {isSelected && <Check size={10} className="text-white" />}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border/50 space-y-2">
        {error && (
          <p className="text-[11px] text-error flex items-center gap-1">
            <AlertCircle size={11} /> {error}
          </p>
        )}
        {success && (
          <p className="text-[11px] text-success flex items-center gap-1">
            <Check size={11} /> {success}
          </p>
        )}
        <button
          onClick={submit}
          disabled={pending || selected.size === 0}
          type="button"
          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold gradient-primary text-white hover:opacity-90 disabled:opacity-50 shadow-md shadow-primary/30 transition-all"
        >
          {pending ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Plus size={12} />
          )}
          Assigner {selected.size > 0 && `(${selected.size})`}
        </button>
      </div>
    </div>
  )
}
