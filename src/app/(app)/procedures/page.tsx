import Link from 'next/link'
import Image from 'next/image'
import { Scale } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/server'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { getSexIcon, calculateAge } from '@/lib/sda-utils'
import { AnimalStatusBadge, SpeciesBadge } from '@/components/animals/animal-status-badge'
import { formatDate } from '@/lib/utils'
import { getSpeciesEmoji } from '@/lib/species'
import type { Animal, AnimalOrigin, AnimalPhoto } from '@/lib/types/database'

type AnimalWithPhotos = Animal & { animal_photos: AnimalPhoto[] }

const ORIGIN_LABELS: Record<AnimalOrigin, string> = {
  found: 'Trouvé / errant',
  abandoned: 'Abandonné',
  surrender: 'Abandon volontaire',
  requisition: 'Réquisition',
  transferred_in: 'Transfert',
  divagation: 'Divagation',
}

export default async function ProceduresPage() {
  const ctx = await getEstablishmentContext()
  if (!ctx) throw new Error('Establishment context required')
  const estabId = ctx.establishment.id
  const admin = createAdminClient()

  const { data: rawAnimals } = await admin
    .from('animals')
    .select('*, animal_photos(*)')
    .eq('establishment_id', estabId)
    .eq('judicial_procedure', true)
    .order('created_at', { ascending: false })

  const animals: AnimalWithPhotos[] = (rawAnimals as AnimalWithPhotos[]) || []
  const nbRequisitions = animals.filter((a) => a.origin_type === 'requisition').length

  function getEntryDate(a: Animal): string {
    return a.pound_entry_date || a.shelter_entry_date || a.created_at
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Scale className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold">Procédure judiciaire</h1>
          <p className="text-sm text-muted">
            {animals.length} {animals.length <= 1 ? 'animal' : 'animaux'} en procédure judiciaire en cours
            {nbRequisitions > 0 && (
              <>
                {' '}
                <span className="text-muted/70">
                  (dont {nbRequisitions} {nbRequisitions <= 1 ? 'arrivé' : 'arrivés'} par réquisition)
                </span>
              </>
            )}
          </p>
        </div>
      </div>

      {animals.length === 0 ? (
        <div className="bg-surface rounded-xl border border-border p-8 text-center">
          <Scale className="w-10 h-10 text-muted mx-auto mb-3" />
          <p className="text-muted text-sm">Aucun animal en procédure judiciaire</p>
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 font-semibold text-muted">Animal</th>
                  <th className="px-4 py-3 font-semibold text-muted">Statut</th>
                  <th className="px-4 py-3 font-semibold text-muted">Origine</th>
                  <th className="px-4 py-3 font-semibold text-muted">Identification</th>
                  <th className="px-4 py-3 font-semibold text-muted">Lieu de capture</th>
                  <th className="px-4 py-3 font-semibold text-muted">Date d&apos;entrée</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {animals.map((a) => {
                  const photoUrl = a.animal_photos?.find((p) => p.is_primary)?.url || a.animal_photos?.[0]?.url || a.photo_url || null
                  const isRequisition = a.origin_type === 'requisition'

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
                                {getSpeciesEmoji(a.species)}
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
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            isRequisition
                              ? 'bg-primary/15 text-primary'
                              : 'bg-border/50 text-muted'
                          }`}
                        >
                          {ORIGIN_LABELS[a.origin_type] || a.origin_type}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        {a.chip_number ? (
                          <span className="font-mono text-xs">{a.chip_number}</span>
                        ) : (
                          <span className="text-warning text-xs font-medium">Non identifié</span>
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
