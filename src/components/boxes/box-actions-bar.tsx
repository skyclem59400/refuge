'use client'

import { useState } from 'react'
import { Printer, Settings, Plus } from 'lucide-react'
import type { ZoneColor } from '@/lib/zone-colors'
import type { BoxZone } from '@/lib/actions/box-zones'
import type { EnrichedBox } from './types'
import { AssignAnimalsPopover } from './assign-animals-popover'
import { EditBoxDrawer } from './edit-box-drawer'

interface Props {
  readonly box: EnrichedBox
  readonly color: ZoneColor
  readonly canManage: boolean
  readonly zones: BoxZone[]
  readonly remainingCapacity: number
}

export function BoxActionsBar({ box, color, canManage, zones, remainingCapacity }: Props) {
  const [showAssign, setShowAssign] = useState(false)
  const [showEdit, setShowEdit] = useState(false)

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {canManage && remainingCapacity > 0 && (
          <button
            type="button"
            onClick={() => setShowAssign(true)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold ${color.bg} ${color.textOn} hover:opacity-90 transition-opacity shadow`}
          >
            <Plus className="w-4 h-4" />
            Assigner ({remainingCapacity})
          </button>
        )}
        {canManage && (
          <button
            type="button"
            onClick={() => setShowEdit(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-border text-text hover:bg-surface-hover transition-colors"
          >
            <Settings className="w-4 h-4" />
            Modifier
          </button>
        )}
        <a
          href={`/api/pdf/box/${box.id}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Fiche PDF du box"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-border text-muted hover:text-text hover:bg-surface-hover transition-colors"
        >
          <Printer className="w-4 h-4" />
          Fiche PDF
        </a>
      </div>

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
