import Link from 'next/link'
import {
  HeartHandshake,
  Search,
  Users,
  TrendingUp,
  Wallet,
  ChevronRight,
  CircleDollarSign,
} from 'lucide-react'
import { getEstablishmentContext } from '@/lib/establishment/context'
import {
  listSponsorshipsForAdmin,
  getSponsorshipsStats,
} from '@/lib/actions/sponsorships-admin'
import type { SponsorshipWithBoth } from '@/lib/actions/sponsorships-admin-types'
import {
  SPONSORSHIP_KIND_LABELS,
  SPONSORSHIP_STATUS_LABELS,
} from '@/lib/types/database'
import type {
  SponsorshipStatus,
  SponsorshipKind,
} from '@/lib/types/database'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{
    status?: SponsorshipStatus
    kind?: SponsorshipKind
    q?: string
    include_ended?: string
  }>
}

function formatAmount(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return Number(n).toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  })
}

function formatDate(s: string | null): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const STATUS_CLASSES: Record<SponsorshipStatus, string> = {
  active: 'bg-emerald-500/15 text-emerald-700',
  pending: 'bg-amber-500/15 text-amber-700',
  ended: 'bg-slate-500/15 text-slate-500',
}

export default async function ParrainagesAdminPage({ searchParams }: PageProps) {
  const ctx = await getEstablishmentContext()
  if (!ctx) {
    return (
      <div className="animate-fade-up p-6 max-w-2xl">
        <h1 className="text-2xl font-bold mb-2">Non authentifié</h1>
        <p className="text-sm text-muted">Veuillez vous connecter pour accéder à cette page.</p>
      </div>
    )
  }
  if (!ctx.permissions.canManageDonations) {
    return (
      <div className="animate-fade-up p-6 max-w-2xl">
        <h1 className="text-2xl font-bold mb-2">Accès restreint</h1>
        <p className="text-sm text-muted">
          Vous n&apos;avez pas la permission de gérer les parrainages.
        </p>
      </div>
    )
  }

  const params = await searchParams
  const includeEnded = params.include_ended === 'true'
  const filters = {
    status: params.status || null,
    kind: params.kind || null,
    search: params.q || null,
    includeEnded,
  }

  const [{ data: sponsorships }, stats] = await Promise.all([
    listSponsorshipsForAdmin(filters),
    getSponsorshipsStats(),
  ])

  return (
    <div className="animate-fade-up">
      <div className="flex items-center gap-3 mb-2">
        <HeartHandshake className="w-7 h-7 text-primary" />
        <h1 className="text-2xl font-bold">Parrainages</h1>
      </div>
      <p className="text-sm text-muted mb-6">
        Pilotage financier des parrainages d&apos;animaux : revenu mensuel récurrent,
        nombre de parrains actifs, historique des versements.
      </p>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KpiCard
          icon={<Users className="w-4 h-4" />}
          label="Parrains actifs"
          value={String(stats.distinctActiveSponsors)}
          hint={`${stats.activeCount} parrainage${stats.activeCount > 1 ? 's' : ''}`}
        />
        <KpiCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Revenu mensuel"
          value={formatAmount(stats.mrr)}
          hint="Récurrent (MRR)"
          accent
        />
        <KpiCard
          icon={<Wallet className="w-4 h-4" />}
          label="Encaissé cette année"
          value={formatAmount(stats.ytdRevenue)}
          hint={`${stats.totalPayments} versement${stats.totalPayments > 1 ? 's' : ''} lifetime`}
        />
        <KpiCard
          icon={<CircleDollarSign className="w-4 h-4" />}
          label="Moyenne / parrain"
          value={formatAmount(stats.avgMonthlyPerSponsor)}
          hint="par mois"
          muted
        />
      </div>

      {/* Filters */}
      <form className="flex flex-wrap gap-3 mb-6 items-end" method="GET">
        <div className="flex-1 min-w-[200px]">
          <label htmlFor="q" className="block text-xs font-medium text-muted mb-1">Recherche</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              id="q"
              name="q"
              defaultValue={filters.search || ''}
              placeholder="Nom du parrain, animal, email, ville..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-card text-sm"
            />
          </div>
        </div>
        <div>
          <label htmlFor="status" className="block text-xs font-medium text-muted mb-1">Statut</label>
          <select
            id="status"
            name="status"
            defaultValue={filters.status || ''}
            className="px-3 py-2 rounded-lg border border-border bg-card text-sm"
          >
            <option value="">Actifs et en attente</option>
            {(Object.entries(SPONSORSHIP_STATUS_LABELS) as [SponsorshipStatus, string][]).map(
              ([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ),
            )}
          </select>
        </div>
        <div>
          <label htmlFor="kind" className="block text-xs font-medium text-muted mb-1">Type</label>
          <select
            id="kind"
            name="kind"
            defaultValue={filters.kind || ''}
            className="px-3 py-2 rounded-lg border border-border bg-card text-sm"
          >
            <option value="">Tous</option>
            {(Object.entries(SPONSORSHIP_KIND_LABELS) as [SponsorshipKind, string][]).map(
              ([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ),
            )}
          </select>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-muted px-3 py-2">
          <input
            type="checkbox"
            name="include_ended"
            value="true"
            defaultChecked={includeEnded}
            className="size-4 rounded border-border"
          />
          Inclure terminés
        </label>
        <button
          type="submit"
          className="px-4 py-2 rounded-lg gradient-primary text-white text-sm font-semibold hover:opacity-90"
        >
          Filtrer
        </button>
      </form>

      {/* Liste */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {sponsorships.length === 0 ? (
          <div className="p-12 text-center text-muted">
            <HeartHandshake className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Aucun parrainage pour ces critères.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-muted-bg text-xs uppercase tracking-wider text-muted border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Parrain</th>
                <th className="text-left px-4 py-3 font-medium">Animal</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-right px-4 py-3 font-medium">Mensuel</th>
                <th className="text-right px-4 py-3 font-medium">Total versé</th>
                <th className="text-left px-4 py-3 font-medium">Depuis</th>
                <th className="text-left px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {sponsorships.map((s) => (
                <SponsorshipRow key={s.id} row={s} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function SponsorshipRow({ row }: { row: SponsorshipWithBoth }) {
  const status = row.status as SponsorshipStatus
  const clientName = row.client
    ? row.client.kind === 'person'
      ? `${row.client.first_name ?? ''} ${row.client.name ?? ''}`.trim()
      : row.client.name
    : '—'
  const animalLabel = row.animal?.name ?? '—'
  return (
    <tr className="border-b border-border hover:bg-muted-bg/50 transition-colors">
      <td className="px-4 py-3">
        <div className="text-sm font-medium">{clientName || '—'}</div>
        {row.client?.email && (
          <div className="text-xs text-muted truncate max-w-[220px]">
            {row.client.email}
          </div>
        )}
        {row.client?.city && (
          <div className="text-xs text-muted">{row.client.city}</div>
        )}
      </td>
      <td className="px-4 py-3">
        <Link
          href={row.animal_id ? `/animals/${row.animal_id}` : '#'}
          className="text-sm font-medium text-primary hover:underline"
        >
          {animalLabel}
        </Link>
        {row.animal?.species && (
          <div className="text-xs text-muted">
            {row.animal.species === 'dog'
              ? 'Chien'
              : row.animal.species === 'cat'
                ? 'Chat'
                : row.animal.species}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-muted">
        {SPONSORSHIP_KIND_LABELS[row.kind] ?? row.kind}
      </td>
      <td className="px-4 py-3 text-right text-sm font-medium">
        {row.monthly_amount !== null
          ? formatAmount(row.monthly_amount)
          : '—'}
      </td>
      <td className="px-4 py-3 text-right text-sm">
        <span className="font-medium">{formatAmount(row.total_donated ?? 0)}</span>
      </td>
      <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">
        {formatDate(row.started_at)}
      </td>
      <td className="px-4 py-3">
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_CLASSES[status] ?? ''}`}
        >
          {SPONSORSHIP_STATUS_LABELS[status] ?? status}
        </span>
      </td>
      <td className="px-4 py-3">
        {row.client_id && (
          <Link
            href={`/clients/${row.client_id}`}
            className="inline-flex items-center text-primary hover:opacity-70"
            aria-label="Fiche parrain"
          >
            <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      </td>
    </tr>
  )
}

function KpiCard({
  icon,
  label,
  value,
  hint,
  accent,
  muted,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
  accent?: boolean
  muted?: boolean
}) {
  return (
    <div
      className={`p-4 rounded-xl border ${
        accent
          ? 'border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700'
          : muted
            ? 'border-border bg-muted-bg/50'
            : 'border-border bg-card'
      }`}
    >
      <div className="text-xs text-muted uppercase tracking-wider font-medium flex items-center gap-1.5">
        {icon}
        {label}
      </div>
      <div className={`text-2xl font-bold mt-1 ${accent ? 'text-amber-700 dark:text-amber-400' : ''}`}>
        {value}
      </div>
      {hint && <div className="text-xs text-muted mt-1">{hint}</div>}
    </div>
  )
}
