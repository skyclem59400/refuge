'use client'

import { useRouter, useSearchParams } from 'next/navigation'

const PERIODS = [
  { value: 'today', label: "Aujourd'hui" },
  { value: '7d', label: '7 jours' },
  { value: '30d', label: '30 jours' },
  { value: 'all', label: 'Tout' },
] as const

export function PeriodFilter() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const current = searchParams.get('period') || '7d'

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('period', value)
    router.push(`/appels?${params.toString()}`)
  }

  return (
    <div className="flex gap-1">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          onClick={() => handleChange(p.value)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            current === p.value
              ? 'gradient-primary text-white'
              : 'bg-surface border border-border hover:bg-surface-hover'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}
