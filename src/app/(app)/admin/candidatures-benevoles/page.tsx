import Link from 'next/link'
import { ChevronRight, HandHeart, Search } from 'lucide-react'
import { getEstablishmentContext } from '@/lib/establishment/context'
import {
  listVolunteerApplications,
  getVolunteerApplicationStats,
  VOLUNTEER_STATUS_LABELS,
  VOLUNTEER_STATUS_CLASSES,
  VOLUNTEER_SKILL_LABELS,
  VOLUNTEER_DAY_LABELS,
  VOLUNTEER_SLOT_LABELS,
  VOLUNTEER_FREQUENCY_LABELS,
} from '@/lib/actions/volunteer-applications'
import type {
  VolunteerApplication,
  VolunteerApplicationStatus,
} from '@/lib/types/database'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ status?: VolunteerApplicationStatus; q?: string }>
}

export default async function CandidaturesBenevolesPage({ searchParams }: PageProps) {
  const ctx = await getEstablishmentContext()
  if (!ctx) {
    return (
      <div className="animate-fade-up p-6 max-w-2xl">
        <h1 className="text-2xl font-bold mb-2">Non authentifié</h1>
        <p className="text-sm text-muted">Veuillez vous connecter pour accéder à cette page.</p>
      </div>
    )
  }
  if (!ctx.permissions.canManageVolunteerApplications) {
    return (
      <div className="animate-fade-up p-6 max-w-2xl">
        <h1 className="text-2xl font-bold mb-2">Accès restreint</h1>
        <p className="text-sm text-muted">
          Vous n&apos;avez pas la permission de gérer les candidatures bénévoles.
        </p>
      </div>
    )
  }

  const params = await searchParams
  const filters = {
    status: params.status || null,
    search: params.q || null,
  }

  const [{ data: applications }, stats] = await Promise.all([
    listVolunteerApplications(filters),
    getVolunteerApplicationStats(),
  ])

  return (
    <div className="animate-fade-up">
      <div className="flex items-center gap-3 mb-2">
        <HandHeart className="w-7 h-7 text-primary" />
        <h1 className="text-2xl font-bold">Candidatures bénévoles</h1>
      </div>
      <p className="text-sm text-muted mb-6">
        Candidatures déposées via le formulaire bénévolat du site sda-nord.com.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Nouvelles" value={stats.pending} accent />
        <StatCard label="Qualifiées" value={stats.qualified} />
        <StatCard label="Bénévoles actifs" value={stats.accepted} muted />
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
              placeholder="Nom, email, ville, téléphone..."
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
            {(Object.entries(VOLUNTEER_STATUS_LABELS) as [VolunteerApplicationStatus, string][]).map(
              ([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              )
            )}
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
            <HandHeart className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Aucune candidature pour ces critères.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-muted-bg text-xs uppercase tracking-wider text-muted border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Candidat</th>
                <th className="text-left px-4 py-3 font-medium">Compétences</th>
                <th className="text-left px-4 py-3 font-medium">Disponibilités</th>
                <th className="text-left px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app.id} className="border-b border-border hover:bg-muted-bg/50 transition-colors">
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
                  <td className="px-4 py-3">
                    <SkillsBadges skills={app.skills} />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted max-w-[260px]">
                    {summarizeAvailability(app)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold ${VOLUNTEER_STATUS_CLASSES[app.status]}`}
                    >
                      {VOLUNTEER_STATUS_LABELS[app.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/candidatures-benevoles/${app.id}`}
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

function SkillsBadges({ skills }: { skills: VolunteerApplication['skills'] }) {
  if (!skills || skills.length === 0) {
    return <span className="text-xs text-muted italic">—</span>
  }
  const visible = skills.slice(0, 3)
  const extra = skills.length - visible.length
  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((s) => (
        <span
          key={s}
          className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[11px] font-medium whitespace-nowrap"
        >
          {VOLUNTEER_SKILL_LABELS[s] ?? s}
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

function summarizeAvailability(app: VolunteerApplication): string {
  const avail = app.availability
  if (!avail) return '—'

  const days = (avail.days || []).map((d) => VOLUNTEER_DAY_LABELS[d] ?? d)
  const slots = (avail.slots || []).map((s) => VOLUNTEER_SLOT_LABELS[s] ?? s)
  const freq = avail.frequency ? VOLUNTEER_FREQUENCY_LABELS[avail.frequency] : null

  const parts: string[] = []
  if (days.length > 0) parts.push(days.join('-'))
  if (slots.length > 0) parts.push(slots.join('/').toLowerCase())
  const main = parts.join(' ')
  return [main, freq?.toLowerCase()].filter(Boolean).join(', ') || '—'
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
