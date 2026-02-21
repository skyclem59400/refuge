import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { AnimalForm } from '@/components/animals/animal-form'
import { AnimalStatusBadge, SpeciesBadge } from '@/components/animals/animal-status-badge'
import { formatDateShort, formatCurrency } from '@/lib/utils'
import {
  getOriginLabel,
  getSexIcon,
  getMovementLabel,
  getHealthTypeLabel,
  calculateAge,
} from '@/lib/sda-utils'
import type { Animal, AnimalPhoto, AnimalMovement, AnimalHealthRecord, Box } from '@/lib/types/database'
import {
  ArrowLeft,
  Fingerprint,
  MapPin,
  FileText,
  ArrowRightLeft,
  HeartPulse,
  Pencil,
  Stethoscope,
  Calendar,
  AlertTriangle,
  ImageIcon,
} from 'lucide-react'

export default async function AnimalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getEstablishmentContext()
  const estabId = ctx!.establishment.id
  const admin = createAdminClient()

  const [
    { data: animal },
    { data: photos },
    { data: movements },
    { data: healthRecords },
    { data: boxes },
  ] = await Promise.all([
    admin.from('animals').select('*').eq('id', id).eq('establishment_id', estabId).single(),
    admin.from('animal_photos').select('*').eq('animal_id', id).order('is_primary', { ascending: false }),
    admin.from('animal_movements').select('*').eq('animal_id', id).order('date', { ascending: false }),
    admin.from('animal_health_records').select('*').eq('animal_id', id).order('date', { ascending: false }),
    admin.from('boxes').select('*').eq('establishment_id', estabId).order('name'),
  ])

  if (!animal) notFound()

  const typedAnimal = animal as Animal
  const typedPhotos = (photos as AnimalPhoto[]) || []
  const typedMovements = (movements as AnimalMovement[]) || []
  const typedHealth = (healthRecords as AnimalHealthRecord[]) || []
  const typedBoxes = (boxes as Box[]) || []

  const primaryPhoto = typedPhotos.find((p) => p.is_primary) || typedPhotos[0]
  const thumbnails = typedPhotos.filter((p) => p.id !== primaryPhoto?.id)

  const canManageAnimals = ctx!.permissions.canManageAnimals

  const todayDate = new Date()
  const today = todayDate.toISOString().split('T')[0]
  const futureDate = new Date(todayDate)
  futureDate.setDate(futureDate.getDate() + 30)
  const in30Days = futureDate.toISOString().split('T')[0]

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/animals" className="text-muted hover:text-text transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">
              {typedAnimal.name}
              <span className="ml-2 text-muted text-xl">{getSexIcon(typedAnimal.sex)}</span>
            </h1>
            <AnimalStatusBadge status={typedAnimal.status} />
            <SpeciesBadge species={typedAnimal.species} />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted mt-1 flex-wrap">
            {typedAnimal.breed && <span>{typedAnimal.breed}{typedAnimal.breed_cross ? ` x ${typedAnimal.breed_cross}` : ''}</span>}
            {typedAnimal.breed && <span>-</span>}
            <span>{calculateAge(typedAnimal.birth_date)}</span>
            <span>-</span>
            <span>{getOriginLabel(typedAnimal.origin_type)}</span>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-1 space-y-4">
          {/* Photo card */}
          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            {primaryPhoto ? (
              <div className="aspect-square relative bg-surface-dark">
                <Image
                  src={primaryPhoto.url}
                  alt={typedAnimal.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 33vw"
                />
              </div>
            ) : (
              <div className="aspect-square flex items-center justify-center bg-surface-dark">
                <ImageIcon className="w-16 h-16 text-muted/30" />
              </div>
            )}

            {thumbnails.length > 0 && (
              <div className="flex gap-1 p-2 overflow-x-auto">
                {thumbnails.map((photo) => (
                  <div key={photo.id} className="relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden">
                    <Image
                      src={photo.url}
                      alt={typedAnimal.name}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Identification card */}
          <div className="bg-surface rounded-xl border border-border p-5">
            <div className="flex items-center gap-2 mb-4">
              <Fingerprint className="w-4 h-4 text-muted" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">Identification</h3>
            </div>
            <div className="space-y-3 text-sm">
              {typedAnimal.chip_number && (
                <div className="flex justify-between">
                  <span className="text-muted">Puce</span>
                  <span className="font-mono font-medium">{typedAnimal.chip_number}</span>
                </div>
              )}
              {typedAnimal.medal_number && (
                <div className="flex justify-between">
                  <span className="text-muted">Medaille</span>
                  <span className="font-medium">{typedAnimal.medal_number}</span>
                </div>
              )}
              {typedAnimal.tattoo_number && (
                <div className="flex justify-between">
                  <span className="text-muted">Tatouage</span>
                  <span className="font-medium">
                    {typedAnimal.tattoo_number}
                    {typedAnimal.tattoo_position && (
                      <span className="text-muted ml-1">({typedAnimal.tattoo_position})</span>
                    )}
                  </span>
                </div>
              )}
              {typedAnimal.loof_number && (
                <div className="flex justify-between">
                  <span className="text-muted">LOOF</span>
                  <span className="font-medium">{typedAnimal.loof_number}</span>
                </div>
              )}
              {typedAnimal.passport_number && (
                <div className="flex justify-between">
                  <span className="text-muted">Passeport</span>
                  <span className="font-medium">{typedAnimal.passport_number}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted">I-CAD</span>
                <span className={`font-medium ${typedAnimal.icad_updated ? 'text-success' : 'text-warning'}`}>
                  {typedAnimal.icad_updated ? 'A jour' : 'Non mis a jour'}
                </span>
              </div>
              {!typedAnimal.chip_number && !typedAnimal.medal_number && !typedAnimal.tattoo_number && !typedAnimal.loof_number && !typedAnimal.passport_number && (
                <p className="text-muted text-center py-2">Aucune identification enregistree</p>
              )}
            </div>
          </div>

          {/* Origin card */}
          {typedAnimal.capture_location && (
            <div className="bg-surface rounded-xl border border-border p-5">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-4 h-4 text-muted" />
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">Origine / Capture</h3>
              </div>
              <div className="space-y-2 text-sm">
                <p className="font-medium">{typedAnimal.capture_location}</p>
                {typedAnimal.capture_circumstances && (
                  <p className="text-muted p-2 bg-surface-dark rounded-lg text-xs">
                    {typedAnimal.capture_circumstances}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Description card */}
          {typedAnimal.description && (
            <div className="bg-surface rounded-xl border border-border p-5">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-4 h-4 text-muted" />
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">Description</h3>
              </div>
              <p className="text-sm text-muted whitespace-pre-wrap">{typedAnimal.description}</p>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Movements section */}
          <div className="bg-surface rounded-xl border border-border">
            <div className="p-5 border-b border-border flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-muted" />
              <div>
                <h3 className="font-semibold">Mouvements</h3>
                <p className="text-xs text-muted mt-0.5">{typedMovements.length} mouvement(s)</p>
              </div>
            </div>

            {typedMovements.length === 0 ? (
              <p className="p-5 text-sm text-muted text-center">Aucun mouvement enregistre</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-hover/50">
                      <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Type</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Date</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Personne</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {typedMovements.map((mv) => (
                      <tr key={mv.id} className="hover:bg-surface-hover/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{getMovementLabel(mv.type)}</td>
                        <td className="px-4 py-3 text-muted">{formatDateShort(mv.date)}</td>
                        <td className="px-4 py-3 text-muted">{mv.person_name || '-'}</td>
                        <td className="px-4 py-3 text-muted text-xs max-w-xs truncate">{mv.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Health section */}
          <div className="bg-surface rounded-xl border border-border">
            <div className="p-5 border-b border-border flex items-center gap-2">
              <HeartPulse className="w-4 h-4 text-muted" />
              <div>
                <h3 className="font-semibold">Suivi sanitaire</h3>
                <p className="text-xs text-muted mt-0.5">{typedHealth.length} acte(s)</p>
              </div>
            </div>

            {typedHealth.length === 0 ? (
              <p className="p-5 text-sm text-muted text-center">Aucun acte sanitaire enregistre</p>
            ) : (
              <div className="divide-y divide-border">
                {typedHealth.map((hr) => {
                  const isOverdue = hr.next_due_date && hr.next_due_date < today
                  const isSoon = hr.next_due_date && !isOverdue && hr.next_due_date <= in30Days

                  return (
                    <div key={hr.id} className="p-4 hover:bg-surface-hover/30 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-info/15 text-info">
                              {getHealthTypeLabel(hr.type)}
                            </span>
                            <span className="text-xs text-muted">{formatDateShort(hr.date)}</span>
                          </div>
                          <p className="text-sm mt-1">{hr.description}</p>
                          {hr.veterinarian && (
                            <div className="flex items-center gap-1 mt-1 text-xs text-muted">
                              <Stethoscope className="w-3 h-3" />
                              <span>{hr.veterinarian}</span>
                            </div>
                          )}
                          {hr.next_due_date && (
                            <div className={`flex items-center gap-1 mt-1 text-xs ${
                              isOverdue ? 'text-error font-semibold' : isSoon ? 'text-warning' : 'text-muted'
                            }`}>
                              {isOverdue ? (
                                <AlertTriangle className="w-3 h-3" />
                              ) : (
                                <Calendar className="w-3 h-3" />
                              )}
                              <span>
                                Prochain : {formatDateShort(hr.next_due_date)}
                                {isOverdue && ' (en retard)'}
                              </span>
                            </div>
                          )}
                        </div>
                        {hr.cost != null && hr.cost > 0 && (
                          <span className="text-sm font-semibold text-nowrap">{formatCurrency(hr.cost)}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Edit section */}
          {canManageAnimals && (
            <details className="bg-surface rounded-xl border border-border">
              <summary className="p-5 cursor-pointer font-medium text-muted hover:text-text transition-colors flex items-center gap-2">
                <Pencil className="w-4 h-4" />
                Modifier l&apos;animal
              </summary>
              <div className="px-5 pb-5">
                <AnimalForm animal={typedAnimal} boxes={typedBoxes} />
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  )
}
