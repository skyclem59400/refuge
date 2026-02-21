import Link from 'next/link'
import { Warehouse, AlertTriangle } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/server'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { calculateBusinessDays, getSexIcon, calculateAge, getOriginLabel } from '@/lib/sda-utils'
import { SpeciesBadge } from '@/components/animals/animal-status-badge'
import type { Animal, AnimalPhoto } from '@/lib/types/database'

// ---------------------------------------------------------------------------
// DaysCounter – circular badge with color based on business day count
// ---------------------------------------------------------------------------
function DaysCounter({ count }: { count: number }) {
  let colorClasses: string

  if (count < 5) {
    colorClasses = 'bg-info/15 text-info border-info/30'
  } else if (count <= 6) {
    colorClasses = 'bg-warning/15 text-warning border-warning/30'
  } else {
    colorClasses = 'bg-error/15 text-error border-error/30'
  }

  return (
    <span
      className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold border ${colorClasses}`}
    >
      {count}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type AnimalWithPhotos = Animal & { animal_photos: AnimalPhoto[] }

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default async function PoundPage() {
  const ctx = await getEstablishmentContext()
  const estabId = ctx!.establishment.id
  const admin = createAdminClient()

  // Fetch animals currently in the pound, with their photos
  const { data: rawAnimals } = await admin
    .from('animals')
    .select('*, animal_photos(*)')
    .eq('establishment_id', estabId)
    .eq('status', 'pound')
    .order('pound_entry_date', { ascending: true })

  const animals: AnimalWithPhotos[] = (rawAnimals as AnimalWithPhotos[]) || []

  // Calculate business days for each animal
  const animalsWithDays = animals.map((a) => ({
    ...a,
    businessDays: a.pound_entry_date ? calculateBusinessDays(a.pound_entry_date) : 0,
  }))

  // Animals close to the 8-day legal limit (>= 6 business days)
  const alertAnimals = animalsWithDays.filter((a) => a.businessDays >= 6)

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-warning/15">
            <Warehouse className="w-6 h-6 text-warning" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Fourriere</h1>
            <p className="text-sm text-muted mt-1">
              {animals.length} {animals.length <= 1 ? 'animal' : 'animaux'} en fourriere
            </p>
          </div>
        </div>
      </div>

      {/* Alert section – imminent end of pound period */}
      {alertAnimals.length > 0 && (
        <div className="mb-6 rounded-xl border border-warning/30 bg-warning/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning mt-0.5 shrink-0" />
            <div>
              <h2 className="font-semibold text-warning">Fin de fourriere imminente</h2>
              <ul className="mt-2 space-y-1">
                {alertAnimals.map((a) => (
                  <li key={a.id} className="text-sm">
                    <Link
                      href={`/animaux/${a.id}`}
                      className="font-medium underline hover:text-warning transition-colors"
                    >
                      {a.name}
                    </Link>
                    {' '}&mdash; {a.businessDays} jour{a.businessDays > 1 ? 's' : ''} ouvre{a.businessDays > 1 ? 's' : ''}
                    {a.businessDays >= 8 && (
                      <span className="ml-2 text-error font-semibold">DELAI DEPASSE</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {animals.length === 0 ? (
        <div className="bg-surface rounded-xl border border-border p-8 text-center">
          <Warehouse className="w-10 h-10 text-muted mx-auto mb-3" />
          <p className="text-muted text-sm">Aucun animal en fourriere actuellement</p>
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 font-semibold text-muted">Animal</th>
                  <th className="px-4 py-3 font-semibold text-muted">Identification</th>
                  <th className="px-4 py-3 font-semibold text-muted">Origine</th>
                  <th className="px-4 py-3 font-semibold text-muted">Lieu de capture</th>
                  <th className="px-4 py-3 font-semibold text-muted text-center">Jours ouvres</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {animalsWithDays.map((a) => {
                  const primaryPhoto = a.animal_photos?.find((p) => p.is_primary) || a.animal_photos?.[0]

                  return (
                    <tr key={a.id} className="hover:bg-surface-hover transition-colors">
                      {/* Animal column */}
                      <td className="px-4 py-3">
                        <Link href={`/animaux/${a.id}`} className="flex items-center gap-3 group">
                          {/* Photo thumbnail */}
                          <div className="w-10 h-10 rounded-lg bg-muted/10 overflow-hidden shrink-0 flex items-center justify-center">
                            {primaryPhoto ? (
                              <img
                                src={primaryPhoto.url}
                                alt={a.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-muted text-lg">
                                {a.species === 'cat' ? '🐱' : '🐶'}
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

                      {/* Identification column */}
                      <td className="px-4 py-3">
                        {a.chip_number ? (
                          <span className="font-mono text-xs">{a.chip_number}</span>
                        ) : (
                          <span className="text-warning text-xs font-medium">Non identifie</span>
                        )}
                      </td>

                      {/* Origin column */}
                      <td className="px-4 py-3 text-muted">
                        {getOriginLabel(a.origin_type)}
                      </td>

                      {/* Capture location column */}
                      <td className="px-4 py-3 text-muted">
                        {a.capture_location || <span className="text-muted/50">&mdash;</span>}
                      </td>

                      {/* Business days column */}
                      <td className="px-4 py-3 text-center">
                        <DaysCounter count={a.businessDays} />
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
