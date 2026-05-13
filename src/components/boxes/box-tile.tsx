'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { GripVertical, Loader2, Plus, Settings } from 'lucide-react'
import type { ZoneColor } from '@/lib/zone-colors'
import type { BoxZone } from '@/lib/actions/box-zones'
import type { BoxAnimal, EnrichedBox, BoxSummary } from './types'
import { moveAnimalToBox } from '@/lib/actions/box-assignments'
import { BoxDetailDrawer } from './box-detail-drawer'
import { AssignAnimalsPopover } from './assign-animals-popover'
import { EditBoxDrawer } from './edit-box-drawer'
import { SPECIES_LABELS_PLURAL } from '@/lib/species'
import type { AnimalSpecies } from '@/lib/types/database'

const DRAG_MIME = 'application/x-sda-animal'
const BOX_DRAG_MIME = 'application/x-sda-box'

interface Props {
  box: EnrichedBox
  color: ZoneColor
  canManage: boolean
  allBoxes: BoxSummary[]
  zones: BoxZone[]
  groupKey: string
  onReorderTarget?: (sourceBoxId: string) => void
}

function speciesEmoji(s: string): string {
  if (s === 'cat') return '🐱'
  if (s === 'dog') return '🐶'
  return '🐾'
}

function animalDot(status: string | null | undefined): string {
  switch (status) {
    case 'shelter': return 'bg-emerald-500'
    case 'pound': return 'bg-amber-500'
    case 'foster_family': return 'bg-violet-500'
    case 'boarding': return 'bg-teal-500'
    default: return 'bg-zinc-400'
  }
}

export function BoxTile({
  box,
  color,
  canManage,
  allBoxes,
  zones,
  groupKey,
  onReorderTarget,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [isDragOver, setIsDragOver] = useState(false)
  const [isBoxDragOver, setIsBoxDragOver] = useState(false)
  const [dropError, setDropError] = useState<string | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [showAssign, setShowAssign] = useState(false)
  const [showEdit, setShowEdit] = useState(false)

  const isEmpty = box.animals.length === 0
  const isFull = box.animal_count >= box.capacity
  const remainingCapacity = box.capacity - box.animal_count
  const heroAnimal = box.animals[0] as BoxAnimal | undefined
  const overflow = box.animals.length - 1

  function handleDragOver(e: React.DragEvent) {
    if (!canManage) return
    const types = Array.from(e.dataTransfer.types)
    if (types.includes(DRAG_MIME) && !isFull) {
      e.preventDefault()
      setIsDragOver(true)
      return
    }
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

    const animalPayload = e.dataTransfer.getData(DRAG_MIME)
    if (animalPayload) {
      try {
        const parsed = JSON.parse(animalPayload)
        if (parsed.sourceBoxId === box.id || !parsed.animalId) return
        startTransition(async () => {
          const result = await moveAnimalToBox(parsed.animalId, box.id)
          if (result.error) {
            setDropError(result.error)
            setTimeout(() => setDropError(null), 3500)
          } else {
            router.refresh()
          }
        })
      } catch {}
      return
    }

    const boxPayload = e.dataTransfer.getData(BOX_DRAG_MIME)
    if (boxPayload && groupKey && onReorderTarget) {
      try {
        const parsed = JSON.parse(boxPayload)
        if (parsed.groupKey !== groupKey) {
          setDropError('Pas entre zones différentes.')
          setTimeout(() => setDropError(null), 2500)
          return
        }
        if (parsed.boxId && parsed.boxId !== box.id) {
          onReorderTarget(parsed.boxId)
        }
      } catch {}
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
    <>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => setShowDetail(true)}
        className={`group relative w-[112px] h-[150px] shrink-0 bg-surface rounded-lg border ${color.borderSoft} overflow-hidden cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-150 ${
          isDragOver ? `ring-4 ${color.ring} scale-[1.05] shadow-2xl` : ''
        } ${isBoxDragOver ? `ring-4 ring-primary/60 scale-[1.05] shadow-2xl` : ''} ${pending ? 'opacity-70' : ''}`}
      >
        {/* Bandeau couleur de zone */}
        <div className={`h-0.5 ${color.bg}`} aria-hidden />

        {/* Poignée drag (visible au hover) */}
        {canManage && groupKey && (
          <div
            draggable
            onDragStart={handleBoxDragStart}
            onClick={(e) => e.stopPropagation()}
            className="absolute top-1 right-1 z-20 p-0.5 rounded bg-black/50 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
            title="Glisser pour réorganiser"
          >
            <GripVertical className="w-3 h-3 text-white" />
          </div>
        )}

        {pending && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-surface/60 backdrop-blur-sm">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          </div>
        )}

        {/* Drop indicators */}
        {isDragOver && (
          <div className={`absolute inset-0 z-10 ${color.bgSoft} flex items-center justify-center pointer-events-none`}>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${color.bg} ${color.textOn}`}>
              Déposer
            </span>
          </div>
        )}
        {isBoxDragOver && (
          <div className="absolute inset-0 z-10 bg-primary/10 flex items-center justify-center pointer-events-none">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary text-white">
              Placer avant
            </span>
          </div>
        )}

        {/* Photo / état vide */}
        <div className="relative h-[88px] overflow-hidden bg-muted/10">
          {isEmpty ? (
            <div className={`absolute inset-0 ${color.bgSofter} flex items-center justify-center`}>
              <span className="text-3xl opacity-50">{speciesEmoji(box.species_type)}</span>
            </div>
          ) : heroAnimal?.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={heroAnimal.photo_url}
              alt={heroAnimal.name}
              draggable={false}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className={`absolute inset-0 ${color.bgSoft} flex items-center justify-center`}>
              <span className="text-3xl">{speciesEmoji(heroAnimal?.species ?? box.species_type)}</span>
            </div>
          )}

          {/* Overlay overflow count */}
          {overflow > 0 && (
            <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-full bg-black/70 text-white text-[9px] font-bold">
              +{overflow}
            </div>
          )}

          {/* Pastille statut animal */}
          {heroAnimal && (
            <div className="absolute bottom-1 left-1 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/70 backdrop-blur-sm">
              <span className={`w-1.5 h-1.5 rounded-full ${animalDot(heroAnimal.status)}`} />
              <span className="text-white text-[9px] font-bold uppercase tracking-wider truncate max-w-[60px]">
                {heroAnimal.name}
              </span>
            </div>
          )}

          {/* Badge capacite */}
          <div
            className={`absolute top-1 left-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold backdrop-blur-md ${
              isFull
                ? 'bg-error/90 text-white'
                : isEmpty
                  ? 'bg-success/90 text-white'
                  : 'bg-white/90 text-zinc-900'
            }`}
          >
            {box.animal_count}/{box.capacity}
          </div>
        </div>

        {/* Footer : nom box */}
        <div className="px-2 py-1.5 flex items-center gap-1">
          <span className="text-base shrink-0">{speciesEmoji(box.species_type)}</span>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold truncate leading-tight">{box.name}</div>
            <div className="text-[9px] text-muted uppercase tracking-wider leading-none">
              {box.species_type === 'mixed' ? 'Mixte' : box.species_type === 'farm' ? 'Ferme' : box.species_type === 'other' ? 'Autres' : SPECIES_LABELS_PLURAL[box.species_type as AnimalSpecies] || box.species_type}
            </div>
          </div>
        </div>

        {dropError && (
          <div className="absolute inset-x-1 top-1 z-30 bg-error text-white text-[9px] font-semibold px-1.5 py-1 rounded text-center">
            {dropError}
          </div>
        )}
      </div>

      {/* Drawer détail box (clic) */}
      {showDetail && (
        <BoxDetailDrawer
          box={box}
          color={color}
          canManage={canManage}
          allBoxes={allBoxes}
          onClose={() => setShowDetail(false)}
          onAssign={() => {
            setShowDetail(false)
            setShowAssign(true)
          }}
          onEdit={() => {
            setShowDetail(false)
            setShowEdit(true)
          }}
        />
      )}
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
        <EditBoxDrawer box={box} zones={zones} onClose={() => setShowEdit(false)} />
      )}
    </>
  )
}
