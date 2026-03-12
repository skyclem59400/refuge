'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Warehouse,
  PawPrint,
  Home,
  HeartPulse,
  AlertTriangle,
  Users,
  Footprints,
  CheckCircle2,
  Circle,
  ChevronLeft,
  ChevronRight,
  MapPin,
} from 'lucide-react'
import type { Animal, AnimalPhoto } from '@/lib/types/database'
import { DailyTreatments } from './daily-treatments'
import { AnimalStatusBadge } from '@/components/animals/animal-status-badge'
import { calculateAge, calculateBusinessDays, getOriginLabel } from '@/lib/sda-utils'
import { formatDate } from '@/lib/utils'

type AnimalWithPhotos = Animal & { animal_photos: AnimalPhoto[] }

interface DailyAssignment {
  assignedTo: string
  assignedToName: string
  animals: {
    id: string
    name: string
    species: string
    photo_url: string | null
    done: boolean
  }[]
}

interface TreatmentItem {
  id: string
  name: string
  description: string | null
  frequency: string
  times: string[]
  animal_name: string
  animal_photo: string | null
  animal_species: string
  administrations_today: {
    id: string
    time_slot: string | null
    administered_by: string
    created_at: string
  }[]
  is_complete: boolean
  completed_count: number
  expected_count: number
}

interface ShelterDashboardProps {
  stats: {
    poundCount: number
    shelterCount: number
    fosterCount: number
    adoptionsThisMonth: number
    restitutionsThisMonth: number
  }
  poundAnimals: AnimalWithPhotos[]
  shelterAnimals: AnimalWithPhotos[]
  healthAlerts: {
    animal_name: string
    animal_id: string
    description: string
    next_due_date: string
  }[]
  dailyAssignments?: DailyAssignment[]
  todayTreatments?: TreatmentItem[]
  treatmentUserNames?: Record<string, string>
}

const statConfig = [
  {
    key: 'poundCount' as const,
    label: 'En fourriere',
    Icon: Warehouse,
    colorClass: 'bg-warning/10 text-warning',
  },
  {
    key: 'shelterCount' as const,
    label: 'En refuge',
    Icon: PawPrint,
    colorClass: 'bg-info/10 text-info',
  },
  {
    key: 'fosterCount' as const,
    label: 'En famille d\'accueil',
    Icon: Users,
    colorClass: 'bg-primary/10 text-primary',
  },
  {
    key: 'adoptionsThisMonth' as const,
    label: 'Adoptions ce mois',
    Icon: Home,
    colorClass: 'bg-success/10 text-success',
  },
  {
    key: 'restitutionsThisMonth' as const,
    label: 'Restitutions ce mois',
    Icon: HeartPulse,
    colorClass: 'bg-secondary/10 text-secondary',
  },
]

function getBusinessDaysBadgeClass(businessDays: number): string {
  if (businessDays >= 8) return 'bg-error/15 text-error'
  if (businessDays >= 6) return 'bg-warning/15 text-warning'
  return 'bg-muted/10 text-muted'
}

const PAGE_SIZE = 5

export function ShelterDashboard({
  stats,
  poundAnimals,
  shelterAnimals,
  healthAlerts,
  dailyAssignments = [],
  todayTreatments = [],
  treatmentUserNames = {},
}: Readonly<ShelterDashboardProps>) {
  const [poundPage, setPoundPage] = useState(0)
  const [shelterPage, setShelterPage] = useState(0)

  // Calculate business days for pound animals to detect imminent deadlines
  const poundWithDays = poundAnimals.map((a) => ({
    ...a,
    businessDays: a.pound_entry_date
      ? calculateBusinessDays(a.pound_entry_date)
      : 0,
  }))
  const imminentAnimals = poundWithDays.filter((a) => a.businessDays >= 6)

  // Pagination for both columns
  const poundTotalPages = Math.max(1, Math.ceil(poundAnimals.length / PAGE_SIZE))
  const shelterTotalPages = Math.max(1, Math.ceil(shelterAnimals.length / PAGE_SIZE))
  const poundPageAnimals = poundAnimals.slice(poundPage * PAGE_SIZE, (poundPage + 1) * PAGE_SIZE)
  const shelterPageAnimals = shelterAnimals.slice(shelterPage * PAGE_SIZE, (shelterPage + 1) * PAGE_SIZE)

  function getPhotoUrl(animal: AnimalWithPhotos): string | null {
    return animal.animal_photos?.find((p) => p.is_primary)?.url || animal.animal_photos?.[0]?.url || animal.photo_url || null
  }

  function renderAnimalRow(animal: AnimalWithPhotos, isPound: boolean) {
    const photoUrl = getPhotoUrl(animal)
    const businessDays = animal.pound_entry_date ? calculateBusinessDays(animal.pound_entry_date) : 0

    return (
      <Link
        key={animal.id}
        href={`/animals/${animal.id}`}
        className="flex items-start gap-3 px-4 py-3 hover:bg-surface-hover transition-colors"
      >
        <div className="w-10 h-10 rounded-lg bg-muted/10 overflow-hidden shrink-0 flex items-center justify-center mt-0.5">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt={animal.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-muted text-lg">
              {animal.species === 'cat' ? '\uD83D\uDC31' : '\uD83D\uDC36'}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{animal.name}</span>
            <AnimalStatusBadge status={animal.status} />
          </div>
          <p className="text-xs text-muted mt-0.5">{calculateAge(animal.birth_date)}</p>

          {isPound && (
            <div className="mt-1.5 space-y-0.5">
              {animal.pound_entry_date && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted">Entree :</span>
                  <span>{formatDate(animal.pound_entry_date)}</span>
                  <span className={`font-medium px-1.5 py-0.5 rounded-full text-[10px] ${getBusinessDaysBadgeClass(businessDays)}`}>
                    J{businessDays}
                  </span>
                </div>
              )}
              {animal.origin_type && (
                <p className="text-xs text-muted">
                  {getOriginLabel(animal.origin_type)}
                </p>
              )}
              {animal.capture_location && (
                <p className="text-xs text-muted flex items-center gap-1">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">{animal.capture_location}</span>
                </p>
              )}
              {animal.capture_circumstances && (
                <p className="text-xs text-muted/70 italic truncate">
                  {animal.capture_circumstances}
                </p>
              )}
            </div>
          )}

          {!isPound && animal.shelter_entry_date && (
            <p className="text-xs text-muted mt-0.5">
              Entree : {formatDate(animal.shelter_entry_date)}
            </p>
          )}
        </div>

        <span className="text-xs text-muted whitespace-nowrap ml-2 mt-0.5">
          {formatDate(isPound && animal.pound_entry_date ? animal.pound_entry_date : animal.created_at)}
        </span>
      </Link>
    )
  }

  function renderPagination(currentPage: number, totalPages: number, setPage: (p: number) => void) {
    if (totalPages <= 1) return null
    return (
      <div className="flex items-center justify-between px-4 py-3 border-t border-border">
        <button
          onClick={() => setPage(Math.max(0, currentPage - 1))}
          disabled={currentPage === 0}
          className="flex items-center gap-1 text-xs text-muted hover:text-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Precedent
        </button>
        <span className="text-xs text-muted">
          {currentPage + 1} / {totalPages}
        </span>
        <button
          onClick={() => setPage(Math.min(totalPages - 1, currentPage + 1))}
          disabled={currentPage >= totalPages - 1}
          className="flex items-center gap-1 text-xs text-muted hover:text-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Suivant
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {statConfig.map((s) => (
          <div
            key={s.key}
            className="bg-surface rounded-xl p-5 border border-border hover:glow transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.colorClass}`}
              >
                <s.Icon className="w-5 h-5" />
              </div>
            </div>
            <p className="text-2xl font-bold">{stats[s.key]}</p>
            <p className="text-xs text-muted mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Pound imminent alert */}
      {imminentAnimals.length > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning mt-0.5 shrink-0" />
            <div>
              <h2 className="font-semibold text-warning">
                Fin de fourriere imminente
              </h2>
              <ul className="mt-2 space-y-1">
                {imminentAnimals.map((a) => (
                  <li key={a.id} className="text-sm">
                    <Link
                      href={`/animals/${a.id}`}
                      className="font-medium underline hover:text-warning transition-colors"
                    >
                      {a.name}
                    </Link>{' '}
                    &mdash; {a.businessDays} jour
                    {a.businessDays > 1 ? 's' : ''} ouvre
                    {a.businessDays > 1 ? 's' : ''}
                    {a.businessDays >= 8 && (
                      <span className="ml-2 text-error font-semibold">
                        DELAI DEPASSE
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Health reminders */}
      {healthAlerts.length > 0 && (
        <div className="bg-surface rounded-xl border border-border">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <h3 className="font-semibold">Rappels sante</h3>
          </div>
          <div className="divide-y divide-border">
            {healthAlerts.map((alert, i) => (
              <div
                key={`${alert.animal_id}-${i}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-surface-hover transition-colors"
              >
                <div>
                  <Link
                    href={`/animals/${alert.animal_id}`}
                    className="text-sm font-medium hover:text-primary transition-colors"
                  >
                    {alert.animal_name}
                  </Link>
                  <p className="text-xs text-muted mt-0.5">
                    {alert.description}
                  </p>
                </div>
                <span className="text-xs text-muted whitespace-nowrap ml-4">
                  {formatDate(alert.next_due_date)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily treatments */}
      <DailyTreatments treatments={todayTreatments} userNames={treatmentUserNames} />

      {/* Daily outing assignments */}
      {dailyAssignments.length > 0 && (
        <div className="bg-surface rounded-xl border border-border">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <div className="flex items-center gap-2">
              <Footprints className="w-4 h-4 text-primary" />
              <h3 className="font-semibold">Sorties du jour</h3>
            </div>
            <Link href="/sorties" className="text-sm text-primary hover:text-primary-light transition-colors">
              Voir tout
            </Link>
          </div>
          <div className="divide-y divide-border">
            {dailyAssignments.map((person) => {
              const doneCount = person.animals.filter((a) => a.done).length
              const totalCount = person.animals.length
              return (
                <div key={person.assignedTo} className="px-5 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{person.assignedToName}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      doneCount === totalCount
                        ? 'bg-success/10 text-success'
                        : 'bg-muted/10 text-muted'
                    }`}>
                      {doneCount}/{totalCount}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {person.animals.map((animal) => (
                      <Link
                        key={animal.id}
                        href={`/animals/${animal.id}`}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-colors ${
                          animal.done
                            ? 'bg-success/10 text-success line-through decoration-success/40'
                            : 'bg-surface-hover text-text hover:bg-primary/10 hover:text-primary'
                        }`}
                      >
                        {animal.done ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <Circle className="w-3 h-3" />
                        )}
                        {animal.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Two-column: Fourriere (left) + Refuge (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fourriere column */}
        <div className="bg-surface rounded-xl border border-border">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-1.5">
              <Warehouse className="w-4 h-4 text-warning" />
              <h3 className="font-semibold text-sm">Fourriere</h3>
              <span className="text-xs text-warning bg-warning/10 px-1.5 py-0.5 rounded-full font-medium">
                {poundAnimals.length}
              </span>
            </div>
            <Link
              href="/animals?status=pound"
              className="text-xs text-primary hover:text-primary-light transition-colors"
            >
              Voir tout
            </Link>
          </div>
          <div className="divide-y divide-border">
            {poundPageAnimals.length > 0 ? (
              poundPageAnimals.map((animal) => renderAnimalRow(animal, true))
            ) : (
              <p className="p-5 text-sm text-muted text-center">Aucun animal en fourriere</p>
            )}
          </div>
          {renderPagination(poundPage, poundTotalPages, setPoundPage)}
        </div>

        {/* Refuge column */}
        <div className="bg-surface rounded-xl border border-border">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-1.5">
              <PawPrint className="w-4 h-4 text-info" />
              <h3 className="font-semibold text-sm">Refuge</h3>
              <span className="text-xs text-info bg-info/10 px-1.5 py-0.5 rounded-full font-medium">
                {shelterAnimals.length}
              </span>
            </div>
            <Link
              href="/animals?status=shelter"
              className="text-xs text-primary hover:text-primary-light transition-colors"
            >
              Voir tout
            </Link>
          </div>
          <div className="divide-y divide-border">
            {shelterPageAnimals.length > 0 ? (
              shelterPageAnimals.map((animal) => renderAnimalRow(animal, false))
            ) : (
              <p className="p-5 text-sm text-muted text-center">Aucun animal en refuge</p>
            )}
          </div>
          {renderPagination(shelterPage, shelterTotalPages, setShelterPage)}
        </div>
      </div>
    </div>
  )
}
