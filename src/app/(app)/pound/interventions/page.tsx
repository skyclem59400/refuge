import Link from 'next/link'
import { Plus, ClipboardList, Phone, MapPin, PawPrint, Settings } from 'lucide-react'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { getInterventions } from '@/lib/actions/interventions'
import { getRingoverConnection } from '@/lib/actions/ringover'
import { RingoverSettings } from '@/components/pound/ringover-settings'
import type { Animal, AnimalPhoto, RingoverConnection } from '@/lib/types/database'

type InterventionWithAnimal = {
  id: string
  caller_name: string
  caller_phone: string | null
  caller_email: string | null
  location_street_number: string | null
  location_street: string
  location_city: string
  intervention_date: string
  intervened_by: string
  intervenant_name?: string
  notes: string | null
  animals: (Pick<Animal, 'id' | 'name' | 'species' | 'sex'> & {
    animal_photos: Pick<AnimalPhoto, 'url' | 'is_primary'>[]
  }) | null
}

export default async function InterventionsPage() {
  const ctx = await getEstablishmentContext()
  const permissions = ctx!.permissions
  const canCreate = permissions.canManageMovements
  const canManageEstablishment = permissions.canManageEstablishment

  const [result, ringoverResult] = await Promise.all([
    getInterventions(),
    canManageEstablishment ? getRingoverConnection() : Promise.resolve({ data: null }),
  ])
  const interventions = (result.data || []) as InterventionWithAnimal[]
  const ringoverConnection = (ringoverResult.data as RingoverConnection | null) || null

  return (
    <div>
      {/* Ringover settings (admin only) */}
      {canManageEstablishment && (
        <div className="mb-6">
          <RingoverSettings connection={ringoverConnection} />
        </div>
      )}

      {/* Sub-header */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-muted">
          {interventions.length} intervention{interventions.length !== 1 ? 's' : ''} enregistree{interventions.length !== 1 ? 's' : ''}
        </p>
        {canCreate && (
          <Link
            href="/pound/interventions/nouveau"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nouvelle intervention
          </Link>
        )}
      </div>

      {/* Content */}
      {interventions.length === 0 ? (
        <div className="bg-surface rounded-xl border border-border p-8 text-center">
          <ClipboardList className="w-10 h-10 text-muted mx-auto mb-3" />
          <p className="text-muted text-sm">Aucune intervention enregistree</p>
          {canCreate && (
            <Link
              href="/pound/interventions/nouveau"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors"
            >
              <Plus className="w-4 h-4" />
              Enregistrer une intervention
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 font-semibold text-muted">Date</th>
                  <th className="px-4 py-3 font-semibold text-muted">Appelant</th>
                  <th className="px-4 py-3 font-semibold text-muted">Lieu</th>
                  <th className="px-4 py-3 font-semibold text-muted">Animal</th>
                  <th className="px-4 py-3 font-semibold text-muted">Intervenant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {interventions.map((intervention) => {
                  const animal = intervention.animals
                  const photoUrl = animal?.animal_photos?.find((p) => p.is_primary)?.url
                    || animal?.animal_photos?.[0]?.url
                    || null

                  const date = new Date(intervention.intervention_date)
                  const dateStr = date.toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })
                  const timeStr = date.toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })

                  const locationParts = [
                    intervention.location_street_number,
                    intervention.location_street,
                  ].filter(Boolean).join(' ')

                  return (
                    <tr key={intervention.id} className="hover:bg-surface-hover transition-colors">
                      {/* Date */}
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium">{dateStr}</div>
                        <div className="text-xs text-muted">{timeStr}</div>
                      </td>

                      {/* Caller */}
                      <td className="px-4 py-3">
                        <div className="font-medium">{intervention.caller_name}</div>
                        {intervention.caller_phone && (
                          <div className="flex items-center gap-1 text-xs text-muted mt-0.5">
                            <Phone className="w-3 h-3" />
                            {intervention.caller_phone}
                          </div>
                        )}
                      </td>

                      {/* Location */}
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-muted mt-0.5 shrink-0" />
                          <div>
                            <div className="text-sm">{locationParts}</div>
                            <div className="text-xs text-muted">{intervention.location_city}</div>
                          </div>
                        </div>
                      </td>

                      {/* Animal */}
                      <td className="px-4 py-3">
                        {animal ? (
                          <Link href={`/animals/${animal.id}`} className="flex items-center gap-2 group">
                            <div className="w-8 h-8 rounded-lg bg-muted/10 overflow-hidden shrink-0 flex items-center justify-center">
                              {photoUrl ? (
                                <img src={photoUrl} alt={animal.name} className="w-full h-full object-cover" />
                              ) : (
                                <PawPrint className="w-4 h-4 text-muted" />
                              )}
                            </div>
                            <span className="text-sm font-medium group-hover:text-primary transition-colors">
                              {animal.name}
                            </span>
                          </Link>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>

                      {/* Intervenant */}
                      <td className="px-4 py-3 text-sm text-muted">
                        {intervention.intervenant_name || '—'}
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
