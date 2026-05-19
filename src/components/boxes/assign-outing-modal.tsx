'use client'

import { useEffect, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { X, Loader2, Footprints, Search, Handshake } from 'lucide-react'
import { createAssignment, getOutingPartners } from '@/lib/actions/outings'
import { getEstablishmentMembers } from '@/lib/actions/establishments'
import { DatePicker } from '@/components/ui/date-picker'
import type { EstablishmentMember, OutingPartner } from '@/lib/types/database'

type Selection =
  | { kind: 'member'; userId: string; display: string }
  | { kind: 'partner'; partnerId: string; display: string; label: string | null }

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
  const [partners, setPartners] = useState<OutingPartner[] | null>(null)
  const [search, setSearch] = useState('')
  const [selection, setSelection] = useState<Selection | null>(null)
  const [date, setDate] = useState<string>(todayIso())
  const [notes, setNotes] = useState('')
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    Promise.all([getEstablishmentMembers(), getOutingPartners()])
      .then(([memRes, partRes]) => {
        if (cancelled) return
        if ('error' in memRes && memRes.error) {
          toast.error(memRes.error)
          setMembers([])
        } else if ('data' in memRes) {
          setMembers(memRes.data ?? [])
        } else {
          setMembers([])
        }
        if ('error' in partRes && partRes.error) {
          setPartners([])
        } else if ('data' in partRes) {
          setPartners((partRes.data ?? []) as OutingPartner[])
        } else {
          setPartners([])
        }
      })
      .catch((err) => {
        if (cancelled) return
        console.error('Loading members/partners failed:', err)
        toast.error('Impossible de charger les choix.')
        setMembers([])
        setPartners([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const q = search.trim().toLowerCase()
  const filteredMembers = (members ?? []).filter((m) => {
    if (!q) return true
    const name = (m.full_name ?? m.email ?? '').toLowerCase()
    return name.includes(q)
  })
  const filteredPartners = (partners ?? []).filter((p) => {
    if (!q) return true
    return p.name.toLowerCase().includes(q) || (p.default_outing_label?.toLowerCase().includes(q) ?? false)
  })

  function handleSubmit() {
    if (!selection) {
      toast.error('Sélectionnez la personne qui sort le chien.')
      return
    }
    startTransition(async () => {
      const result = await createAssignment({
        animal_id: animalId,
        assigned_to: selection.kind === 'member' ? selection.userId : null,
        partner_id: selection.kind === 'partner' ? selection.partnerId : null,
        date,
        notes: notes.trim() || null,
      })
      if ('error' in result && result.error) {
        toast.error(result.error)
        return
      }
      const tagSuffix = selection.kind === 'partner' && selection.label ? ` (${selection.label})` : ''
      toast.success(`Sortie assignée pour ${animalName}${tagSuffix}.`)
      router.refresh()
      onClose()
    })
  }

  const isToday = date === todayIso()

  return createPortal(
    <div
      className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        e.stopPropagation()
        if (e.target === e.currentTarget) onClose()
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
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

          {/* Liste membres + partenaires */}
          <div className="max-h-72 overflow-y-auto -mx-1 px-1 space-y-3">
            {(members === null || partners === null) && (
              <div className="flex items-center gap-2 text-sm text-muted py-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                Chargement…
              </div>
            )}

            {/* Partenaires externes (Akéla & co) */}
            {partners && filteredPartners.length > 0 && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted px-1 mb-1.5 flex items-center gap-1.5">
                  <Handshake className="w-3 h-3" /> Partenaires
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {filteredPartners.map((p) => {
                    const isSelected = selection?.kind === 'partner' && selection.partnerId === p.id
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelection({ kind: 'partner', partnerId: p.id, display: p.name, label: p.default_outing_label })}
                        className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
                          isSelected
                            ? 'bg-primary/15 border border-primary'
                            : 'bg-surface-dark hover:bg-surface-dark/70 border border-transparent'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
                          <Handshake className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{p.name}</div>
                          {p.default_outing_label && (
                            <div className="text-[11px] text-amber-500 truncate font-medium">
                              {p.default_outing_label}
                            </div>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Équipe */}
            {members && (
              <div>
                {(partners?.length ?? 0) > 0 && (
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted px-1 mb-1.5">
                    Équipe
                  </div>
                )}
                {filteredMembers.length === 0 && filteredPartners.length === 0 && (
                  <div className="text-sm text-muted py-4 text-center">
                    {search ? 'Personne ne correspond.' : 'Aucun membre dans l\'établissement.'}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {filteredMembers.map((m) => {
                    const isSelected = selection?.kind === 'member' && selection.userId === m.user_id
                    const display = m.full_name || m.email || m.user_id
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelection({ kind: 'member', userId: m.user_id, display })}
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
            )}
          </div>

          {/* Date + notes */}
          <div className="grid grid-cols-[auto_1fr] gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Date</label>
              <DatePicker
                value={date}
                onChange={(v) => setDate(v ?? todayIso())}
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
            disabled={pending || !selection}
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
