import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { listInquiries, getInquiryStats, type ChatIntent, type ChatStatus } from '@/lib/actions/chat-inquiries'
import { MessageSquare, ChevronRight, Heart, Home, HandHeart, AlertTriangle, Info, Search } from 'lucide-react'

export const dynamic = 'force-dynamic'

const INTENT_META: Record<ChatIntent, { label: string; Icon: typeof Heart; color: string }> = {
  adoption_general: { label: 'Adoption (générale)', Icon: Heart, color: 'text-rose-500' },
  adoption_specific: { label: 'Adoption ciblée', Icon: Heart, color: 'text-pink-600' },
  famille_accueil: { label: "Famille d'accueil", Icon: Home, color: 'text-amber-600' },
  benevolat: { label: 'Bénévolat', Icon: HandHeart, color: 'text-emerald-600' },
  signalement: { label: 'Signalement', Icon: AlertTriangle, color: 'text-red-600' },
  info: { label: 'Information', Icon: Info, color: 'text-slate-500' },
}

const STATUS_META: Record<ChatStatus, { label: string; className: string }> = {
  active: { label: 'En cours', className: 'bg-blue-500/15 text-blue-600' },
  qualified: { label: 'Qualifié', className: 'bg-amber-500/15 text-amber-700' },
  abandoned: { label: 'Abandonné', className: 'bg-slate-500/15 text-slate-500' },
  resolved: { label: 'Résolu', className: 'bg-emerald-500/15 text-emerald-700' },
}

interface PageProps {
  searchParams: Promise<{ intent?: ChatIntent; status?: ChatStatus; q?: string }>
}

export default async function ContactsEntrantsPage({ searchParams }: PageProps) {
  const ctx = await getEstablishmentContext()
  if (!ctx) redirect('/login')
  if (!ctx.permissions.isOwner) {
    return (
      <div className="animate-fade-up p-6 max-w-2xl">
        <h1 className="text-2xl font-bold mb-2">Accès restreint</h1>
        <p className="text-sm text-muted">
          Cette section est réservée à l&apos;administrateur principal de l&apos;établissement.
        </p>
      </div>
    )
  }

  const params = await searchParams
  const filters = {
    intent: params.intent || null,
    status: params.status || null,
    search: params.q || null,
  }

  const [{ data: inquiries }, stats] = await Promise.all([
    listInquiries(filters),
    getInquiryStats(),
  ])

  return (
    <div className="animate-fade-up">
      <div className="flex items-center gap-3 mb-2">
        <MessageSquare className="w-7 h-7 text-primary" />
        <h1 className="text-2xl font-bold">Contacts entrants</h1>
      </div>
      <p className="text-sm text-muted mb-6">
        Conversations qualifiées via l&apos;assistant IA du site sda-nord.com.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Qualifiés à traiter" value={stats.qualified} accent />
        <StatCard label="En cours" value={stats.pending} />
        <StatCard label="Résolus" value={stats.resolved} muted />
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
              placeholder="Email, nom, résumé..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-card text-sm"
            />
          </div>
        </div>
        <div>
          <label htmlFor="intent" className="block text-xs font-medium text-muted mb-1">Type</label>
          <select id="intent" name="intent" defaultValue={filters.intent || ''} className="px-3 py-2 rounded-lg border border-border bg-card text-sm">
            <option value="">Tous</option>
            {(Object.entries(INTENT_META) as [ChatIntent, typeof INTENT_META[ChatIntent]][]).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="status" className="block text-xs font-medium text-muted mb-1">Statut</label>
          <select id="status" name="status" defaultValue={filters.status || ''} className="px-3 py-2 rounded-lg border border-border bg-card text-sm">
            <option value="">Tous</option>
            {(Object.entries(STATUS_META) as [ChatStatus, typeof STATUS_META[ChatStatus]][]).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="px-4 py-2 rounded-lg gradient-primary text-white text-sm font-semibold hover:opacity-90">
          Filtrer
        </button>
      </form>

      {/* Liste */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {inquiries.length === 0 ? (
          <div className="p-12 text-center text-muted">
            <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Aucun contact entrant pour ces critères.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-muted-bg text-xs uppercase tracking-wider text-muted border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-left px-4 py-3 font-medium">Contact</th>
                <th className="text-left px-4 py-3 font-medium">Animal cible</th>
                <th className="text-left px-4 py-3 font-medium">Résumé</th>
                <th className="text-left px-4 py-3 font-medium">Statut</th>
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {inquiries.map((inq) => {
                const meta = INTENT_META[inq.intent]
                const Icon = meta.Icon
                const statusMeta = STATUS_META[inq.status]
                const fullName = [inq.contact_first_name, inq.contact_last_name].filter(Boolean).join(' ') || '—'
                return (
                  <tr key={inq.id} className="border-b border-border hover:bg-muted-bg/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${meta.color}`} />
                        <span className="text-sm">{meta.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium">{fullName}</div>
                      <div className="text-xs text-muted">
                        {inq.contact_email || inq.contact_phone || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {inq.animal_name ? (
                        <span className="font-medium">{inq.animal_name}</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted max-w-md truncate">
                      {inq.summary || <span className="italic">Pas encore qualifié</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusMeta.className}`}>
                        {statusMeta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">
                      {new Date(inq.last_activity_at).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/contacts-entrants/${inq.id}`}
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

function StatCard({ label, value, accent, muted }: { label: string; value: number; accent?: boolean; muted?: boolean }) {
  return (
    <div className={`p-4 rounded-xl border ${
      accent ? 'border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700' :
      muted ? 'border-border bg-muted-bg/50' :
      'border-border bg-card'
    }`}>
      <div className="text-xs text-muted uppercase tracking-wider font-medium">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${accent ? 'text-amber-700 dark:text-amber-400' : ''}`}>{value}</div>
    </div>
  )
}
