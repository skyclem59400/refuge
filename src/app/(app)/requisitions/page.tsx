import Link from 'next/link'
import Image from 'next/image'
import { Scale } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/server'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { getSexIcon, calculateAge } from '@/lib/sda-utils'
import { AnimalStatusBadge, SpeciesBadge } from '@/components/animals/animal-status-badge'
import { formatDate } from '@/lib/utils'
import type { Animal, AnimalPhoto } from '@/lib/types/database'

type AnimalWithPhotos = Animal & { animal_photos: AnimalPhoto[] }

export default async function RequisitionsPage() {
  const ctx = await getEstablishmentContext()
  if (!ctx) throw new Error('Establishment context required')
  const estabId = ctx.establishment.id
  const admin = createAdminClient()

  const { data: rawAnimals } = await admin
    .from('animals')
    .select('*, animal_photos(*)')
    .eq('establishment_id', estabId)
    .eq('origin_type', 'requisition')
    .order('created_at', { ascending: false })

  const animals: AnimalWithPhotos[] = (rawAnimals as AnimalWithPhotos[]) || []

  function getEntryDate(a: Animal): string {
    return a.pound_entry_date || a.shelter_entry_date || a.created_at
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Scale className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold">Requisition</h1>
          <p className="text-sm text-muted">
            {animals.length} {animals.length <= 1 ? 'animal' : 'animaux'} issus de requisitions judiciaires
          </p>
        </div>
      </div>

      {animals.length === 0 ? (
        <div className="bg-surface rounded-xl border border-border p-8 text-center">
          <Scale className="w-10 h-10 text-muted mx-auto mb-3" />
          <p className="text-muted text-sm">Aucun animal sous requisition</p>
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 font-semibold text-muted">Animal</th>
                  <th className="px-4 py-3 font-semibold text-muted">Statut</th>
                  <th className="px-4 py-3 font-semibold text-muted">Identification</th>
                  <th className="px-4 py-3 font-semibold text-muted">Lieu de capture</th>
                  <th className="px-4 py-3 font-semibold text-muted">Date d&apos;entree</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {animals.map((a) => {
                  const photoUrl = a.animal_photos?.find((p) => p.is_primary)?.url || a.animal_photos?.[0]?.url || a.photo_url || null

                  return (
                    <tr key={a.id} className="hover:bg-surface-hover transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/animals/${a.id}`} className="flex items-center gap-3 group">
                          <div className="w-10 h-10 rounded-lg bg-muted/10 overflow-hidden shrink-0 flex items-center justify-center">
                            {photoUrl ? (
                              <Image
                                src={photoUrl}
                                alt={a.name}
                                width={40}
                                height={40}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-muted text-lg">
                                {a.species === 'cat' ? '\uD83D\uDC31' : '\uD83D\uDC36'}
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium group-hover:text-primary transition-colors">
                                {a.name}
                              </span>
                              <span className="text-muted text-xs" title={a.sex}>
                                {getSexIcon(a.sex)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <SpeciesBadge species={a.species} />
                              {a.breed && (
                                <span className="text-xs text-muted">{a.breed}</span>
                              )}
                              <span className="text-xs text-muted">{calculateAge(a.birth_date)}</span>
                            </div>
                          </div>
                        </Link>
                      </td>

                      <td className="px-4 py-3">
                        <AnimalStatusBadge status={a.status} />
                      </td>

                      <td className="px-4 py-3">
                        {a.chip_number ? (
                          <span className="font-mono text-xs">{a.chip_number}</span>
                        ) : (
                          <span className="text-warning text-xs font-medium">Non identifie</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-muted">
                        {a.capture_location || <span className="text-muted/50">&mdash;</span>}
                      </td>

                      <td className="px-4 py-3 text-muted">
                        {formatDate(getEntryDate(a))}
                      </td>
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
