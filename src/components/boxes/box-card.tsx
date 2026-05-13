'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Printer, Plus, GripVertical, Move, Loader2, Settings } from 'lucide-react'
import type { ZoneColor } from '@/lib/zone-colors'
import type { BoxZone } from '@/lib/actions/box-zones'
import type { BoxAnimal, EnrichedBox, BoxSummary } from './types'
import { moveAnimalToBox } from '@/lib/actions/box-assignments'
import { AssignAnimalsPopover } from './assign-animals-popover'
import { MoveAnimalMenu } from './move-animal-menu'
import { EditBoxDrawer } from './edit-box-drawer'
import { getSpeciesEmoji, getSpeciesLabelPlural } from '@/lib/species'

const DRAG_MIME = 'application/x-sda-animal'
const BOX_DRAG_MIME = 'application/x-sda-box'

// ---------------------------------------------------------------------------
// Helpers (locaux, non shared)
// ---------------------------------------------------------------------------

function speciesIcon(species: string): string {
  return getSpeciesEmoji(species)
}

function speciesTypeLabel(species: string): string {
  if (species === 'mixed') return 'Mixte'
  if (species === 'farm') return 'Ferme'
  return getSpeciesLabelPlural(species)
}

function boxStatusLabel(status: string): string {
  if (status === 'available') return 'Disponible'
  if (status === 'occupied') return 'Occupé'
  if (status === 'maintenance') return 'Maintenance'
  return status
}

function boxStatusColor(status: string): string {
  if (status === 'available') return 'bg-success/85 text-white'
  if (status === 'occupied') return 'bg-warning/85 text-white'
  if (status === 'maintenance') return 'bg-error/85 text-white'
  return 'bg-muted/85 text-white'
}

function capacityBarColor(animalCount: number, capacity: number): string {
  if (animalCount >= capacity) return 'bg-error'
  if (animalCount > 0) return 'bg-primary'
  return 'bg-muted/30'
}

function animalStatusColor(status: string | null | undefined) {
  switch (status) {
    case 'shelter':
      return { bg: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300', label: 'Refuge' }
    case 'pound':
      return { bg: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300', label: 'Fourrière' }
    case 'foster_family':
      return { bg: 'bg-violet-500', text: 'text-violet-700 dark:text-violet-300', label: 'FA' }
    case 'boarding':
      return { bg: 'bg-teal-500', text: 'text-teal-700 dark:text-teal-300', label: 'Pension' }
    case 'adopted':
      return { bg: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-300', label: 'Adopté' }
    case 'returned':
      return { bg: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-300', label: 'Rendu' }
    case 'transferred':
      return { bg: 'bg-indigo-500', text: 'text-indigo-700 dark:text-indigo-300', label: 'Transféré' }
    case 'deceased':
    case 'euthanized':
      return { bg: 'bg-zinc-500', text: 'text-zinc-600 dark:text-zinc-400', label: 'Décédé' }
    default:
      return { bg: 'bg-muted', text: 'text-muted', label: status ?? '—' }
  }
}

function ageLabel(birthDate: string | null | undefined): string | null {
  if (!birthDate) return null
  const bd = new Date(birthDate)
  if (Number.isNaN(bd.getTime())) return null
  const now = new Date()
  let years = now.getFullYear() - bd.getFullYear()
  const m = now.getMonth() - bd.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < bd.getDate())) years--
  if (years < 1) {
    const months = Math.max(
      0,
      (now.getFullYear() - bd.getFullYear()) * 12 + (now.getMonth() - bd.getMonth())
    )
    return `${months} mois`
  }
  return `${years} an${years > 1 ? 's' : ''}`
}

function sexSymbol(sex: string | null | undefined) {
  if (sex === 'male') return { symbol: '♂', color: 'text-blue-500', overlay: 'text-blue-300' }
  if (sex === 'female') return { symbol: '♀', color: 'text-pink-500', overlay: 'text-pink-300' }
  return null
}

// ---------------------------------------------------------------------------
// BoxCard
// ---------------------------------------------------------------------------

interface BoxCardProps {
  box: EnrichedBox
  color: ZoneColor
  canManage: boolean
  allBoxes: BoxSummary[]
  zones: BoxZone[]
  /** Groupe de réorganisation (zone+sous-zone). Si fourni, active le drag-and-drop box. */
  groupKey?: string
  /** Callback appelé quand un autre box du même groupe est déposé sur cette carte. */
  onReorderTarget?: (sourceBoxId: string) => void
}

export function BoxCard({
  box,
  color,
  canManage,
  allBoxes,
  zones,
  groupKey,
  onReorderTarget,
}: BoxCardProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [isDragOver, setIsDragOver] = useState(false)
  const [isBoxDragOver, setIsBoxDragOver] = useState(false)
  const [dropError, setDropError] = useState<string | null>(null)
  const [showAssign, setShowAssign] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [hoveredAnimalId, setHoveredAnimalId] = useState<string | null>(null)
  const [moveMenuFor, setMoveMenuFor] = useState<string | null>(null)

  const isEmpty = box.animals.length === 0
  const isFull = box.animal_count >= box.capacity
  const remainingCapacity = box.capacity - box.animal_count
  const heroAnimal = box.animals[0]
  const otherAnimals = box.animals.slice(1)

  function handleDragOver(e: React.DragEvent) {
    if (!canManage) return
    const types = Array.from(e.dataTransfer.types)
    // Drop d'un animal (existant)
    if (types.includes(DRAG_MIME) && !isFull) {
      e.preventDefault()
      setIsDragOver(true)
      return
    }
    // Drop d'un autre box (réorganisation)
    if (types.includes(BOX_DRAG_MIME) && groupKey && onReorderTarget) {
      e.preventDefault()
      setIsBoxDragOver(true)
      return
    }
  }

  function handleDragLeave() {
    setIsDragOver(false)
    setIsBoxDragOver(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    setIsBoxDragOver(false)
    setDropError(null)

    // 1. Drop animal
    const animalPayload = e.dataTransfer.getData(DRAG_MIME)
    if (animalPayload) {
      let animalId: string | null = null
      let sourceBoxId: string | null = null
      try {
        const parsed = JSON.parse(animalPayload)
        animalId = parsed.animalId
        sourceBoxId = parsed.sourceBoxId
      } catch {
        return
      }
      if (!animalId) return
      if (sourceBoxId === box.id) return
      startTransition(async () => {
        const result = await moveAnimalToBox(animalId!, box.id)
        if (result.error) {
          setDropError(result.error)
          setTimeout(() => setDropError(null), 3500)
        } else {
          router.refresh()
        }
      })
      return
    }

    // 2. Drop box (réorganisation)
    const boxPayload = e.dataTransfer.getData(BOX_DRAG_MIME)
    if (boxPayload && groupKey && onReorderTarget) {
      try {
        const parsed = JSON.parse(boxPayload)
        if (parsed.groupKey !== groupKey) {
          setDropError('Impossible de déplacer un box entre zones différentes (utiliser Modifier).')
          setTimeout(() => setDropError(null), 3500)
          return
        }
        if (parsed.boxId && parsed.boxId !== box.id) {
          onReorderTarget(parsed.boxId)
        }
      } catch {
        // ignore
      }
    }
  }

  function handleBoxDragStart(e: React.DragEvent) {
    if (!canManage || !groupKey) return
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData(
      BOX_DRAG_MIME,
      JSON.stringify({ boxId: box.id, groupKey })
    )
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`group relative bg-surface rounded-2xl border ${color.borderSoft} overflow-hidden hover:shadow-2xl hover:shadow-black/10 hover:-translate-y-0.5 transition-all duration-200 ${
        isDragOver ? `ring-4 ${color.ring} scale-[1.02] shadow-2xl` : ''
      } ${isBoxDragOver ? `ring-4 ring-primary/60 scale-[1.02] shadow-2xl` : ''} ${pending ? 'opacity-70' : ''}`}
    >
      {/* Poignée de drag pour réorganiser (visible au hover) */}
      {canManage && groupKey && (
        <div
          draggable
          onDragStart={handleBoxDragStart}
          className="absolute top-1 right-1 z-30 p-1 rounded-md bg-black/50 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
          title="Glisser pour réorganiser"
          aria-label="Glisser pour réorganiser"
        >
          <GripVertical className="w-3.5 h-3.5 text-white" />
        </div>
      )}

      {/* Bandeau couleur zone */}
      <div className={`h-1 ${color.bg}`} aria-hidden />

      {/* Pending overlay */}
      {pending && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-surface/60 backdrop-blur-sm">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      )}

      {/* Drop indicator animal */}
      {isDragOver && (
        <div
          className={`absolute inset-0 z-20 pointer-events-none flex items-center justify-center bg-gradient-to-b from-transparent ${color.bgSoft} backdrop-blur-[1px]`}
        >
          <div
            className={`px-4 py-2 rounded-full ${color.bg} ${color.textOn} font-bold text-sm shadow-xl flex items-center gap-2`}
          >
            <Move size={14} /> Déposer ici
          </div>
        </div>
      )}

      {/* Drop indicator reorganisation box */}
      {isBoxDragOver && (
        <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center bg-primary/10 backdrop-blur-[1px]">
          <div className="px-4 py-2 rounded-full bg-primary text-white font-bold text-sm shadow-xl flex items-center gap-2">
            <GripVertical size={14} /> Placer avant
          </div>
        </div>
      )}

      {/* Drop error */}
      {dropError && (
        <div className="absolute top-2 inset-x-2 z-30 bg-error text-white text-[11px] font-semibold px-2 py-1 rounded-md shadow-lg animate-fade-up">
          {dropError}
        </div>
      )}

      {/* Hero photo */}
      <div className="relative aspect-[4/3] overflow-hidden bg-muted/10">
        {isEmpty ? (
          <BoxEmptyHero box={box} color={color} />
        ) : (
          <BoxAnimalsHero
            animals={box.animals}
            color={color}
            boxId={box.id}
            canManage={canManage}
          />
        )}

        <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-2 pointer-events-none">
          {/* On masque le pill "Disponible" quand le box est vide : le hero l'indique deja */}
          {!(isEmpty && box.status === 'available') ? (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md shadow-sm ${boxStatusColor(box.status)}`}
            >
              {boxStatusLabel(box.status)}
            </span>
          ) : (
            <span aria-hidden />
          )}
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-bold backdrop-blur-md shadow-sm ${
              isFull
                ? 'bg-error/90 text-white'
                : 'bg-white/90 text-zinc-900 dark:bg-zinc-900/85 dark:text-white'
            }`}
          >
            {box.animal_count}/{box.capacity}
          </span>
        </div>
      </div>

      {/* Header */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl shrink-0">{speciesIcon(box.species_type)}</span>
            <div className="min-w-0">
              <h3 className="font-bold text-sm truncate">{box.name}</h3>
              <p className="text-[10px] text-muted uppercase tracking-wider">
                {speciesTypeLabel(box.species_type)}
              </p>
            </div>
          </div>

          {canManage && (
            <div className="flex items-center gap-1 shrink-0">
              {!isFull && (
                <button
                  onClick={() => setShowAssign(true)}
                  type="button"
                  title={`Assigner un animal (${remainingCapacity} place${remainingCapacity > 1 ? 's' : ''})`}
                  className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors"
                >
                  <Plus size={14} />
                </button>
              )}
              <button
                onClick={() => setShowEdit(true)}
                type="button"
                title="Modifier le box"
                className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-muted/15 text-muted hover:bg-muted/30 hover:text-text transition-colors opacity-0 group-hover:opacity-100"
              >
                <Settings size={13} />
              </button>
              {showAssign && (
                <AssignAnimalsPopover
                  boxId={box.id}
                  boxName={box.name}
                  boxSpeciesType={box.species_type}
                  remainingCapacity={remainingCapacity}
                  onClose={() => setShowAssign(false)}
                />
              )}
              {showEdit && (
                <EditBoxDrawer
                  box={box}
                  zones={zones}
                  onClose={() => setShowEdit(false)}
                />
              )}
            </div>
          )}
        </div>

        {/* Capacity bar */}
        <div className="w-full h-1 bg-muted/15 rounded-full overflow-hidden mb-2">
          <div
            className={`h-full rounded-full transition-all ${capacityBarColor(box.animal_count, box.capacity)}`}
            style={{
              width: `${Math.min((box.animal_count / Math.max(box.capacity, 1)) * 100, 100)}%`,
            }}
          />
        </div>
      </div>

      {/* Mini-rows */}
      {!isEmpty && (
        <div className="px-4 pb-3 space-y-1.5">
          <AnimalMiniRow
            animal={heroAnimal}
            primary
            boxId={box.id}
            canManage={canManage}
            allBoxes={allBoxes}
            isHovered={hoveredAnimalId === heroAnimal.id}
            onHover={() => setHoveredAnimalId(heroAnimal.id)}
            onLeave={() => setHoveredAnimalId(null)}
            moveMenuOpen={moveMenuFor === heroAnimal.id}
            onOpenMove={() => setMoveMenuFor(heroAnimal.id)}
            onCloseMove={() => setMoveMenuFor(null)}
          />
          {otherAnimals.map((animal) => (
            <AnimalMiniRow
              key={animal.id}
              animal={animal}
              boxId={box.id}
              canManage={canManage}
              allBoxes={allBoxes}
              isHovered={hoveredAnimalId === animal.id}
              onHover={() => setHoveredAnimalId(animal.id)}
              onLeave={() => setHoveredAnimalId(null)}
              moveMenuOpen={moveMenuFor === animal.id}
              onOpenMove={() => setMoveMenuFor(animal.id)}
              onCloseMove={() => setMoveMenuFor(null)}
            />
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 pb-3 pt-1 border-t border-border/40 flex items-center justify-between">
        <a
          href={`/api/pdf/box/${box.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-primary transition-colors"
        >
          <Printer className="w-3 h-3" />
          Fiche PDF
        </a>
        {!isEmpty && (
          <span className="text-[10px] text-muted">
            {box.animals.length} animal{box.animals.length > 1 ? 'x' : ''}
          </span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// BoxAnimalsHero
// ---------------------------------------------------------------------------

function BoxAnimalsHero({
  animals,
  color,
  boxId,
  canManage,
}: {
  animals: BoxAnimal[]
  color: ZoneColor
  boxId: string
  canManage: boolean
}) {
  if (animals.length === 1) {
    return <AnimalHeroSingle animal={animals[0]} color={color} boxId={boxId} canManage={canManage} />
  }
  if (animals.length === 2) {
    return (
      <div className="grid grid-cols-2 gap-0.5 h-full">
        {animals.map((a) => (
          <AnimalHeroSingle key={a.id} animal={a} color={color} boxId={boxId} canManage={canManage} compact />
        ))}
      </div>
    )
  }
  const [main, ...rest] = animals
  const top = rest[0]
  const bottom = rest[1]
  const extra = rest.length - 2
  return (
    <div className="grid grid-cols-3 grid-rows-2 gap-0.5 h-full">
      <div className="col-span-2 row-span-2">
        <AnimalHeroSingle animal={main} color={color} boxId={boxId} canManage={canManage} compact />
      </div>
      <div className="relative">
        <AnimalHeroSingle animal={top} color={color} boxId={boxId} canManage={canManage} compact tiny />
      </div>
      <div className="relative">
        <AnimalHeroSingle animal={bottom} color={color} boxId={boxId} canManage={canManage} compact tiny />
        {extra > 0 && (
          <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px] flex items-center justify-center text-white font-bold text-base pointer-events-none">
            +{extra}
          </div>
        )}
      </div>
    </div>
  )
}

function AnimalHeroSingle({
  animal,
  color,
  boxId,
  canManage,
  compact = false,
  tiny = false,
}: {
  animal: BoxAnimal
  color: ZoneColor
  boxId: string
  canManage: boolean
  compact?: boolean
  tiny?: boolean
}) {
  const sex = sexSymbol(animal.sex)
  const status = animalStatusColor(animal.status)

  function handleDragStart(e: React.DragEvent) {
    if (!canManage) return
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify({ animalId: animal.id, sourceBoxId: boxId }))
  }

  return (
    <div
      draggable={canManage}
      onDragStart={handleDragStart}
      className={`relative block w-full h-full overflow-hidden group/hero ${
        canManage ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
    >
      <Link href={`/animals/${animal.id}`} className="absolute inset-0 z-0">
        {animal.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={animal.photo_url}
            alt={animal.name}
            draggable={false}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover/hero:scale-105"
          />
        ) : (
          <div className={`absolute inset-0 ${color.bgSoft} flex items-center justify-center`}>
            <span className={tiny ? 'text-3xl' : compact ? 'text-5xl' : 'text-6xl'}>
              {speciesIcon(animal.species)}
            </span>
          </div>
        )}
      </Link>

      {!tiny && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2 pt-8 pointer-events-none">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`w-1.5 h-1.5 rounded-full ${status.bg}`} />
            <span className="font-bold text-white text-xs truncate uppercase tracking-wide">
              {animal.name}
            </span>
            {sex && <span className={`text-sm font-bold ${sex.overlay}`}>{sex.symbol}</span>}
          </div>
        </div>
      )}

      {!tiny && !compact && (
        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end pointer-events-none">
          {animal.reserved && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500 text-white shadow">
              Réservé
            </span>
          )}
          {animal.adoptable && !animal.reserved && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500 text-white shadow">
              Adoptable
            </span>
          )}
        </div>
      )}

      {/* Drag handle indicator */}
      {canManage && !tiny && (
        <div className="absolute top-2 left-2 opacity-0 group-hover/hero:opacity-80 transition-opacity pointer-events-none">
          <div className="bg-black/60 backdrop-blur-md rounded p-1">
            <GripVertical className="w-3 h-3 text-white" />
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// BoxEmptyHero
// ---------------------------------------------------------------------------

function BoxEmptyHero({ box, color }: { box: EnrichedBox; color: ZoneColor }) {
  return (
    <div className={`relative flex flex-col items-center justify-center h-full ${color.bgSofter}`}>
      <div
        className={`flex items-center justify-center w-16 h-16 rounded-2xl ${color.bgSoft} border ${color.borderSoft} mb-2 shadow-sm`}
      >
        <span className="text-4xl">{speciesIcon(box.species_type)}</span>
      </div>
      <p className={`text-[11px] font-bold uppercase tracking-wider ${color.text}`}>Disponible</p>
      <p className="text-[10px] text-muted mt-0.5">
        {box.capacity} place{box.capacity > 1 ? 's' : ''}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AnimalMiniRow (avec Move menu au hover)
// ---------------------------------------------------------------------------

function AnimalMiniRow({
  animal,
  primary = false,
  boxId,
  canManage,
  allBoxes,
  isHovered,
  onHover,
  onLeave,
  moveMenuOpen,
  onOpenMove,
  onCloseMove,
}: {
  animal: BoxAnimal
  primary?: boolean
  boxId: string
  canManage: boolean
  allBoxes: BoxSummary[]
  isHovered: boolean
  onHover: () => void
  onLeave: () => void
  moveMenuOpen: boolean
  onOpenMove: () => void
  onCloseMove: () => void
}) {
  const sex = sexSymbol(animal.sex)
  const status = animalStatusColor(animal.status)
  const age = ageLabel(animal.birth_date)

  function handleDragStart(e: React.DragEvent) {
    if (!canManage) return
    e.stopPropagation()
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify({ animalId: animal.id, sourceBoxId: boxId }))
  }

  return (
    <div
      className="relative"
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      draggable={canManage}
      onDragStart={handleDragStart}
    >
      <Link
        href={`/animals/${animal.id}`}
        className={`flex items-center gap-2 group/row hover:bg-surface-hover -mx-1 px-1 py-0.5 rounded-md transition-colors ${
          canManage ? 'cursor-grab' : ''
        }`}
      >
        <div
          className={`relative w-7 h-7 rounded-full overflow-hidden bg-muted/15 shrink-0 ring-2 ${
            primary ? 'ring-primary/20' : 'ring-transparent'
          }`}
        >
          {animal.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={animal.photo_url}
              alt={animal.name}
              draggable={false}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-sm">
              {speciesIcon(animal.species)}
            </div>
          )}
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${status.bg} ring-2 ring-surface`}
            title={status.label}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="font-semibold text-xs truncate group-hover/row:text-primary">
              {animal.name}
            </span>
            {sex && <span className={`text-xs font-bold ${sex.color}`}>{sex.symbol}</span>}
          </div>
          <div className={`text-[10px] ${status.text} flex items-center gap-1`}>
            <span>{status.label}</span>
            {age && (
              <>
                <span className="opacity-50">·</span>
                <span>{age}</span>
              </>
            )}
            {animal.sterilized && (
              <>
                <span className="opacity-50">·</span>
                <span title="Stérilisé">⚕</span>
              </>
            )}
          </div>
        </div>

        {/* Bouton Déplacer (visible au hover) */}
        {canManage && isHovered && !moveMenuOpen && (
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onOpenMove()
            }}
            type="button"
            title="Déplacer vers un autre box"
            className="shrink-0 p-1 rounded text-muted hover:bg-primary/10 hover:text-primary transition-colors"
          >
            <Move size={11} />
          </button>
        )}
      </Link>

      {/* Menu Move */}
      {moveMenuOpen && (
        <MoveAnimalMenu
          animalId={animal.id}
          animalName={animal.name}
          animalSpecies={animal.species}
          currentBoxId={boxId}
          allBoxes={allBoxes}
          onClose={onCloseMove}
        />
      )}
    </div>
  )
}
