'use client'

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
} from 'lucide-react'
import type { Animal, AnimalPhoto } from '@/lib/types/database'
import { AnimalStatusBadge } from '@/components/animals/animal-status-badge'
import { calculateAge, calculateBusinessDays } from '@/lib/sda-utils'
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

interface ShelterDashboardProps {
  stats: {
    poundCount: number
    shelterCount: number
    fosterCount: number
    adoptionsThisMonth: number
    restitutionsThisMonth: number
  }
  poundAnimals: AnimalWithPhotos[]
  recentAnimals: AnimalWithPhotos[]
  healthAlerts: {
    animal_name: string
    animal_id: string
    description: string
    next_due_date: string
  }[]
  dailyAssignments?: DailyAssignment[]
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

export function ShelterDashboard({
  stats,
  poundAnimals,
  recentAnimals,
  healthAlerts,
  dailyAssignments = [],
}: ShelterDashboardProps) {
  // Calculate business days for pound animals to detect imminent deadlines
  const poundWithDays = poundAnimals.map((a) => ({
    ...a,
    businessDays: a.pound_entry_date
      ? calculateBusinessDays(a.pound_entry_date)
      : 0,
  }))
  const imminentAnimals = poundWithDays.filter((a) => a.businessDays >= 6)

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

      {/* Two-column layout: alerts + recent entries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Alerts */}
        <div className="space-y-4">
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
          {healthAlerts.length > 0 ? (
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
          ) : (
            imminentAnimals.length === 0 && (
              <div className="bg-surface rounded-xl border border-border p-8 text-center">
                <PawPrint className="w-10 h-10 text-muted mx-auto mb-3" />
                <p className="text-muted text-sm">Aucune alerte en cours</p>
              </div>
            )
          )}
        </div>

        {/* Right: Recent entries */}
        <div className="bg-surface rounded-xl border border-border">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <h3 className="font-semibold">Dernieres entrees</h3>
            <Link
              href="/animals"
              className="text-sm text-primary hover:text-primary-light transition-colors"
            >
              Voir tout
            </Link>
          </div>
          <div className="divide-y divide-border">
            {recentAnimals.length > 0 ? (
              recentAnimals.map((animal) => {
                const photoUrl = animal.animal_photos?.find((p) => p.is_primary)?.url || animal.animal_photos?.[0]?.url || animal.photo_url || null

                return (
                  <Link
                    key={animal.id}
                    href={`/animals/${animal.id}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-surface-hover transition-colors"
                  >
                    {/* Photo thumbnail */}
                    <div className="w-10 h-10 rounded-lg bg-muted/10 overflow-hidden shrink-0 flex items-center justify-center">
                      {photoUrl ? (
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
                        <span className="text-sm font-medium truncate">
                          {animal.name}
                        </span>
                        <AnimalStatusBadge status={animal.status} />
                      </div>
                      <p className="text-xs text-muted mt-0.5">
                        {calculateAge(animal.birth_date)}
                      </p>
                    </div>
                    <span className="text-xs text-muted whitespace-nowrap ml-2">
                      {formatDate(animal.created_at)}
                    </span>
                  </Link>
                )
              })
            ) : (
              <p className="p-5 text-sm text-muted text-center">
                Aucun animal enregistre
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
