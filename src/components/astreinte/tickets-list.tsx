'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Search,
  X,
  Moon,
  HeartPulse,
  ArrowRight,
  Clock,
} from 'lucide-react'

interface Ticket {
  id: string
  ticket_number: string
  intervention_type: string
  status: string
  priority: string
  location_address: string
  municipality_code_insee: string | null
  declarant_email: string
  declarant_organization: string | null
  animal_species: string | null
  animal_count: number | null
  animal_injured: boolean | null
  created_at: string
  acknowledged_at: string | null
  completed_at: string | null
  is_night_intervention: boolean
}

interface Commune {
  code_insee: string
  name: string
}

interface Stats {
  total: number
  new: number
  inProgress: number
  critical: number
  completed: number
  today: number
}

interface Filters {
  status?: string
  type?: string
  priority?: string
  commune?: string
  q?: string
}

interface Props {
  tickets: Ticket[]
  communes: Commune[]
  stats: Stats
  filters: Filters
}

const TYPE_LABEL: Record<string, string> = {
  divagation: 'Divagation',
  dangerous: 'Animal dangereux',
  requisition: 'Réquisition',
  veterinary_emergency: 'Urgence véto',
}

const STATUS_LABEL: Record<string, string> = {
  new: 'Nouveau',
  acknowledged: 'Pris en charge',
  in_progress: 'En cours',
  completed: 'Clôturé',
  cancelled: 'Annulé',
}

const PRIORITY_LABEL: Record<string, string> = {
  low: 'Faible',
  normal: 'Normale',
  high: 'Élevée',
  critical: 'Critique',
}

const SPECIES_LABEL: Record<string, string> = {
  dog: 'Chien',
  cat: 'Chat',
  other: 'Autre',
  unknown: '?',
}

export function TicketsList({ tickets, communes, stats, filters }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState(filters.q ?? '')

  function updateFilter(key: keyof Filters, value: string) {
    const params = new URLSearchParams()
    Object.entries({ ...filters, [key]: value }).forEach(([k, v]) => {
      if (v) params.set(k, v as string)
    })
    router.push(`/astreinte/tickets${params.toString() ? `?${params}` : ''}`)
  }

  function clearFilters() {
    router.push('/astreinte/tickets')
    setSearch('')
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    updateFilter('q', search)
  }

  const hasActiveFilters = useMemo(
    () => Boolean(filters.status || filters.type || filters.priority || filters.commune || filters.q),
    [filters]
  )

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard label="Aujourd'hui" value={stats.today} icon={<Clock size={14} />} />
        <StatCard label="Nouveaux" value={stats.new} accent="orange" />
        <StatCard label="En cours" value={stats.inProgress} accent="blue" />
        <StatCard
          label="Urgents en attente"
          value={stats.critical}
          accent="red"
          icon={<AlertTriangle size={14} />}
        />
        <StatCard label="Clôturés" value={stats.completed} accent="green" />
        <StatCard label="Total" value={stats.total} />
      </div>

      {/* Filtres */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 p-4 bg-card rounded-lg border">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-0">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="N° ticket, adresse, email…"
            className="w-full pl-9 pr-3 py-2 border rounded-md text-sm bg-background"
          />
        </form>

        <select
          value={filters.status ?? ''}
          onChange={(e) => updateFilter('status', e.target.value)}
          className="px-3 py-2 border rounded-md text-sm bg-background"
        >
          <option value="">Tous statuts</option>
          {Object.entries(STATUS_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>

        <select
          value={filters.type ?? ''}
          onChange={(e) => updateFilter('type', e.target.value)}
          className="px-3 py-2 border rounded-md text-sm bg-background"
        >
          <option value="">Tous types</option>
          {Object.entries(TYPE_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>

        <select
          value={filters.priority ?? ''}
          onChange={(e) => updateFilter('priority', e.target.value)}
          className="px-3 py-2 border rounded-md text-sm bg-background"
        >
          <option value="">Toutes priorités</option>
          {Object.entries(PRIORITY_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>

        <select
          value={filters.commune ?? ''}
          onChange={(e) => updateFilter('commune', e.target.value)}
          className="px-3 py-2 border rounded-md text-sm bg-background min-w-[180px]"
        >
          <option value="">Toutes communes</option>
          {communes.map((c) => (
            <option key={c.code_insee} value={c.code_insee}>
              {c.name}
            </option>
          ))}
        </select>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1 px-3 py-2 text-xs text-muted hover:text-foreground"
          >
            <X size={12} />
            Effacer
          </button>
        )}
      </div>

      {/* Liste */}
      {tickets.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-lg border">
          <div className="w-12 h-12 rounded-full bg-muted/10 flex items-center justify-center mx-auto mb-4">
            <Search size={20} className="text-muted" />
          </div>
          <p className="text-sm text-muted">
            {hasActiveFilters
              ? 'Aucun ticket ne correspond aux filtres.'
              : 'Aucun ticket pour l’instant.'}
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/5 border-b">
              <tr className="text-left text-xs uppercase tracking-wider text-muted">
                <th className="px-4 py-3 font-semibold">N°</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Lieu</th>
                <th className="px-4 py-3 font-semibold">Animal</th>
                <th className="px-4 py-3 font-semibold">Déclarant</th>
                <th className="px-4 py-3 font-semibold">Statut</th>
                <th className="px-4 py-3 font-semibold">Reçu</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tickets.map((t) => (
                <TicketRow key={t.id} ticket={t} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function TicketRow({ ticket: t }: { ticket: Ticket }) {
  const isUrgent = t.priority === 'critical' || t.priority === 'high'
  const isNew = t.status === 'new'

  return (
    <tr
      className={`hover:bg-muted/5 transition ${
        isUrgent && isNew ? 'bg-red-50/40 dark:bg-red-900/10' : ''
      }`}
    >
      <td className="px-4 py-3 font-mono text-xs font-bold">
        <div className="flex items-center gap-2">
          {ticket_priority_dot(t.priority)}
          {t.ticket_number}
          {t.is_night_intervention && (
            <span title="Nuit (22h-7h)">
              <Moon size={12} className="text-purple-600" />
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          {t.intervention_type === 'veterinary_emergency' && (
            <HeartPulse size={12} className="text-red-600" />
          )}
          {t.intervention_type === 'requisition' && (
            <span className="text-purple-600 text-[10px] font-bold border border-purple-600 rounded px-1">
              JUD
            </span>
          )}
          <span className="font-medium">{TYPE_LABEL[t.intervention_type] ?? t.intervention_type}</span>
        </div>
      </td>
      <td className="px-4 py-3 max-w-[260px]">
        <div className="truncate text-foreground">{t.location_address}</div>
      </td>
      <td className="px-4 py-3">
        <span className="text-xs">
          {t.animal_count && t.animal_count > 1 ? `${t.animal_count}× ` : ''}
          {SPECIES_LABEL[t.animal_species ?? 'unknown'] ?? '?'}
          {t.animal_injured && (
            <span title="Animal blessé" className="ml-1 text-red-600 font-bold">
              ⊕
            </span>
          )}
        </span>
      </td>
      <td className="px-4 py-3 max-w-[180px]">
        <div className="text-xs truncate text-foreground">{t.declarant_email}</div>
        {t.declarant_organization && (
          <div className="text-[11px] text-muted truncate">
            {t.declarant_organization}
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <StatusPill status={t.status} />
      </td>
      <td className="px-4 py-3 text-xs text-muted whitespace-nowrap tabular-nums">
        {formatRelative(t.created_at)}
      </td>
      <td className="px-4 py-3 text-right">
        <Link
          href={`/astreinte/tickets/${t.id}`}
          className="inline-flex items-center gap-1 text-primary hover:underline text-xs font-semibold"
        >
          Voir
          <ArrowRight size={12} />
        </Link>
      </td>
    </tr>
  )
}

function ticket_priority_dot(priority: string) {
  const colors: Record<string, string> = {
    critical: 'bg-red-500',
    high: 'bg-orange-500',
    normal: 'bg-slate-300 dark:bg-slate-600',
    low: 'bg-slate-200 dark:bg-slate-700',
  }
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${colors[priority] ?? colors.normal}`}
      title={`Priorité ${PRIORITY_LABEL[priority] ?? priority}`}
    />
  )
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    new: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    acknowledged: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    cancelled: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
  }
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${
        styles[status] ?? styles.cancelled
      }`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

function StatCard({
  label,
  value,
  accent,
  icon,
}: {
  label: string
  value: number
  accent?: 'red' | 'orange' | 'blue' | 'green'
  icon?: React.ReactNode
}) {
  const accentColor: Record<string, string> = {
    red: 'text-red-600 dark:text-red-400',
    orange: 'text-orange-600 dark:text-orange-400',
    blue: 'text-blue-600 dark:text-blue-400',
    green: 'text-green-600 dark:text-green-400',
  }
  return (
    <div className="bg-card rounded-lg border p-4">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted font-semibold">
        {icon}
        {label}
      </div>
      <div className={`text-2xl font-bold mt-1 ${accent ? accentColor[accent] : ''}`}>
        {value}
      </div>
    </div>
  )
}

function formatRelative(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffMin < 1) return "à l'instant"
  if (diffMin < 60) return `il y a ${diffMin} min`
  if (diffHour < 24) return `il y a ${diffHour}h`
  if (diffDay < 7) return `il y a ${diffDay}j`
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}
