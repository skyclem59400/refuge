'use client'

import { useState } from 'react'
import { Pill, Plus } from 'lucide-react'
import { TreatmentForm } from './treatment-form'
import { TreatmentList } from './treatment-list'
import type { AnimalTreatment, AnimalHealthRecord } from '@/lib/types/database'

type TreatmentWithAnimal = AnimalTreatment & {
  animals: { id: string; nom: string; species: string }
}

interface HealthTreatmentsSectionProps {
  treatments: TreatmentWithAnimal[]
  animals: { id: string; nom: string }[]
  healthRecords: AnimalHealthRecord[]
  canManageHealth: boolean
}

export function HealthTreatmentsSection({
  treatments,
  animals,
  healthRecords,
  canManageHealth,
}: Readonly<HealthTreatmentsSectionProps>) {
  const [showForm, setShowForm] = useState(false)
  const activeCount = treatments.filter((t) => t.active).length

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted flex items-center gap-2">
          <Pill className="w-4 h-4 text-primary" />
          Traitements en cours ({activeCount})
        </h2>
        {canManageHealth && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold
              bg-primary/15 text-primary hover:bg-primary/25 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Nouveau traitement
          </button>
        )}
      </div>

      {showForm && canManageHealth && (
        <div className="mb-4">
          <TreatmentForm
            animals={animals}
            healthRecords={healthRecords}
            onClose={() => setShowForm(false)}
          />
        </div>
      )}

      <TreatmentList treatments={treatments} animals={animals} healthRecords={healthRecords} canManage={canManageHealth} />
    </div>
  )
}
