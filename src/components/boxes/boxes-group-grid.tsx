'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { reorderBoxes } from '@/lib/actions/boxes'
import { BoxTile } from './box-tile'
import type { ZoneColor } from '@/lib/zone-colors'
import type { BoxZone } from '@/lib/actions/box-zones'
import type { EnrichedBox, BoxSummary } from './types'

interface Props {
  boxes: EnrichedBox[]
  color: ZoneColor
  canManage: boolean
  allBoxes: BoxSummary[]
  zones: BoxZone[]
  /** Identifiant de groupe pour scoper le DnD (zone+sous-zone). */
  groupKey: string
}

export function BoxesGroupGrid({
  boxes,
  color,
  canManage,
  allBoxes,
  zones,
  groupKey,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  // Permet un re-tri optimiste local pendant que le serveur traite
  const [optimisticOrder, setOptimisticOrder] = useState<string[] | null>(null)

  const orderedIds = optimisticOrder ?? boxes.map((b) => b.id)
  const boxById = new Map(boxes.map((b) => [b.id, b]))

  function handleReorder(sourceBoxId: string, targetBoxId: string) {
    if (sourceBoxId === targetBoxId) return
    const ids = [...orderedIds]
    const fromIdx = ids.indexOf(sourceBoxId)
    if (fromIdx < 0) return
    ids.splice(fromIdx, 1)
    const toIdx = ids.indexOf(targetBoxId)
    if (toIdx < 0) return
    ids.splice(toIdx, 0, sourceBoxId)

    setOptimisticOrder(ids)
    startTransition(async () => {
      const result = await reorderBoxes(ids)
      if (result.error) {
        // Rollback en cas d'erreur
        setOptimisticOrder(null)
        // eslint-disable-next-line no-console
        console.error('reorderBoxes error:', result.error)
      } else {
        router.refresh()
        // Le serveur a la nouvelle vérité, on peut retirer l'optimiste apres refresh
        setTimeout(() => setOptimisticOrder(null), 300)
      }
    })
  }

  return (
    <div className="relative">
      {pending && (
        <div className="absolute top-0 right-0 z-10 px-2 py-1 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center gap-1">
          <Loader2 size={10} className="animate-spin" />
          Réorganisation...
        </div>
      )}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2 snap-x">
        {orderedIds.map((id) => {
          const box = boxById.get(id)
          if (!box) return null
          return (
            <div key={box.id} className="snap-start">
              <BoxTile
                box={box}
                color={color}
                canManage={canManage}
                allBoxes={allBoxes}
                zones={zones}
                groupKey={groupKey}
                onReorderTarget={(sourceBoxId) => handleReorder(sourceBoxId, box.id)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
