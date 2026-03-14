'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pill, Clock, Calendar, StopCircle, Trash2, Pencil } from 'lucide-react'
import { stopTreatment, deleteTreatment } from '@/lib/actions/treatments'
import { TreatmentForm } from './treatment-form'
import type { AnimalTreatment, AnimalHealthRecord } from '@/lib/types/database'

type TreatmentWithAnimal = AnimalTreatment & {
  animals: { id: string; nom: string; species: string }
}

const frequencyLabels: Record<string, string> = {
  daily: 'Quotidien',
  twice_daily: '2x/jour',
  weekly: 'Hebdo',
  custom: 'Personnalise',
}

interface TreatmentListProps {
  treatments: TreatmentWithAnimal[]
  animals: { id: string; nom: string }[]
  healthRecords: AnimalHealthRecord[]
  canManage: boolean
}

export function TreatmentList({ treatments, animals, healthRecords, canManage }: Readonly<TreatmentListProps>) {
  const [filter, setFilter] = useState<'active' | 'stopped' | 'all'>('active')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const filtered = treatments.filter((t) => {
    if (filter === 'active') return t.active
    if (filter === 'stopped') return !t.active
    return true
  })

  function handleStop(id: string) {
    startTransition(async () => {
      const result = await stopTreatment(id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Traitement arrete')
        router.refresh()
      }
    })
  }

  function confirmDelete() {
    if (!deletingId) return
    startTransition(async () => {
      const result = await deleteTreatment(deletingId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Traitement supprime')
        router.refresh()
      }
      setDeletingId(null)
    })
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex gap-1 mb-4 bg-surface-dark rounded-lg p-1">
        {(['active', 'stopped', 'all'] as const).map((key) => {
          const labels = { active: 'Actifs', stopped: 'Termines', all: 'Tous' }
          const count = key === 'all'
            ? treatments.length
            : treatments.filter((t) => key === 'active' ? t.active : !t.active).length
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filter === key
                  ? 'bg-surface text-text shadow-sm'
                  : 'text-muted hover:text-text'
              }`}
            >
              {labels[key]} ({count})
            </button>
          )
        })}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-8 text-muted text-sm">
          Aucun traitement
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((treatment) => (
            <div
              key={treatment.id}
              className={`bg-surface rounded-lg border border-border p-4 transition-colors ${
                treatment.active ? 'hover:bg-surface-hover' : 'opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Pill className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm font-semibold text-text">{treatment.name}</span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">
                      {frequencyLabels[treatment.frequency] || treatment.frequency}
                    </span>
                    {!treatment.active && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-surface-dark text-muted">
                        Termine
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-muted mt-1">
                    {treatment.animals.nom}
                  </p>

                  {treatment.description && (
                    <p className="text-xs text-muted mt-1 line-clamp-2">{treatment.description}</p>
                  )}

                  <div className="flex items-center gap-3 mt-2 text-xs text-muted">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(treatment.start_date).toLocaleDateString('fr-FR')}
                      {treatment.end_date && ` — ${new Date(treatment.end_date).toLocaleDateString('fr-FR')}`}
                    </span>
                    {treatment.times.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {treatment.times.join(', ')}
                      </span>
                    )}
                  </div>
                </div>

                {canManage && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => setEditingId(editingId === treatment.id ? null : treatment.id)}
                      disabled={isPending}
                      className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                      title="Modifier le traitement"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    {treatment.active && (
                      <button
                        onClick={() => handleStop(treatment.id)}
                        disabled={isPending}
                        className="p-1.5 rounded-lg text-muted hover:text-warning hover:bg-warning/10 transition-colors"
                        title="Arreter le traitement"
                      >
                        <StopCircle className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => setDeletingId(treatment.id)}
                      className="p-1.5 rounded-lg text-muted hover:text-error hover:bg-error/10 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              {/* Inline edit form */}
              {editingId === treatment.id && (
                <div className="mt-3 pt-3 border-t border-border">
                  <TreatmentForm
                    animals={animals}
                    healthRecords={healthRecords}
                    editingTreatment={treatment}
                    preselectedAnimalId={treatment.animal_id}
                    onClose={() => setEditingId(null)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deletingId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-xl border border-border w-full max-w-sm p-5">
            <h3 className="text-lg font-bold text-text mb-2">Supprimer le traitement ?</h3>
            <p className="text-sm text-muted mb-5">
              Cette action est irreversible. L&apos;historique des administrations sera egalement supprime.
            </p>
            <div className="flex gap-3">
              <button
                onClick={confirmDelete}
                disabled={isPending}
                className="flex-1 px-3 py-2 rounded-lg font-semibold text-white text-sm
                  bg-red-600 hover:bg-red-700 transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? 'Suppression...' : 'Supprimer'}
              </button>
              <button
                onClick={() => setDeletingId(null)}
                disabled={isPending}
                className="flex-1 px-3 py-2 rounded-lg font-semibold text-sm text-muted
                  bg-surface-dark hover:bg-surface-hover transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
