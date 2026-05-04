'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { Search, Filter, MapPin, CheckCircle2, Clock, Circle } from 'lucide-react'

interface Epci {
  code_siren: string
  short_name: string
  full_name: string
  member_count: number | null
  department: string
}

interface Commune {
  code_insee: string
  name: string
  postal_codes: string[]
  epci_code_siren: string | null
  department: string
  population: number | null
  convention_status: 'active' | 'pending' | 'none' | 'terminated'
  convention_yearly_fee: number | null
  updated_at: string
}

interface Props {
  epcis: Epci[]
  communes: Commune[]
  currentFilters: { epci?: string; status?: string; q?: string }
  stats: { total: number; active: number; pending: number; none: number }
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Convention active',
  pending: 'En cours',
  none: 'Hors convention',
  terminated: 'Résiliée',
}

const STATUS_BADGES: Record<string, string> = {
  active: 'bg-green-100 text-green-800 border-green-200',
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  none: 'bg-slate-100 text-slate-700 border-slate-200',
  terminated: 'bg-red-100 text-red-800 border-red-200',
}

export function CommunesList({ epcis, communes, currentFilters, stats }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    startTransition(() => {
      router.push(`?${params.toString()}`)
    })
  }

  return (
    <div>
      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Total communes"
          value={stats.total}
          icon={<MapPin size={16} />}
          tone="slate"
          onClick={() => updateFilter('status', '')}
          active={!currentFilters.status}
        />
        <StatCard
          label="Convention active"
          value={stats.active}
          icon={<CheckCircle2 size={16} />}
          tone="green"
          onClick={() => updateFilter('status', 'active')}
          active={currentFilters.status === 'active'}
        />
        <StatCard
          label="En cours"
          value={stats.pending}
          icon={<Clock size={16} />}
          tone="amber"
          onClick={() => updateFilter('status', 'pending')}
          active={currentFilters.status === 'pending'}
        />
        <StatCard
          label="Hors convention"
          value={stats.none}
          icon={<Circle size={16} />}
          tone="slate"
          onClick={() => updateFilter('status', 'none')}
          active={currentFilters.status === 'none'}
        />
      </div>

      {/* Filtres */}
      <div className="bg-card border rounded-lg p-4 mb-6 flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="search"
            defaultValue={currentFilters.q ?? ''}
            placeholder="Nom, code INSEE, code postal…"
            onChange={(e) => updateFilter('q', e.target.value)}
            className="w-full pl-10 pr-3 py-2 border rounded-md text-sm bg-background"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-muted" />
          <select
            value={currentFilters.epci ?? ''}
            onChange={(e) => updateFilter('epci', e.target.value)}
            className="px-3 py-2 border rounded-md text-sm bg-background min-w-[200px]"
          >
            <option value="">Toutes les EPCI</option>
            {epcis.map((e) => (
              <option key={e.code_siren} value={e.code_siren}>
                {e.short_name} — {e.full_name} ({e.member_count})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Commune</th>
                <th className="px-4 py-3 text-left font-semibold">EPCI · Dept</th>
                <th className="px-4 py-3 text-right font-semibold">Population</th>
                <th className="px-4 py-3 text-left font-semibold">Convention</th>
                <th className="px-4 py-3 text-right font-semibold">Cotisation</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className={isPending ? 'opacity-50 transition-opacity' : ''}>
              {communes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted">
                    Aucune commune ne correspond aux critères.
                  </td>
                </tr>
              ) : (
                communes.map((c) => {
                  const epci = epcis.find((e) => e.code_siren === c.epci_code_siren)
                  return (
                    <tr key={c.code_insee} className="border-t hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                      <td className="px-4 py-3">
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-muted">
                          {c.code_insee} · {c.postal_codes.join(', ')}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div>{epci?.short_name ?? '—'}</div>
                        <div className="text-xs text-muted">Dept {c.department}</div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {c.population?.toLocaleString('fr-FR') ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                            STATUS_BADGES[c.convention_status]
                          }`}
                        >
                          {STATUS_LABELS[c.convention_status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-sm">
                        {c.convention_yearly_fee != null
                          ? `${c.convention_yearly_fee.toLocaleString('fr-FR')} €`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/astreinte/communes/${c.code_insee}`}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          Modifier →
                        </Link>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
  tone,
  onClick,
  active,
}: {
  label: string
  value: number
  icon: React.ReactNode
  tone: 'slate' | 'green' | 'amber'
  onClick: () => void
  active: boolean
}) {
  const tones: Record<string, string> = {
    slate: 'text-slate-600 dark:text-slate-400',
    green: 'text-green-600',
    amber: 'text-amber-600',
  }
  return (
    <button
      onClick={onClick}
      className={`text-left p-4 rounded-lg border bg-card hover:shadow-sm transition ${
        active ? 'ring-2 ring-primary border-primary' : ''
      }`}
    >
      <div className={`flex items-center gap-2 text-xs uppercase tracking-wider ${tones[tone]}`}>
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-2xl font-bold mt-2 tabular-nums">{value}</div>
    </button>
  )
}
