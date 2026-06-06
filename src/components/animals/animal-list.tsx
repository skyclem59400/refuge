'use client'

import { useState, useMemo, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Heart, Bookmark, Home, Siren, FileEdit, Briefcase } from 'lucide-react'
import { AnimalStatusBadge, SpeciesBadge } from './animal-status-badge'
import { getSexIcon, calculateAge, getStatusLabel } from '@/lib/sda-utils'
import { toggleAdoptable, toggleReserved, toggleRetirementBasket, toggleIsSos } from '@/lib/actions/animals'
import { getSpeciesEmoji } from '@/lib/species'
import type { Animal, AnimalPhoto, AnimalStatus } from '@/lib/types/database'

type AnimalWithPhotos = Animal & { animal_photos: AnimalPhoto[] }

interface AnimalListProps {
  animals: AnimalWithPhotos[]
  canManageAdoptions?: boolean
}

// Animaux physiquement à charge du refuge (présents)
const PRESENT_STATUSES: AnimalStatus[] = ['pound', 'shelter', 'foster_family', 'boarding']
// Animaux sortis du refuge (archive vivante)
const EXIT_STATUSES: AnimalStatus[] = ['adopted', 'returned', 'transferred', 'deceased', 'euthanized']

type PresenceTab = 'present' | 'exited'

function formatExitDate(iso: string | null): string | null {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return null
  }
}

export function AnimalList({ animals, canManageAdoptions = false }: Readonly<AnimalListProps>) {
  const router = useRouter()
  const [presenceTab, setPresenceTab] = useState<PresenceTab>('present')
  const [search, setSearch] = useState('')
  const [speciesFilter, setSpeciesFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [adoptableFilter, setAdoptableFilter] = useState<string>('all')
  const [reservedFilter, setReservedFilter] = useState<string>('all')
  const [retirementBasketFilter, setRetirementBasketFilter] = useState<string>('all')
  const [judicialFilter, setJudicialFilter] = useState<string>('all')
  const [isPending, startTransition] = useTransition()
  const [pendingAnimalId, setPendingAnimalId] = useState<string | null>(null)
  const [pendingField, setPendingField] = useState<'adoptable' | 'reserved' | 'retirement_basket' | 'is_sos' | null>(null)
  // Optimistic state
  const [optimisticAdoptable, setOptimisticAdoptable] = useState<Record<string, boolean>>({})
  const [optimisticReserved, setOptimisticReserved] = useState<Record<string, boolean>>({})
  const [optimisticRetirementBasket, setOptimisticRetirementBasket] = useState<Record<string, boolean>>({})
  const [optimisticIsSos, setOptimisticIsSos] = useState<Record<string, boolean>>({})

  // Compteurs par onglet, indépendants des autres filtres (reste stable en cherchant)
  const presentCount = useMemo(
    () => animals.filter((a) => PRESENT_STATUSES.includes(a.status)).length,
    [animals]
  )
  const exitedCount = useMemo(
    () => animals.filter((a) => EXIT_STATUSES.includes(a.status)).length,
    [animals]
  )

  // Statuts proposés dans le dropdown selon l'onglet courant
  const statusOptions = presenceTab === 'present' ? PRESENT_STATUSES : EXIT_STATUSES

  // Reset le filtre statut quand on change d'onglet (sinon "shelter" reste sélectionné sur l'onglet Sortis et liste vide)
  function switchTab(next: PresenceTab) {
    if (next === presenceTab) return
    setPresenceTab(next)
    setStatusFilter('all')
  }

  const filtered = useMemo(() => {
    // 1. Filtre primaire : onglet présence
    const tabStatuses = presenceTab === 'present' ? PRESENT_STATUSES : EXIT_STATUSES
    let result = animals.filter((a) => tabStatuses.includes(a.status))

    // 2. Recherche
    if (search.length >= 2) {
      const q = search.toLowerCase()
      result = result.filter((a) =>
        a.name.toLowerCase().includes(q) ||
        (a.chip_number && a.chip_number.toLowerCase().includes(q)) ||
        (a.medal_number && a.medal_number.toLowerCase().includes(q))
      )
    }

    // 3. Espèce
    if (speciesFilter !== 'all') {
      result = result.filter((a) => a.species === speciesFilter)
    }

    // 4. Statut spécifique (au sein de l'onglet)
    if (statusFilter !== 'all') {
      result = result.filter((a) => a.status === statusFilter)
    }

    // 5. Filtres adoption-related : uniquement sur l'onglet "Présents"
    if (presenceTab === 'present') {
      if (adoptableFilter === 'yes') {
        result = result.filter((a) => a.id in optimisticAdoptable ? optimisticAdoptable[a.id] : a.adoptable)
      } else if (adoptableFilter === 'no') {
        result = result.filter((a) => a.id in optimisticAdoptable ? !optimisticAdoptable[a.id] : !a.adoptable)
      }
      if (reservedFilter === 'yes') {
        result = result.filter((a) => a.id in optimisticReserved ? optimisticReserved[a.id] : a.reserved)
      } else if (reservedFilter === 'no') {
        result = result.filter((a) => a.id in optimisticReserved ? !optimisticReserved[a.id] : !a.reserved)
      }
      if (retirementBasketFilter === 'yes') {
        result = result.filter((a) => a.id in optimisticRetirementBasket ? optimisticRetirementBasket[a.id] : a.retirement_basket)
      } else if (retirementBasketFilter === 'no') {
        result = result.filter((a) => a.id in optimisticRetirementBasket ? !optimisticRetirementBasket[a.id] : !a.retirement_basket)
      }
      if (judicialFilter === 'yes') {
        result = result.filter((a) => a.judicial_procedure)
      } else if (judicialFilter === 'no') {
        result = result.filter((a) => !a.judicial_procedure)
      }
    }

    // 6. Tri : présents par nom (déjà fait côté serveur, mais re-tri pour stabilité),
    //    sortis par date de sortie DESC (plus récents d'abord — usage typique : "quand X est parti ?")
    if (presenceTab === 'exited') {
      result = [...result].sort((a, b) => {
        const da = a.exit_date ? new Date(a.exit_date).getTime() : 0
        const db = b.exit_date ? new Date(b.exit_date).getTime() : 0
        return db - da
      })
    }

    return result
  }, [animals, presenceTab, search, speciesFilter, statusFilter, adoptableFilter, reservedFilter, retirementBasketFilter, judicialFilter, optimisticAdoptable, optimisticReserved, optimisticRetirementBasket])

  function getPrimaryPhoto(animal: AnimalWithPhotos): string | null {
    if (animal.animal_photos && animal.animal_photos.length > 0) {
      const primary = animal.animal_photos.find((p) => p.is_primary)
      return primary ? primary.url : animal.animal_photos[0].url
    }
    if (animal.photo_url) return animal.photo_url
    return null
  }

  function handleToggleAdoptable(e: React.MouseEvent, animalId: string, currentValue: boolean) {
    e.preventDefault()
    e.stopPropagation()
    const newValue = !currentValue
    setPendingAnimalId(animalId)
    setPendingField('adoptable')
    setOptimisticAdoptable(prev => ({ ...prev, [animalId]: newValue }))
    startTransition(async () => {
      const result = await toggleAdoptable(animalId, newValue)
      if (result.error) {
        toast.error(result.error)
        setOptimisticAdoptable(prev => ({ ...prev, [animalId]: currentValue }))
      }
      setPendingAnimalId(null)
      setPendingField(null)
      router.refresh()
    })
  }

  function handleToggleReserved(e: React.MouseEvent, animalId: string, currentValue: boolean) {
    e.preventDefault()
    e.stopPropagation()
    const newValue = !currentValue
    setPendingAnimalId(animalId)
    setPendingField('reserved')
    setOptimisticReserved(prev => ({ ...prev, [animalId]: newValue }))
    startTransition(async () => {
      const result = await toggleReserved(animalId, newValue)
      if (result.error) {
        toast.error(result.error)
        setOptimisticReserved(prev => ({ ...prev, [animalId]: currentValue }))
      }
      setPendingAnimalId(null)
      setPendingField(null)
      router.refresh()
    })
  }

  function handleToggleRetirementBasket(e: React.MouseEvent, animalId: string, currentValue: boolean) {
    e.preventDefault()
    e.stopPropagation()
    const newValue = !currentValue
    setPendingAnimalId(animalId)
    setPendingField('retirement_basket')
    setOptimisticRetirementBasket(prev => ({ ...prev, [animalId]: newValue }))
    startTransition(async () => {
      const result = await toggleRetirementBasket(animalId, newValue)
      if (result.error) {
        toast.error(result.error)
        setOptimisticRetirementBasket(prev => ({ ...prev, [animalId]: currentValue }))
      }
      setPendingAnimalId(null)
      setPendingField(null)
      router.refresh()
    })
  }

  function handleToggleIsSos(e: React.MouseEvent, animalId: string, currentValue: boolean) {
    e.preventDefault()
    e.stopPropagation()
    const newValue = !currentValue
    setPendingAnimalId(animalId)
    setPendingField('is_sos')
    setOptimisticIsSos(prev => ({ ...prev, [animalId]: newValue }))
    startTransition(async () => {
      const result = await toggleIsSos(animalId, newValue)
      if (result.error) {
        toast.error(result.error)
        setOptimisticIsSos(prev => ({ ...prev, [animalId]: currentValue }))
      }
      setPendingAnimalId(null)
      setPendingField(null)
      router.refresh()
    })
  }

  function isAdoptable(animal: AnimalWithPhotos): boolean {
    if (animal.id in optimisticAdoptable) return optimisticAdoptable[animal.id]
    return animal.adoptable
  }

  function isReserved(animal: AnimalWithPhotos): boolean {
    if (animal.id in optimisticReserved) return optimisticReserved[animal.id]
    return animal.reserved
  }

  function isRetirementBasket(animal: AnimalWithPhotos): boolean {
    if (animal.id in optimisticRetirementBasket) return optimisticRetirementBasket[animal.id]
    return animal.retirement_basket
  }

  function isSos(animal: AnimalWithPhotos): boolean {
    if (animal.id in optimisticIsSos) return optimisticIsSos[animal.id]
    return animal.is_sos
  }

  const adoptionFiltersActive = presenceTab === 'present' && (
    adoptableFilter !== 'all' || reservedFilter !== 'all' || retirementBasketFilter !== 'all' || judicialFilter !== 'all'
  )
  const hasActiveFilters = statusFilter !== 'all' || speciesFilter !== 'all' || adoptionFiltersActive || search.length >= 2
  const tabTotal = presenceTab === 'present' ? presentCount : exitedCount

  return (
    <div>
      {/* Tabs Présents / Sortis */}
      <div className="flex items-center gap-1 mb-5 border-b border-border">
        <TabButton
          active={presenceTab === 'present'}
          onClick={() => switchTab('present')}
          label="Présents"
          count={presentCount}
        />
        <TabButton
          active={presenceTab === 'exited'}
          onClick={() => switchTab('exited')}
          label="Sortis"
          count={exitedCount}
        />
      </div>

      {/* Count */}
      <p className="text-sm text-muted mb-4">
        {filtered.length} animal{filtered.length !== 1 ? 'x' : ''} {hasActiveFilters ? 'trouvé' : 'affiché'}{filtered.length !== 1 ? 's' : ''}
        {hasActiveFilters && ` sur ${tabTotal}`}
      </p>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-6">
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
          <option value="all">{presenceTab === 'present' ? 'Tous les statuts' : 'Toutes les sorties'}</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>{getStatusLabel(s)}</option>
          ))}
        </select>
        {presenceTab === 'present' && (
          <>
            <select
              value={adoptableFilter}
              onChange={(e) => setAdoptableFilter(e.target.value)}
              className="px-4 py-2.5 bg-surface-dark border border-border rounded-lg text-sm
                focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
            >
              <option value="all">Adoption : tous</option>
              <option value="yes">A l&apos;adoption</option>
              <option value="no">Non adoptable</option>
            </select>
            <select
              value={reservedFilter}
              onChange={(e) => setReservedFilter(e.target.value)}
              className="px-4 py-2.5 bg-surface-dark border border-border rounded-lg text-sm
                focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
            >
              <option value="all">Reservation : tous</option>
              <option value="yes">Reserve</option>
              <option value="no">Non reserve</option>
            </select>
            <select
              value={retirementBasketFilter}
              onChange={(e) => setRetirementBasketFilter(e.target.value)}
              className="px-4 py-2.5 bg-surface-dark border border-border rounded-lg text-sm
                focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
            >
              <option value="all">Panier retraite : tous</option>
              <option value="yes">Panier retraite</option>
              <option value="no">Pas en panier retraite</option>
            </select>
            <select
              value={judicialFilter}
              onChange={(e) => setJudicialFilter(e.target.value)}
              className="px-4 py-2.5 bg-surface-dark border border-border rounded-lg text-sm
                focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
            >
              <option value="all">Procédure : tous</option>
              <option value="yes">⚖️ En procédure</option>
              <option value="no">Hors procédure</option>
            </select>
          </>
        )}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted">
          <p className="text-lg">
            {presenceTab === 'present' ? 'Aucun animal présent' : 'Aucun animal sorti'}
          </p>
          <p className="text-sm mt-1">
            {hasActiveFilters
              ? 'Essayez de modifier vos filtres'
              : presenceTab === 'present'
              ? 'Aucun animal au refuge, en FA, en fourrière ou en pension'
              : "Aucun animal n'a quitté le refuge"}
          </p>
          {search.length >= 2 && presenceTab === 'present' && (
            <button
              type="button"
              onClick={() => switchTab('exited')}
              className="mt-3 text-sm text-primary hover:underline"
            >
              Chercher dans les animaux sortis →
            </button>
          )}
          {search.length >= 2 && presenceTab === 'exited' && (
            <button
              type="button"
              onClick={() => switchTab('present')}
              className="mt-3 text-sm text-primary hover:underline"
            >
              ← Chercher dans les animaux présents
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((animal) => {
            const photoUrl = getPrimaryPhoto(animal)
            const adoptable = isAdoptable(animal)
            const reserved = isReserved(animal)
            const retirementBasket = isRetirementBasket(animal)
            const sos = isSos(animal)
            const exitDateFr = presenceTab === 'exited' ? formatExitDate(animal.exit_date) : null
            const isExited = presenceTab === 'exited'
            return (
              <Link
                key={animal.id}
                href={`/animals/${animal.id}`}
                className={`group bg-surface border border-border rounded-xl overflow-hidden hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all ${isExited ? 'opacity-90' : ''}`}
              >
                {/* Photo */}
                <div className="relative aspect-square bg-surface-dark">
                  {photoUrl ? (
                    <Image
                      src={photoUrl}
                      alt={animal.name}
                      fill
                      unoptimized={photoUrl.includes('hunimalis.com')}
                      className={`object-cover group-hover:scale-105 transition-transform duration-300 ${isExited ? 'grayscale-[35%]' : ''}`}
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-6xl">
                      {getSpeciesEmoji(animal.species)}
                    </div>
                  )}
                  {/* Status badge overlay */}
                  <div className="absolute top-2 right-2">
                    <AnimalStatusBadge status={animal.status} overlay />
                  </div>
                  {/* Badges overlay top-left — uniquement pour les présents */}
                  {!isExited && (
                    <div className="absolute top-2 left-2 flex flex-col gap-1">
                      {sos && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/95 text-white backdrop-blur-sm animate-pulse">
                          <Siren className="w-3 h-3 fill-current" />
                          SOS
                        </span>
                      )}
                      {adoptable && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-success/90 text-white backdrop-blur-sm">
                          <Heart className="w-3 h-3 fill-current" />
                          A l&apos;adoption
                        </span>
                      )}
                      {reserved && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/90 text-white backdrop-blur-sm">
                          <Bookmark className="w-3 h-3 fill-current" />
                          {animal.pre_reservation_client_id ? 'Pré-réservé' : 'Reserve'}
                        </span>
                      )}
                      {retirementBasket && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/90 text-white backdrop-blur-sm">
                          <Home className="w-3 h-3 fill-current" />
                          Panier retraite
                        </span>
                      )}
                      {animal.description_external_pending && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/90 text-white backdrop-blur-sm" title="Brouillon en attente d'approbation">
                          <FileEdit className="w-3 h-3" />
                          BROUILLON
                        </span>
                      )}
                      {animal.judicial_procedure && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-error/90 text-white backdrop-blur-sm">
                          ⚖️ EN PROCÉDURE
                        </span>
                      )}
                      {animal.pros_only && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/90 text-white backdrop-blur-sm" title="Adoptable uniquement par des professionnels">
                          <Briefcase className="w-3 h-3" />
                          PROS UNIQUEMENT
                        </span>
                      )}
                    </div>
                  )}
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
                  {isExited ? (
                    <div className="flex items-center justify-between text-xs text-muted">
                      <span>{calculateAge(animal.birth_date)}</span>
                      {exitDateFr && (
                        <span className="text-[11px]">Sorti le <strong className="text-text">{exitDateFr}</strong></span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-xs text-muted">
                      <span>{calculateAge(animal.birth_date)}</span>
                      {canManageAdoptions && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => handleToggleIsSos(e, animal.id, sos)}
                            disabled={isPending && pendingAnimalId === animal.id && pendingField === 'is_sos'}
                            title={sos ? 'Retirer du SOS' : 'Marquer SOS'}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors
                              ${sos
                                ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30'
                                : 'bg-border/50 text-muted hover:bg-border hover:text-text'
                              }
                              disabled:opacity-50`}
                          >
                            <Siren className={`w-3 h-3 ${sos ? 'fill-current' : ''}`} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleToggleReserved(e, animal.id, reserved)}
                            disabled={isPending && pendingAnimalId === animal.id && pendingField === 'reserved'}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors
                              ${reserved
                                ? 'bg-amber-500/15 text-amber-500 hover:bg-amber-500/25'
                                : 'bg-border/50 text-muted hover:bg-border hover:text-text'
                              }
                              disabled:opacity-50`}
                          >
                            <Bookmark className={`w-3 h-3 ${reserved ? 'fill-current' : ''}`} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleToggleRetirementBasket(e, animal.id, retirementBasket)}
                            disabled={isPending && pendingAnimalId === animal.id && pendingField === 'retirement_basket'}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors
                              ${retirementBasket
                                ? 'bg-purple-500/15 text-purple-500 hover:bg-purple-500/25'
                                : 'bg-border/50 text-muted hover:bg-border hover:text-text'
                              }
                              disabled:opacity-50`}
                          >
                            <Home className={`w-3 h-3 ${retirementBasket ? 'fill-current' : ''}`} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleToggleAdoptable(e, animal.id, adoptable)}
                            disabled={isPending && pendingAnimalId === animal.id && pendingField === 'adoptable'}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors
                              ${adoptable
                                ? 'bg-success/15 text-success hover:bg-success/25'
                                : 'bg-border/50 text-muted hover:bg-border hover:text-text'
                              }
                              disabled:opacity-50`}
                          >
                            <Heart className={`w-3 h-3 ${adoptable ? 'fill-current' : ''}`} />
                          </button>
                        </div>
                      )}
                      {!canManageAdoptions && animal.chip_number && (
                        <span className="font-mono truncate ml-2">{animal.chip_number}</span>
                      )}
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean
  onClick: () => void
  label: string
  count: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative px-4 py-2.5 text-sm font-semibold transition-colors
        ${active
          ? 'text-primary border-b-2 border-primary -mb-px'
          : 'text-muted hover:text-text border-b-2 border-transparent'
        }`}
    >
      {label}
      <span className={`ml-2 inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 rounded-full text-[11px] font-bold
        ${active ? 'bg-primary/15 text-primary' : 'bg-border/50 text-muted'}`}
      >
        {count}
      </span>
    </button>
  )
}
