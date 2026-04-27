'use client'

import { Fingerprint } from 'lucide-react'
import type { Animal } from '@/lib/types/database'

interface AnimalIdentificationCardProps {
  animal: Animal
}

export function AnimalIdentificationCard({ animal }: Readonly<AnimalIdentificationCardProps>) {
  const hasAnyId = !!(
    animal.chip_number ||
    animal.medal_number ||
    animal.tattoo_number ||
    animal.loof_number ||
    animal.passport_number
  )

  return (
    <div className="bg-surface rounded-xl border border-border p-5">
      <div className="flex items-center gap-2 mb-4">
        <Fingerprint className="w-4 h-4 text-muted" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">Identification</h3>
      </div>
      <div className="space-y-3 text-sm">
        {animal.chip_number && (
          <div className="flex justify-between">
            <span className="text-muted">Puce</span>
            <span className="font-mono font-medium">{animal.chip_number}</span>
          </div>
        )}
        {animal.medal_number && (
          <div className="flex justify-between">
            <span className="text-muted">Medaille</span>
            <span className="font-medium">{animal.medal_number}</span>
          </div>
        )}
        {animal.tattoo_number && (
          <div className="flex justify-between">
            <span className="text-muted">Tatouage</span>
            <span className="font-medium">
              {animal.tattoo_number}
              {animal.tattoo_position && (
                <span className="text-muted ml-1">({animal.tattoo_position})</span>
              )}
            </span>
          </div>
        )}
        {animal.loof_number && (
          <div className="flex justify-between">
            <span className="text-muted">LOOF</span>
            <span className="font-medium">{animal.loof_number}</span>
          </div>
        )}
        {animal.passport_number && (
          <div className="flex justify-between">
            <span className="text-muted">Passeport</span>
            <span className="font-medium">{animal.passport_number}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted">I-CAD</span>
          <span className={`font-medium ${animal.icad_updated ? 'text-success' : 'text-warning'}`}>
            {animal.icad_updated ? 'A jour' : 'Non mis a jour'}
          </span>
        </div>
        {!hasAnyId && (
          <p className="text-muted text-center py-2">Aucune identification enregistree</p>
        )}
      </div>
    </div>
  )
}
