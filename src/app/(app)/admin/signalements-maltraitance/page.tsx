import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AlertTriangle, ChevronRight, Search, UserCheck, UserX } from 'lucide-react'
import { getEstablishmentContext } from '@/lib/establishment/context'
import {
  listAbuseReports,
  getAbuseReportStats,
} from '@/lib/actions/abuse-reports'
import {
  SEVERITY_LABELS,
  STATUS_LABELS,
  ANIMAL_TYPE_LABELS,
} from '@/lib/actions/abuse-reports-constants'
import type {
  AbuseSeverity,
  AbuseReportStatus,
} from '@/lib/types/database'

export const dynamic = 'force-dynamic'

const SEVERITY_BADGE: Record<AbuseSeverity, string> = {
  urgent: 'bg-red-600 text-white animate-pulse',
  serious: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  recurring: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300',
  suspicion: 'bg-slate-500/15 text-slate-500',
}

const STATUS_BADGE: Record<AbuseReportStatus, string> = {
  new: 'bg-blue-500/15 text-blue-600',
  investigating: 'bg-amber-500/15 text-amber-700',
  transmitted_authorities: 'bg-purple-500/15 text-purple-700',
  on_site_intervention: 'bg-indigo-500/15 text-indigo-700',
  resolved: 'bg-emerald-500/15 text-emerald-700',
  unfounded: 'bg-slate-500/15 text-slate-500',
  archived: 'bg-slate-500/10 text-slate-400',
}

interface PageProps {
  searchParams: Promise<{
    status?: AbuseReportStatus
    severity?: AbuseSeverity
    q?: string
    has_account?: string
  }>
}

export default async function SignalementsMaltraitancePage({ searchParams }: PageProps) {
  const ctx = await getEstablishmentContext()
  if (!ctx) redirect('/login')
  if (!ctx.permissions.canManageAbuseReports) {
    return (
      <div className="animate-fade-up p-6 max-w-2xl">
        <h1 className="text-2xl font-bold mb-2">Accès restreint</h1>
        <p className="text-sm text-muted">
          Vous n&apos;avez pas la permission de gérer les signalements de maltraitance.
        </p>
      </div>
    )
  }

  const params = await searchParams
  const hasAccount =
    params.has_account === 'true'
      ? true
      : params.has_account === 'false'
        ? false
        : null
  const filters = {
    status: params.status || null,
    severity: params.severity || null,
    search: params.q || null,
    hasAccount,
  }

  const [{ data: reports }, stats] = await Promise.all([
    listAbuseReports(filters),
    getAbuseReportStats(),
  ])

  return (
    <div className="animate-fade-up">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-lg bg-red-500/10">
          <AlertTriangle className="w-6 h-6 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold">Signalements maltraitance</h1>
      </div>
      <p className="text-sm text-muted mb-6">
        Signalements reçus via le formulaire public — photos, localisation et démarches à coordonner.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Urgents à traiter" value={stats.urgent} variant="urgent" />
        <StatCard label="En cours" value={stats.byStatus.investigating + stats.byStatus.transmitted_authorities + stats.byStatus.on_site_intervention} />
        <StatCard label="Résolus" value={stats.byStatus.resolved} variant="muted" />
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
              placeholder="Email, nom, ville, description..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-card text-sm"
            />
          </div>
        </div>
        <div>
          <label htmlFor="severity" className="block text-xs font-medium text-muted mb-1">Gravité</label>
          <select
            id="severity"
            name="severity"
            defaultValue={filters.severity || ''}
            className="px-3 py-2 rounded-lg border border-border bg-card text-sm"
          >
            <option value="">Toutes</option>
            {(Object.entries(SEVERITY_LABELS) as [AbuseSeverity, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="status" className="block text-xs font-medium text-muted mb-1">Statut</label>
          <select
            id="status"
            name="status"
            defaultValue={filters.status || ''}
            className="px-3 py-2 rounded-lg border border-border bg-card text-sm"
          >
            <option value="">Tous</option>
            {(Object.entries(STATUS_LABELS) as [AbuseReportStatus, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="has_account" className="block text-xs font-medium text-muted mb-1">
            Compte portail
          </label>
          <select
            id="has_account"
            name="has_account"
            defaultValue={params.has_account || ''}
            className="px-3 py-2 rounded-lg border border-border bg-card text-sm"
          >
            <option value="">Tous</option>
            <option value="true">Avec compte</option>
            <option value="false">Sans compte</option>
          </select>
        </div>
        <button
          type="submit"
          className="px-4 py-2 rounded-lg gradient-primary text-white text-sm font-semibold hover:opacity-90"
        >
          Filtrer
        </button>
      </form>

      {/* Liste */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {reports.length === 0 ? (
          <div className="p-12 text-center text-muted">
            <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Aucun signalement pour ces critères.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-muted-bg text-xs uppercase tracking-wider text-muted border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Ticket</th>
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Gravité</th>
                <th className="text-left px-4 py-3 font-medium">Localisation</th>
                <th className="text-left px-4 py-3 font-medium">Animal</th>
                <th className="text-left px-4 py-3 font-medium">Signalant</th>
                <th className="text-left px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => {
                const reporterName = r.reporter_is_anonymous
                  ? 'Anonyme'
                  : [r.reporter_first_name, r.reporter_last_name].filter(Boolean).join(' ') || r.reporter_email
                return (
                  <tr key={r.id} className="border-b border-border hover:bg-muted-bg/50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-mono text-xs font-bold">{r.ticket_number}</div>
                      <div className="mt-1">
                        {r.user_id ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                            <UserCheck className="w-3 h-3" /> Compte
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-500/15 text-slate-600 dark:text-slate-300">
                            <UserX className="w-3 h-3" /> Direct
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${SEVERITY_BADGE[r.severity]}`}>
                        {SEVERITY_LABELS[r.severity]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium">{r.location_city}</div>
                      <div className="text-xs text-muted">{r.location_postal_code}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div>{ANIMAL_TYPE_LABELS[r.animal_type]}</div>
                      <div className="text-xs text-muted">
                        {r.animal_count_estimate} {r.animal_count_estimate > 1 ? 'animaux' : 'animal'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium">{reporterName}</div>
                      <div className="text-xs text-muted">{r.reporter_email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[r.status]}`}>
                        {STATUS_LABELS[r.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/signalements-maltraitance/${r.id}`}
                        className="inline-flex items-center text-primary hover:opacity-70"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  variant,
}: {
  label: string
  value: number
  variant?: 'urgent' | 'muted'
}) {
  return (
    <div
      className={`p-4 rounded-xl border ${
        variant === 'urgent'
          ? 'border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-700'
          : variant === 'muted'
          ? 'border-border bg-muted-bg/50'
          : 'border-border bg-card'
      }`}
    >
      <div className="text-xs text-muted uppercase tracking-wider font-medium">{label}</div>
      <div
        className={`text-2xl font-bold mt-1 ${
          variant === 'urgent' ? 'text-red-700 dark:text-red-400' : ''
        }`}
      >
        {value}
      </div>
    </div>
  )
}
