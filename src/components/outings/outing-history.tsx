'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Trash2, Footprints, PawPrint } from 'lucide-react'
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
  canManageOutings: boolean
}

function getAnimalPhoto(animal: OutingWithAnimal['animals']): string | null {
  const primary = animal.animal_photos?.find((p) => p.is_primary)
  if (primary) return primary.url
  if (animal.animal_photos?.length > 0) return animal.animal_photos[0].url
  return animal.photo_url
}

export function OutingHistory({ outings, userNames, canManageOutings }: OutingHistoryProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [pendingId, setPendingId] = useState<string | null>(null)

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
    <div>
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
                  <th className="px-4 py-3 font-semibold text-muted">Promene par</th>
                  <th className="px-4 py-3 font-semibold text-muted">Duree</th>
                  <th className="px-4 py-3 font-semibold text-muted">Date</th>
                  <th className="px-4 py-3 font-semibold text-muted">Notes</th>
                  {canManageOutings && (
                    <th className="px-4 py-3 font-semibold text-muted text-right">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {outings.map((outing) => {
                  const photo = getAnimalPhoto(outing.animals)
                  return (
                    <tr key={outing.id} className="hover:bg-surface-hover transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/animals/${outing.animals.id}`}
                          className="flex items-center gap-2 hover:text-primary transition-colors"
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
                      <td className="px-4 py-3 text-muted">
                        {userNames[outing.walked_by] || 'Inconnu'}
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
                        {outing.notes || '-'}
                      </td>
                      {canManageOutings && (
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleDelete(outing.id, outing.animals.name)}
                            disabled={isPending && pendingId === outing.id}
                            className="text-muted hover:text-error transition-colors disabled:opacity-50"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
