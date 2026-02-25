'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { AnimalStatusBadge, SpeciesBadge } from './animal-status-badge'
import { getSexIcon, calculateAge, getStatusLabel } from '@/lib/sda-utils'
import type { Animal, AnimalPhoto, AnimalStatus } from '@/lib/types/database'

type AnimalWithPhotos = Animal & { animal_photos: AnimalPhoto[] }

interface AnimalListProps {
  animals: AnimalWithPhotos[]
}

const ALL_STATUSES: AnimalStatus[] = [
  'pound', 'shelter', 'foster_family', 'boarding', 'adopted', 'returned', 'transferred', 'deceased', 'euthanized',
]

export function AnimalList({ animals }: AnimalListProps) {
  const [search, setSearch] = useState('')
  const [speciesFilter, setSpeciesFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const filtered = useMemo(() => {
    let result = animals

    // Search filter
    if (search.length >= 2) {
      const q = search.toLowerCase()
      result = result.filter((a) =>
        a.name.toLowerCase().includes(q) ||
        (a.chip_number && a.chip_number.toLowerCase().includes(q)) ||
        (a.medal_number && a.medal_number.toLowerCase().includes(q))
      )
    }

    // Species filter
    if (speciesFilter !== 'all') {
      result = result.filter((a) => a.species === speciesFilter)
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((a) => a.status === statusFilter)
    }

    return result
  }, [animals, search, speciesFilter, statusFilter])

  function getPrimaryPhoto(animal: AnimalWithPhotos): string | null {
    // Check local photos first
    if (animal.animal_photos && animal.animal_photos.length > 0) {
      const primary = animal.animal_photos.find((p) => p.is_primary)
      return primary ? primary.url : animal.animal_photos[0].url
    }
    // Fallback to Hunimalis photo_url
    if (animal.photo_url) return animal.photo_url
    return null
  }

  function getFallbackEmoji(species: string): string {
    return species === 'cat' ? '\ud83d\udc31' : '\ud83d\udc36'
  }

  return (
    <div>
      {/* Count */}
      <p className="text-sm text-muted mb-4">
        {filtered.length} animal{filtered.length !== 1 ? 'x' : ''} {statusFilter !== 'all' || speciesFilter !== 'all' || search.length >= 2 ? 'trouvé' : 'enregistré'}{filtered.length !== 1 ? 's' : ''}
        {(statusFilter !== 'all' || speciesFilter !== 'all' || search.length >= 2) && ` sur ${animals.length}`}
      </p>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher (nom, puce, medaille)..."
          className="flex-1 max-w-md px-4 py-2.5 bg-surface-dark border border-border rounded-lg text-sm
            focus:border-primary focus:ring-1 focus:ring-primary transition-colors
            placeholder:text-muted/50"
        />
        <select
          value={speciesFilter}
          onChange={(e) => setSpeciesFilter(e.target.value)}
          className="px-4 py-2.5 bg-surface-dark border border-border rounded-lg text-sm
            focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
        >
          <option value="all">Toutes les especes</option>
          <option value="cat">Chats</option>
          <option value="dog">Chiens</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 bg-surface-dark border border-border rounded-lg text-sm
            focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
        >
          <option value="all">Tous les statuts</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>{getStatusLabel(s)}</option>
          ))}
        </select>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted">
          <p className="text-lg">Aucun animal trouve</p>
          <p className="text-sm mt-1">Essayez de modifier vos filtres</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((animal) => {
            const photoUrl = getPrimaryPhoto(animal)
            return (
              <Link
                key={animal.id}
                href={`/animals/${animal.id}`}
                className="group bg-surface border border-border rounded-xl overflow-hidden hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all"
              >
                {/* Photo */}
                <div className="relative aspect-square bg-surface-dark">
                  {photoUrl ? (
                    <Image
                      src={photoUrl}
                      alt={animal.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-6xl">
                      {getFallbackEmoji(animal.species)}
                    </div>
                  )}
                  {/* Status badge overlay */}
                  <div className="absolute top-2 right-2">
                    <AnimalStatusBadge status={animal.status} overlay />
                  </div>
                </div>

                {/* Info */}
                <div className="p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <h3 className="font-semibold text-sm truncate">{animal.name}</h3>
                    <span className="text-muted text-sm shrink-0">{getSexIcon(animal.sex)}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <SpeciesBadge species={animal.species} />
                    {animal.breed && (
                      <span className="text-xs text-muted truncate">{animal.breed}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span>{calculateAge(animal.birth_date)}</span>
                    {animal.chip_number && (
                      <span className="font-mono truncate ml-2">{animal.chip_number}</span>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
