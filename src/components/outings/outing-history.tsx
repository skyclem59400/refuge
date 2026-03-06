'use client'

import { Fragment, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Trash2, Footprints, PawPrint, HardHat, ChevronLeft, ChevronRight, X, Clock, Star, MessageSquare, Calendar, User } from 'lucide-react'
import { deleteOuting } from '@/lib/actions/outings'
import { formatOutingDuration, getSpeciesLabel } from '@/lib/sda-utils'
import { formatDateShort } from '@/lib/utils'

interface OutingWithAnimal {
  id: string
  animal_id: string
  walked_by: string
  started_at: string
  ended_at: string | null
  duration_minutes: number | null
  notes: string | null
  rating: number | null
  rating_comment: string | null
  is_tig?: boolean
  tig_walker_name?: string | null
  created_at: string
  animals: {
    id: string
    name: string
    species: string
    photo_url: string | null
    establishment_id: string
    animal_photos: { id: string; url: string; is_primary: boolean }[]
  }
}

interface OutingHistoryProps {
  outings: OutingWithAnimal[]
  userNames: Record<string, string>
  isAdmin: boolean
  currentUserId: string
  currentPage: number
  totalPages: number
}

function getRatingBadgeClass(rating: number): string {
  if (rating <= 3) return 'bg-red-500/15 text-red-400'
  if (rating <= 5) return 'bg-orange-500/15 text-orange-400'
  if (rating <= 7) return 'bg-yellow-500/15 text-yellow-400'
  return 'bg-green-500/15 text-green-400'
}

function getAnimalPhoto(animal: OutingWithAnimal['animals']): string | null {
  const primary = animal.animal_photos?.find((p) => p.is_primary)
  if (primary) return primary.url
  if (animal.animal_photos?.length > 0) return animal.animal_photos[0].url
  return animal.photo_url
}

function OutingDetailPanel({
  outing,
  userNames,
  onClose,
}: Readonly<{
  outing: OutingWithAnimal
  userNames: Record<string, string>
  onClose: () => void
}>) {
  const photo = getAnimalPhoto(outing.animals)

  return (
    <div className="bg-primary/5 p-5 animate-fade-up border-t border-border">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="w-12 h-12 rounded-full object-cover" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-muted/20 flex items-center justify-center">
              <PawPrint className="w-6 h-6 text-muted" />
            </div>
          )}
          <div>
            <h3 className="font-semibold text-lg">{outing.animals.name}</h3>
            <p className="text-xs text-muted">{getSpeciesLabel(outing.animals.species)}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-surface-hover transition-colors text-muted hover:text-text"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted shrink-0" />
          <div>
            <p className="text-xs text-muted">Date</p>
            <p className="text-sm font-medium">{formatDateShort(outing.started_at)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted shrink-0" />
          <div>
            <p className="text-xs text-muted">Duree</p>
            <p className="text-sm font-medium">
              {outing.duration_minutes ? formatOutingDuration(outing.duration_minutes) : '-'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-muted shrink-0" />
          <div>
            <p className="text-xs text-muted">Promene par</p>
            <p className="text-sm font-medium">
              {outing.is_tig ? (
                <span className="inline-flex items-center gap-1">
                  <HardHat className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-amber-500">TIG</span>
                  {outing.tig_walker_name && <span> — {outing.tig_walker_name}</span>}
                </span>
              ) : (
                userNames[outing.walked_by] || 'Inconnu'
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-muted shrink-0" />
          <div>
            <p className="text-xs text-muted">Note</p>
            {outing.rating != null ? (
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-bold ${getRatingBadgeClass(outing.rating)}`}>
                {outing.rating}/10
              </span>
            ) : (
              <p className="text-sm text-muted">-</p>
            )}
          </div>
        </div>
      </div>

      {outing.rating_comment && (
        <div className="bg-background rounded-lg border border-border p-3 mb-3">
          <div className="flex items-center gap-2 mb-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-muted" />
            <p className="text-xs font-medium text-muted">Commentaire</p>
          </div>
          <p className="text-sm whitespace-pre-wrap">{outing.rating_comment}</p>
        </div>
      )}

      {outing.notes && outing.notes !== outing.rating_comment && (
        <div className="bg-background rounded-lg border border-border p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-muted" />
            <p className="text-xs font-medium text-muted">Notes</p>
          </div>
          <p className="text-sm whitespace-pre-wrap">{outing.notes}</p>
        </div>
      )}
    </div>
  )
}

export function OutingHistory({ outings, userNames, isAdmin, currentUserId, currentPage, totalPages }: Readonly<OutingHistoryProps>) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [selectedOuting, setSelectedOuting] = useState<OutingWithAnimal | null>(null)

  function canDelete(_outing: OutingWithAnimal): boolean {
    // currentUserId is kept for future per-user delete permission
    return isAdmin
  }

  const showActionsColumn = outings.some(canDelete)

  function handleDelete(id: string, animalName: string) {
    if (!confirm(`Supprimer la sortie de ${animalName} ?`)) return

    setPendingId(id)
    startTransition(async () => {
      const result = await deleteOuting(id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Sortie supprimee')
        router.refresh()
      }
      setPendingId(null)
    })
  }

  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold mb-4">Historique des sorties</h2>

      {outings.length === 0 ? (
        <div className="bg-surface rounded-xl border border-border p-8 text-center">
          <Footprints className="w-10 h-10 text-muted mx-auto mb-3" />
          <p className="text-muted text-sm">Aucune sortie enregistree</p>
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 font-semibold text-muted">Animal</th>
                  <th className="px-4 py-3 font-semibold text-muted">Note</th>
                  <th className="px-4 py-3 font-semibold text-muted">Promene par</th>
                  <th className="px-4 py-3 font-semibold text-muted">Duree</th>
                  <th className="px-4 py-3 font-semibold text-muted">Date</th>
                  <th className="px-4 py-3 font-semibold text-muted">Commentaire</th>
                  {showActionsColumn && (
                    <th className="px-4 py-3 font-semibold text-muted text-right">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {outings.map((outing) => {
                  const photo = getAnimalPhoto(outing.animals)
                  const deletable = canDelete(outing)
                  return (
                    <Fragment key={outing.id}>
                    <tr
                      className={`hover:bg-surface-hover transition-colors cursor-pointer ${selectedOuting?.id === outing.id ? 'bg-primary/5' : ''}`}
                      onClick={() => setSelectedOuting(selectedOuting?.id === outing.id ? null : outing)}
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/animals/${outing.animals.id}`}
                          className="flex items-center gap-2 hover:text-primary transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {photo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={photo} alt="" className="w-7 h-7 rounded-full object-cover" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-muted/20 flex items-center justify-center">
                              <PawPrint className="w-3.5 h-3.5 text-muted" />
                            </div>
                          )}
                          <div>
                            <span className="font-medium">{outing.animals.name}</span>
                            <span className="text-xs text-muted ml-1.5">
                              {getSpeciesLabel(outing.animals.species)}
                            </span>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {outing.rating != null ? (
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-bold ${getRatingBadgeClass(outing.rating)}`}
                            title={outing.rating_comment || undefined}
                          >
                            {outing.rating}/10
                          </span>
                        ) : (
                          <span className="text-muted text-xs">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {outing.is_tig ? (
                          <span className="inline-flex items-center gap-1">
                            <HardHat className="w-3.5 h-3.5 text-amber-500" />
                            <span className="font-medium text-amber-500">TIG</span>
                            {outing.tig_walker_name && (
                              <span className="text-xs"> — {outing.tig_walker_name}</span>
                            )}
                          </span>
                        ) : (
                          userNames[outing.walked_by] || 'Inconnu'
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {outing.duration_minutes
                          ? formatOutingDuration(outing.duration_minutes)
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {formatDateShort(outing.started_at)}
                      </td>
                      <td className="px-4 py-3 text-muted text-xs max-w-[200px] truncate">
                        {outing.rating_comment || outing.notes || '-'}
                      </td>
                      {showActionsColumn && (
                        <td className="px-4 py-3 text-right">
                          {deletable ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(outing.id, outing.animals.name) }}
                              disabled={isPending && pendingId === outing.id}
                              className="text-muted hover:text-error transition-colors disabled:opacity-50"
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ) : null}
                        </td>
                      )}
                    </tr>
                    {selectedOuting?.id === outing.id && (
                      <tr>
                        <td colSpan={showActionsColumn ? 7 : 6} className="p-0">
                          <OutingDetailPanel
                            outing={selectedOuting}
                            userNames={userNames}
                            onClose={() => setSelectedOuting(null)}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-xs text-muted">
                Page {currentPage} sur {totalPages}
              </p>
              <div className="flex items-center gap-1">
                <Link
                  href={`/sorties?view=promenades&page=${currentPage - 1}`}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-border transition-colors ${
                    currentPage <= 1
                      ? 'pointer-events-none opacity-40'
                      : 'hover:bg-surface-hover'
                  }`}
                  aria-disabled={currentPage <= 1}
                  tabIndex={currentPage <= 1 ? -1 : undefined}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Precedent
                </Link>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1]) > 1) acc.push('ellipsis')
                    acc.push(p)
                    return acc
                  }, [])
                  .map((item, idx) =>
                    item === 'ellipsis' ? (
                      <span key={`e${idx}`} className="px-1 text-muted text-sm">...</span>
                    ) : (
                      <Link
                        key={item}
                        href={`/sorties?view=promenades&page=${item}`}
                        className={`inline-flex items-center justify-center w-8 h-8 text-sm rounded-lg transition-colors ${
                          item === currentPage
                            ? 'bg-primary text-white font-medium'
                            : 'hover:bg-surface-hover'
                        }`}
                      >
                        {item}
                      </Link>
                    )
                  )}
                <Link
                  href={`/sorties?view=promenades&page=${currentPage + 1}`}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-border transition-colors ${
                    currentPage >= totalPages
                      ? 'pointer-events-none opacity-40'
                      : 'hover:bg-surface-hover'
                  }`}
                  aria-disabled={currentPage >= totalPages}
                  tabIndex={currentPage >= totalPages ? -1 : undefined}
                >
                  Suivant
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
