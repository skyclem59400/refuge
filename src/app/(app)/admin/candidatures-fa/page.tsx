import Link from 'next/link'
import { ChevronRight, Home, Search, UserCheck, UserX } from 'lucide-react'
import { getEstablishmentContext } from '@/lib/establishment/context'
import {
  listFosterApplications,
  getFosterApplicationStats,
} from '@/lib/actions/foster-applications'
import {
  FOSTER_STATUS_LABELS,
  FOSTER_STATUS_CLASSES,
  FOSTER_TYPE_LABELS,
  HOUSING_TYPE_LABELS,
} from '@/lib/actions/foster-applications-constants'
import type {
  FosterApplication,
  FosterApplicationStatus,
} from '@/lib/types/database'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{
    status?: FosterApplicationStatus
    q?: string
    has_account?: string
  }>
}

export default async function CandidaturesFAPage({ searchParams }: PageProps) {
  const ctx = await getEstablishmentContext()
  if (!ctx) {
    return (
      <div className="animate-fade-up p-6 max-w-2xl">
        <h1 className="text-2xl font-bold mb-2">Non authentifié</h1>
        <p className="text-sm text-muted">Veuillez vous connecter pour accéder à cette page.</p>
      </div>
    )
  }
  if (!ctx.permissions.canManageFosterApplications) {
    return (
      <div className="animate-fade-up p-6 max-w-2xl">
        <h1 className="text-2xl font-bold mb-2">Accès restreint</h1>
        <p className="text-sm text-muted">
          Vous n&apos;avez pas la permission de gérer les candidatures famille d&apos;accueil.
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
    search: params.q || null,
    hasAccount,
  }

  const [{ data: applications }, stats] = await Promise.all([
    listFosterApplications(filters),
    getFosterApplicationStats(),
  ])

  return (
    <div className="animate-fade-up">
      <div className="flex items-center gap-3 mb-2">
        <Home className="w-7 h-7 text-primary" />
        <h1 className="text-2xl font-bold">Candidatures Famille d&apos;Accueil</h1>
      </div>
      <p className="text-sm text-muted mb-6">
        Candidatures déposées via l&apos;espace authentifié du site sda-nord.com.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Nouvelles" value={stats.pending} accent />
        <StatCard label="Qualifiées" value={stats.qualified} />
        <StatCard label="FA actives" value={stats.accepted} muted />
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
              placeholder="Nom, email, ville, téléphone, ticket..."
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
            <option value="">Tous</option>
            {(Object.entries(FOSTER_STATUS_LABELS) as [FosterApplicationStatus, string][]).map(
              ([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ),
            )}
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
        {applications.length === 0 ? (
          <div className="p-12 text-center text-muted">
            <Home className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Aucune candidature pour ces critères.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-muted-bg text-xs uppercase tracking-wider text-muted border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Ticket</th>
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Candidat</th>
                <th className="text-left px-4 py-3 font-medium">Logement</th>
                <th className="text-left px-4 py-3 font-medium">Type d&apos;accueil</th>
                <th className="text-left px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app.id} className="border-b border-border hover:bg-muted-bg/50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="font-mono text-xs font-bold">{app.ticket_number}</div>
                    <div className="mt-1">
                      {app.user_id ? (
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
                    {new Date(app.created_at).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium">
                      {app.first_name} {app.last_name}
                    </div>
                    <div className="text-xs text-muted truncate max-w-[220px]">{app.email}</div>
                    {app.city && (
                      <div className="text-xs text-muted">{[app.postal_code, app.city].filter(Boolean).join(' ')}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted max-w-[200px]">
                    {summarizeHousing(app)}
                  </td>
                  <td className="px-4 py-3">
                    <FosterTypeBadges types={app.can_foster_types} />
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold ${FOSTER_STATUS_CLASSES[app.status]}`}
                    >
                      {FOSTER_STATUS_LABELS[app.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/candidatures-fa/${app.id}`}
                      className="inline-flex items-center text-primary hover:opacity-70"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function FosterTypeBadges({
  types,
}: {
  types: FosterApplication['can_foster_types']
}) {
  if (!types || types.length === 0) {
    return <span className="text-xs text-muted italic">—</span>
  }
  const visible = types.slice(0, 3)
  const extra = types.length - visible.length
  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((t) => (
        <span
          key={t}
          className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[11px] font-medium whitespace-nowrap"
        >
          {FOSTER_TYPE_LABELS[t] ?? t}
        </span>
      ))}
      {extra > 0 && (
        <span className="px-2 py-0.5 rounded-md bg-muted-bg text-muted text-[11px] font-medium">
          +{extra}
        </span>
      )}
    </div>
  )
}

function summarizeHousing(app: FosterApplication): string {
  const housing = app.housing_type ? HOUSING_TYPE_LABELS[app.housing_type] : '—'
  const extras: string[] = []
  if (app.has_garden) extras.push('jardin')
  if (app.has_separate_room) extras.push('pièce dédiée')
  const foyer = app.household_size > 1 ? `${app.household_size} pers.` : '1 pers.'
  const extra = extras.length > 0 ? ` · ${extras.join(', ')}` : ''
  return `${housing} · ${foyer}${extra}`
}

function StatCard({
  label,
  value,
  accent,
  muted,
}: {
  label: string
  value: number
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
      <div className="text-xs text-muted uppercase tracking-wider font-medium">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${accent ? 'text-amber-700 dark:text-amber-400' : ''}`}>
        {value}
      </div>
    </div>
  )
}
