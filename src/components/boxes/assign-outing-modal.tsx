'use client'

import { useEffect, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { X, Loader2, Footprints, Search } from 'lucide-react'
import { createAssignment } from '@/lib/actions/outings'
import { getEstablishmentMembers } from '@/lib/actions/establishments'
import type { EstablishmentMember } from '@/lib/types/database'

interface Props {
  animalId: string
  animalName: string
  animalPhotoUrl: string | null
  animalSpeciesEmoji: string
  onClose: () => void
}

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function AssignOutingModal({ animalId, animalName, animalPhotoUrl, animalSpeciesEmoji, onClose }: Props) {
  const router = useRouter()
  const [members, setMembers] = useState<EstablishmentMember[] | null>(null)
  const [search, setSearch] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [date, setDate] = useState<string>(todayIso())
  const [notes, setNotes] = useState('')
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    getEstablishmentMembers().then((res) => {
      if ('error' in res && res.error) {
        toast.error(res.error)
        setMembers([])
      } else if ('data' in res && res.data) {
        setMembers(res.data)
      }
    })
  }, [])

  const filtered = (members ?? []).filter((m) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    const name = (m.full_name ?? m.email ?? '').toLowerCase()
    return name.includes(q)
  })

  function handleSubmit() {
    if (!selectedUserId) {
      toast.error('Sélectionnez la personne qui sort le chien.')
      return
    }
    startTransition(async () => {
      const result = await createAssignment({
        animal_id: animalId,
        assigned_to: selectedUserId,
        date,
        notes: notes.trim() || null,
      })
      if ('error' in result && result.error) {
        toast.error(result.error)
        return
      }
      toast.success(`Sortie assignée pour ${animalName}.`)
      router.refresh()
      onClose()
    })
  }

  const isToday = date === todayIso()

  return createPortal(
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-surface border-b border-border px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-muted/15 shrink-0">
              {animalPhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={animalPhotoUrl} alt={animalName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xl">{animalSpeciesEmoji}</div>
              )}
            </div>
            <div>
              <h2 className="text-base font-semibold flex items-center gap-2">
                <Footprints className="w-4 h-4 text-primary" />
                Sortie pour {animalName}
              </h2>
              <p className="text-xs text-muted mt-0.5">Choisissez la personne qui sort le chien</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-dark text-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Recherche membre */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une personne..."
              className="w-full pl-9 pr-3 py-2 bg-surface-dark border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Liste membres */}
          <div className="max-h-64 overflow-y-auto -mx-1 px-1">
            {members === null && (
              <div className="flex items-center gap-2 text-sm text-muted py-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                Chargement de l'équipe…
              </div>
            )}
            {members && filtered.length === 0 && (
              <div className="text-sm text-muted py-4 text-center">
                {search ? 'Personne ne correspond.' : 'Aucun membre dans l\'établissement.'}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {filtered.map((m) => {
                const isSelected = selectedUserId === m.user_id
                const display = m.full_name || m.email || m.user_id
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedUserId(m.user_id)}
                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
                      isSelected
                        ? 'bg-primary/15 border border-primary'
                        : 'bg-surface-dark hover:bg-surface-dark/70 border border-transparent'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-muted/15 shrink-0">
                      {m.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.avatar_url} alt={display} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[11px] font-bold text-muted">
                          {display.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{display}</div>
                      {m.full_name && m.email && (
                        <div className="text-[11px] text-muted truncate">{m.email}</div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Date + notes */}
          <div className="grid grid-cols-[auto_1fr] gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="px-3 py-2 bg-surface-dark border border-border rounded-md text-sm"
              />
              {!isToday && (
                <button
                  type="button"
                  onClick={() => setDate(todayIso())}
                  className="text-[11px] text-primary hover:underline mt-1"
                >
                  Remettre à aujourd'hui
                </button>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Note (optionnel)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex : pas avec les autres chiens"
                className="w-full px-3 py-2 bg-surface-dark border border-border rounded-md text-sm"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-surface border-t border-border px-5 py-3 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={pending}
            className="px-4 py-2 rounded-lg text-sm font-medium text-muted hover:text-text"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={pending || !selectedUserId}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            {pending && <Loader2 className="w-4 h-4 animate-spin" />}
            Assigner la sortie
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
