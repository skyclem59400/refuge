import Link from 'next/link'
import {
  UserPlus,
  Search,
  Mail,
  Phone,
  MapPin,
  ChevronRight,
  Heart,
  HandHeart,
  Home as HomeIcon,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { listPortalAccountsForAdmin } from '@/lib/actions/portal-accounts-admin'
import type { PortalAccountRow } from '@/lib/actions/portal-accounts-admin-types'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{
    q?: string
    linked?: string
  }>
}

export default async function ComptesPortailPage({ searchParams }: PageProps) {
  const ctx = await getEstablishmentContext()
  if (!ctx) {
    return (
      <div className="animate-fade-up p-6 max-w-2xl">
        <h1 className="text-2xl font-bold mb-2">Non authentifié</h1>
        <p className="text-sm text-muted">Veuillez vous connecter pour accéder à cette page.</p>
      </div>
    )
  }
  if (!ctx.permissions.canManageClients) {
    return (
      <div className="animate-fade-up p-6 max-w-2xl">
        <h1 className="text-2xl font-bold mb-2">Accès restreint</h1>
        <p className="text-sm text-muted">
          Vous n&apos;avez pas la permission de voir les comptes portail.
        </p>
      </div>
    )
  }

  const params = await searchParams
  const linkedOnly =
    params.linked === 'true' ? true : params.linked === 'false' ? false : undefined

  const { data: accounts } = await listPortalAccountsForAdmin({
    search: params.q ?? null,
    linkedOnly,
  })

  const total = accounts.length
  const linked = accounts.filter((a) => a.linked_client !== null).length
  const unlinked = total - linked
  const withApplication = accounts.filter(
    (a) =>
      a.counts.adoption + a.counts.volunteer + a.counts.foster > 0,
  ).length

  return (
    <div className="animate-fade-up">
      <div className="flex items-center gap-3 mb-2">
        <UserPlus className="w-7 h-7 text-primary" />
        <h1 className="text-2xl font-bold">Comptes portail</h1>
      </div>
      <p className="text-sm text-muted mb-6">
        Comptes créés par les visiteurs du site sda-nord.com — potentiels
        adoptants, parrains, signaleurs et bénévoles.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total comptes" value={total} />
        <StatCard label="Avec candidature" value={withApplication} accent />
        <StatCard label="Liés à un client" value={linked} />
        <StatCard label="Non encore liés" value={unlinked} muted />
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
              defaultValue={params.q ?? ''}
              placeholder="Nom, email, ville, téléphone..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-card text-sm"
            />
          </div>
        </div>
        <div>
          <label htmlFor="linked" className="block text-xs font-medium text-muted mb-1">Lien client</label>
          <select
            id="linked"
            name="linked"
            defaultValue={params.linked ?? ''}
            className="px-3 py-2 rounded-lg border border-border bg-card text-sm"
          >
            <option value="">Tous</option>
            <option value="true">Liés à un client Optimus</option>
            <option value="false">Non encore liés</option>
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
        {accounts.length === 0 ? (
          <div className="p-12 text-center text-muted">
            <UserPlus className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Aucun compte pour ces critères.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-muted-bg text-xs uppercase tracking-wider text-muted border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Compte</th>
                <th className="text-left px-4 py-3 font-medium">Contact</th>
                <th className="text-left px-4 py-3 font-medium">Localisation</th>
                <th className="text-left px-4 py-3 font-medium">Candidatures</th>
                <th className="text-left px-4 py-3 font-medium">Marketing</th>
                <th className="text-left px-4 py-3 font-medium">Créé le</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <AccountRow key={a.user_id} row={a} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function AccountRow({ row }: { row: PortalAccountRow }) {
  const fullName =
    [row.first_name, row.last_name].filter(Boolean).join(' ').trim() ||
    '— sans nom —'
  return (
    <tr className="border-b border-border hover:bg-muted-bg/50 transition-colors">
      <td className="px-4 py-3">
        <div className="text-sm font-medium">{fullName}</div>
        {row.linked_client ? (
          <Link
            href={`/clients/${row.linked_client.id}`}
            className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline"
          >
            Fiche client : {row.linked_client.name}
          </Link>
        ) : (
          <span className="text-xs text-stone-500 italic">
            Pas encore lié à un client
          </span>
        )}
      </td>
      <td className="px-4 py-3 space-y-1">
        {row.email && (
          <a
            href={`mailto:${row.email}`}
            className="flex items-center gap-1.5 text-xs text-primary hover:underline truncate max-w-[220px]"
          >
            <Mail className="w-3 h-3 shrink-0" />
            {row.email}
          </a>
        )}
        {row.phone && (
          <a
            href={`tel:${row.phone}`}
            className="flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <Phone className="w-3 h-3 shrink-0" />
            {row.phone}
          </a>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-muted">
        {row.city ? (
          <span className="flex items-center gap-1.5">
            <MapPin className="w-3 h-3 shrink-0" />
            {[row.postal_code, row.city].filter(Boolean).join(' ')}
          </span>
        ) : (
          '—'
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          {row.counts.adoption > 0 && (
            <CountBadge icon={<Heart className="w-3 h-3" />} count={row.counts.adoption} label="adoption" />
          )}
          {row.counts.volunteer > 0 && (
            <CountBadge icon={<HandHeart className="w-3 h-3" />} count={row.counts.volunteer} label="bénévole" />
          )}
          {row.counts.foster > 0 && (
            <CountBadge icon={<HomeIcon className="w-3 h-3" />} count={row.counts.foster} label="FA" />
          )}
          {row.counts.adoption + row.counts.volunteer + row.counts.foster === 0 && (
            <span className="text-xs text-stone-400 italic">aucune</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        {row.consent_marketing ? (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" /> Opt-in
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-stone-500">
            <XCircle className="w-3.5 h-3.5" /> Non
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">
        {new Date(row.created_at).toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })}
      </td>
      <td className="px-4 py-3">
        {row.linked_client ? (
          <Link
            href={`/clients/${row.linked_client.id}`}
            className="inline-flex items-center text-primary hover:opacity-70"
            aria-label="Voir la fiche client"
          >
            <ChevronRight className="w-4 h-4" />
          </Link>
        ) : (
          <span className="text-stone-300 dark:text-stone-600">
            <ChevronRight className="w-4 h-4" />
          </span>
        )}
      </td>
    </tr>
  )
}

function CountBadge({
  icon,
  count,
  label,
}: {
  icon: React.ReactNode
  count: number
  label: string
}) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[11px] font-medium"
      title={`${count} candidature${count > 1 ? 's' : ''} ${label}`}
    >
      {icon}
      {count}
    </span>
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
