'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import type { CallCategory } from '@/lib/types/database'

interface CallFiltersProps {
  categories: CallCategory[]
}

const STATUS_OPTIONS = [
  { value: '', label: 'Tous' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'completed', label: 'Termine' },
  { value: 'failed', label: 'Echoue' },
] as const

export function CallFilters({ categories }: CallFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentStatus = searchParams.get('status') || ''
  const currentCategory = searchParams.get('category') || ''

  function updateFilters(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`/appels?${params.toString()}`)
  }

  return (
    <div className="bg-surface rounded-xl border border-border p-5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-4">Filtres</h3>

      {/* Status pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {STATUS_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => updateFilters('status', option.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              currentStatus === option.value
                ? 'gradient-primary text-white'
                : 'bg-surface border border-border hover:bg-surface-hover'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Category dropdown */}
      {categories.length > 0 && (
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 block">
            Categorie
          </label>
          <select
            value={currentCategory}
            onChange={(e) => updateFilters('category', e.target.value)}
            className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="">Toutes les categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}
