'use client'

import { useState, useTransition, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  Loader2,
  X,
  Save,
  AlertCircle,
  Settings,
  Trash2,
  AlertTriangle,
} from 'lucide-react'
import { updateBox, deleteBox } from '@/lib/actions/boxes'
import type { AnimalSpecies, BoxSpecies, BoxStatus } from '@/lib/types/database'
import type { BoxZone } from '@/lib/actions/box-zones'
import type { EnrichedBox } from './types'
import {
  ALL_SPECIES,
  SPECIES_EMOJIS,
  SPECIES_LABELS_PLURAL,
  getSpeciesLabelPlural,
} from '@/lib/species'

interface Props {
  box: EnrichedBox
  zones: BoxZone[]
  onClose: () => void
}

export function EditBoxDrawer({ box, zones, onClose }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [mounted, setMounted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  // Form state
  const [name, setName] = useState(box.name)
  const [capacity, setCapacity] = useState(box.capacity)
  const [speciesType, setSpeciesType] = useState<BoxSpecies>(box.species_type)
  const [status, setStatus] = useState<BoxStatus>(box.status)
  const [zoneId, setZoneId] = useState<string>(box.zone_id ?? '')

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Animaux actuellement dans le box
  const animalCount = box.animal_count
  const currentSpecies = new Set(box.animals.map((a) => a.species))
  const hasDogs = currentSpecies.has('dog')
  const hasCats = currentSpecies.has('cat')

  // Validations live
  const capacityTooLow = capacity < animalCount
  // species_type 'mixed', 'farm' et 'other' acceptent tout.
  // Sinon, il faut que toutes les espèces présentes correspondent au type sélectionné.
  const isWildcard = speciesType === 'mixed' || speciesType === 'farm' || speciesType === 'other'
  const speciesIncompatible = !isWildcard && Array.from(currentSpecies).some((s) => s !== speciesType)

  const zoneOptions = zones
    .map((z) => {
      const parent = z.parent_id ? zones.find((p) => p.id === z.parent_id) : null
      return { id: z.id, label: parent ? `${parent.name} › ${z.name}` : z.name }
    })
    .sort((a, b) => a.label.localeCompare(b.label))

  function save() {
    if (capacityTooLow) {
      setError(
        `Capacité (${capacity}) inférieure au nombre d'animaux dans le box (${animalCount}).`
      )
      return
    }
    if (speciesIncompatible) {
      const present = Array.from(currentSpecies)
        .map((s) => getSpeciesLabelPlural(s))
        .join(', ')
      setError(`Espèce incompatible : ${present} déjà dans ce box. Déplace-les d'abord.`)
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await updateBox(box.id, {
        name: name.trim(),
        capacity,
        species_type: speciesType,
        status,
        zone_id: zoneId || null,
      })
      if (result.error) setError(result.error)
      else {
        router.refresh()
        onClose()
      }
    })
  }

  function handleDelete() {
    setError(null)
    startTransition(async () => {
      const result = await deleteBox(box.id)
      if (result.error) {
        setError(result.error)
        setConfirmingDelete(false)
      } else {
        router.refresh()
        onClose()
      }
    })
  }

  if (!mounted) return null

  return createPortal(
    <>
      <div className="fixed inset-0 z-[99] bg-black/50" onClick={onClose} aria-hidden />

      <aside
        className="fixed top-0 right-0 z-[100] h-screen w-full sm:w-[440px] bg-surface border-l border-border shadow-2xl flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label={`Modifier ${box.name}`}
      >
        {/* Header */}
        <header className="px-5 py-4 border-b border-border/50 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/15 text-primary shrink-0">
              <Settings className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h3 className="text-base font-bold truncate">Modifier {box.name}</h3>
              <p className="text-xs text-muted">
                {animalCount} animal{animalCount !== 1 ? 'x' : ''} actuellement
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

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
          {/* Nom */}
          <Field label="Nom du box">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </Field>

          {/* Espèce — boutons rapides chien/chat/mixte + select pour les autres */}
          <Field
            label="Espèce"
            warning={
              speciesIncompatible
                ? `${Array.from(currentSpecies).map((s) => getSpeciesLabelPlural(s)).join(', ')} déjà présents — déplace-les avant de changer`
                : undefined
            }
          >
            <div className="grid grid-cols-3 gap-2 mb-2">
              {(['cat', 'dog', 'mixed'] as BoxSpecies[]).map((s) => {
                const incompat =
                  s === 'cat' ? hasDogs : s === 'dog' ? hasCats : false
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSpeciesType(s)}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold border transition-colors flex items-center justify-center gap-1.5 ${
                      speciesType === s
                        ? 'bg-primary text-white border-primary'
                        : incompat
                          ? 'border-warning/40 bg-warning/5 text-warning hover:bg-warning/10'
                          : 'border-border bg-surface hover:bg-surface-hover'
                    }`}
                  >
                    <span>{s === 'cat' ? '🐱' : s === 'dog' ? '🐶' : '🐾'}</span>
                    <span>{s === 'cat' ? 'Chats' : s === 'dog' ? 'Chiens' : 'Mixte'}</span>
                  </button>
                )
              })}
            </div>
            <select
              value={!['cat', 'dog', 'mixed'].includes(speciesType) ? speciesType : ''}
              onChange={(e) => {
                if (e.target.value) setSpeciesType(e.target.value as BoxSpecies)
              }}
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">— Autre espèce (ferme, NAC…) —</option>
              <option value="farm">🚜 Ferme (mixte)</option>
              {ALL_SPECIES.filter((s) => s !== 'dog' && s !== 'cat' && s !== 'other').map((s) => (
                <option key={s} value={s}>
                  {SPECIES_EMOJIS[s as AnimalSpecies]} {SPECIES_LABELS_PLURAL[s as AnimalSpecies]}
                </option>
              ))}
              <option value="other">🐾 Autres</option>
            </select>
          </Field>

          {/* Capacité */}
          <Field
            label="Capacité"
            warning={
              capacityTooLow
                ? `Trop bas : ${animalCount} animal${animalCount !== 1 ? 'x' : ''} dans le box`
                : undefined
            }
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCapacity(Math.max(1, capacity - 1))}
                className="w-10 h-10 rounded-lg border border-border bg-surface hover:bg-surface-hover text-lg font-bold"
              >
                −
              </button>
              <input
                type="number"
                value={capacity}
                onChange={(e) =>
                  setCapacity(Math.max(1, parseInt(e.target.value, 10) || 1))
                }
                min={1}
                className="flex-1 px-3 py-2 rounded-lg border border-border bg-surface text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <button
                type="button"
                onClick={() => setCapacity(capacity + 1)}
                className="w-10 h-10 rounded-lg border border-border bg-surface hover:bg-surface-hover text-lg font-bold"
              >
                +
              </button>
            </div>
            <p className="mt-1 text-[11px] text-muted">
              Place{capacity > 1 ? 's' : ''} disponible
              {capacity > 1 ? 's' : ''} pour les animaux
            </p>
          </Field>

          {/* Zone */}
          <Field label="Zone">
            <select
              value={zoneId}
              onChange={(e) => setZoneId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">— Aucune zone —</option>
              {zoneOptions.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.label}
                </option>
              ))}
            </select>
          </Field>

          {/* Statut */}
          <Field label="Statut">
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { v: 'available', label: 'Disponible', color: 'bg-success' },
                  { v: 'occupied', label: 'Occupé', color: 'bg-warning' },
                  { v: 'maintenance', label: 'Maintenance', color: 'bg-error' },
                ] as { v: BoxStatus; label: string; color: string }[]
              ).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setStatus(opt.v)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors flex items-center justify-center gap-1.5 ${
                    status === opt.v
                      ? 'bg-primary text-white border-primary'
                      : 'border-border bg-surface hover:bg-surface-hover'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${opt.color}`} />
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>

          {/* Zone danger : suppression */}
          <div className="pt-4 mt-4 border-t border-border/50">
            <p className="text-[10px] uppercase tracking-[0.15em] font-bold text-muted mb-2">
              Zone de danger
            </p>
            {!confirmingDelete ? (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border border-error/30 text-error hover:bg-error/10 transition-colors"
              >
                <Trash2 size={14} />
                Supprimer ce box
              </button>
            ) : (
              <div className="rounded-lg border border-error/40 bg-error/10 p-3 space-y-2">
                <p className="text-xs text-error flex items-start gap-1.5">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>
                    Supprimer définitivement « {box.name} » ?
                    {animalCount > 0 && (
                      <span className="block mt-1 font-bold">
                        Impossible : {animalCount} animal{animalCount !== 1 ? 'x' : ''} encore présent{animalCount !== 1 ? 's' : ''}.
                      </span>
                    )}
                  </span>
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    className="flex-1 px-3 py-1.5 rounded-md text-xs font-semibold border border-border hover:bg-surface-hover"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={pending || animalCount > 0}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold bg-error text-white hover:bg-error/90 disabled:opacity-50"
                  >
                    {pending ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                    Confirmer
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="px-5 py-4 border-t border-border/50 space-y-2 shrink-0">
          {error && (
            <p className="text-xs text-error flex items-start gap-1.5">
              <AlertCircle size={12} className="mt-0.5 shrink-0" />
              <span>{error}</span>
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
              onClick={save}
              disabled={pending || !name.trim() || capacityTooLow || speciesIncompatible}
              type="button"
              className="flex-[2] inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-bold gradient-primary text-white hover:opacity-90 disabled:opacity-50 shadow-md shadow-primary/30 transition-all"
            >
              {pending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Enregistrer
            </button>
          </div>
        </footer>
      </aside>
    </>,
    document.body
  )
}

// ---------------------------------------------------------------------------
// Champ avec label + warning
// ---------------------------------------------------------------------------

function Field({
  label,
  warning,
  children,
}: {
  label: string
  warning?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-xs font-semibold text-muted uppercase tracking-wider">
          {label}
        </label>
        {warning && (
          <span className="text-[10px] text-warning flex items-center gap-1">
            <AlertCircle size={10} />
            {warning}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}
