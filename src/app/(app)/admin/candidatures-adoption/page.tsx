import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getEstablishmentContext } from '@/lib/establishment/context'
import {
  listAdoptionApplications,
  getAdoptionApplicationStats,
} from '@/lib/actions/adoption-applications'
import type { AdoptionInquiryStatus } from '@/lib/types/database'
import {
  ClipboardCheck,
  ChevronRight,
  Search,
  Home,
  AlertTriangle,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

const STATUS_META: Record<AdoptionInquiryStatus, { label: string; className: string }> = {
  pending: { label: 'À traiter', className: 'bg-amber-500/15 text-amber-700' },
  qualified: { label: 'Qualifiée', className: 'bg-blue-500/15 text-blue-600' },
  interview_scheduled: { label: 'Entretien planifié', className: 'bg-indigo-500/15 text-indigo-600' },
  accepted: { label: 'Acceptée', className: 'bg-emerald-500/15 text-emerald-700' },
  declined: { label: 'Refusée', className: 'bg-red-500/15 text-red-700' },
  archived: { label: 'Archivée', className: 'bg-slate-500/15 text-slate-500' },
}

interface PageProps {
  searchParams: Promise<{ status?: AdoptionInquiryStatus; q?: string }>
}

export default async function CandidaturesAdoptionPage({ searchParams }: PageProps) {
  const ctx = await getEstablishmentContext()
  if (!ctx) redirect('/login')

  if (!ctx.permissions.canManageAdoptionApplications) {
    return (
      <div className="animate-fade-up p-6 max-w-2xl">
        <h1 className="text-2xl font-bold mb-2">Accès restreint</h1>
        <p className="text-sm text-muted">
          Cette section est réservée aux membres habilités à gérer les candidatures d&apos;adoption.
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
    listAdoptionApplications(filters),
    getAdoptionApplicationStats(),
  ])

  return (
    <div className="animate-fade-up">
      <div className="flex items-center gap-3 mb-2">
        <ClipboardCheck className="w-7 h-7 text-primary" />
        <h1 className="text-2xl font-bold">Candidatures d&apos;adoption</h1>
      </div>
      <p className="text-sm text-muted mb-6">
        Pré-candidatures soumises via le formulaire public du site sda-nord.com. À qualifier avant prise de contact.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="À traiter" value={stats.pending} accent />
        <StatCard label="Qualifiées" value={stats.qualified} />
        <StatCard label="Acceptées" value={stats.accepted} muted />
      </div>

      {/* Filters */}
      <form className="flex flex-wrap gap-3 mb-6 items-end" method="GET">
        <div className="flex-1 min-w-[220px]">
          <label htmlFor="q" className="block text-xs font-medium text-muted mb-1">
            Recherche
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              id="q"
              name="q"
              defaultValue={filters.search || ''}
              placeholder="Nom, prénom, email, ville…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-card text-sm"
            />
          </div>
        </div>
        <div>
          <label htmlFor="status" className="block text-xs font-medium text-muted mb-1">
            Statut
          </label>
          <select
            id="status"
            name="status"
            defaultValue={filters.status || ''}
            className="px-3 py-2 rounded-lg border border-border bg-card text-sm"
          >
            <option value="">Tous</option>
            {(Object.entries(STATUS_META) as [AdoptionInquiryStatus, typeof STATUS_META[AdoptionInquiryStatus]][]).map(
              ([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
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
            <ClipboardCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Aucune candidature pour ces critères.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-muted-bg text-xs uppercase tracking-wider text-muted border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Candidat</th>
                <th className="text-left px-4 py-3 font-medium">Logement</th>
                <th className="text-left px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => {
                const statusMeta = STATUS_META[app.status]
                const fullName = `${app.first_name} ${app.last_name}`.trim() || '—'
                const housingType = readQuestionnaireString(app.questionnaire, ['housing_type', 'logement_type'])
                const hasGarden = readQuestionnaireBool(app.questionnaire, ['garden', 'jardin', 'has_garden'])
                return (
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
                      <div className="text-sm font-medium flex items-center gap-2">
                        {fullName}
                        {app.possible_blacklist_match && (
                          <span title="Correspondance liste noire potentielle">
                            <AlertTriangle className="w-4 h-4 text-red-600" />
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted">
                        {app.email}
                        {app.city && <span className="ml-1">· {app.city}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Home className="w-4 h-4 text-muted" />
                        <span className="capitalize">{housingType ? formatHousing(housingType) : '—'}</span>
                      </div>
                      <div className="text-xs text-muted mt-0.5">
                        {hasGarden === null ? '' : hasGarden ? 'Avec jardin' : 'Sans jardin'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusMeta.className}`}>
                        {statusMeta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/candidatures-adoption/${app.id}`}
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

function readQuestionnaireString(q: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = q?.[k]
    if (typeof v === 'string' && v.trim()) return v
  }
  return null
}

function readQuestionnaireBool(q: Record<string, unknown>, keys: string[]): boolean | null {
  for (const k of keys) {
    const v = q?.[k]
    if (typeof v === 'boolean') return v
    if (typeof v === 'string') {
      if (['true', 'oui', 'yes'].includes(v.toLowerCase())) return true
      if (['false', 'non', 'no'].includes(v.toLowerCase())) return false
    }
  }
  return null
}

function formatHousing(value: string): string {
  const map: Record<string, string> = {
    house: 'Maison',
    maison: 'Maison',
    apartment: 'Appartement',
    appartement: 'Appartement',
    studio: 'Studio',
    farm: 'Ferme',
    ferme: 'Ferme',
    other: 'Autre',
    autre: 'Autre',
  }
  return map[value.toLowerCase()] ?? value
}
