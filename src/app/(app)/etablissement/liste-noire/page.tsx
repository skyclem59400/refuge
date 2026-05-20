import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { getBlacklistedClients } from '@/lib/actions/blacklist'
import { BlacklistTable } from '@/components/blacklist/blacklist-table'
import { BlacklistAddButton } from '@/components/blacklist/blacklist-add-button'
import { Ban, ShieldAlert } from 'lucide-react'
import type { BlacklistSource } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ source?: string; period?: string; show_removed?: string }>
}

export default async function BlacklistPage({ searchParams }: PageProps) {
  const ctx = await getEstablishmentContext()
  if (!ctx || !ctx.permissions.canManageEstablishment) {
    redirect('/dashboard')
  }
  const sp = await searchParams

  const source = (['judicial_procedure', 'manual', 'incident'] as const).includes(sp.source as BlacklistSource)
    ? (sp.source as BlacklistSource)
    : undefined

  const includeRemoved = sp.show_removed === '1'

  const res = await getBlacklistedClients({ source, includeRemoved })
  const rows = 'data' in res ? res.data : []
  const error = 'error' in res ? res.error : null

  const isAdmin = ctx.permissions.isAdmin

  return (
    <div className="animate-fade-up space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Ban className="w-6 h-6 text-error" />
            Liste noire SDA
          </h1>
          <p className="text-sm text-muted mt-1 max-w-2xl">
            Registre des propriétaires d&apos;animaux mis en cause dans des procédures judiciaires
            (réquisition / saisie pour maltraitance) ou ayant fait l&apos;objet d&apos;un incident
            grave. Ces contacts sont automatiquement bloqués lors des tentatives d&apos;adoption.
          </p>
        </div>
        <BlacklistAddButton />
      </div>

      <div className="rounded-xl border-2 border-error/30 bg-error/5 p-4 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-error shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-error">Données sensibles — accès restreint</p>
          <p className="text-muted text-xs mt-1">
            Toute action sur cette liste est tracée (création, modification, retrait).
            Le retrait d&apos;un contact de la liste noire est réservé aux administrateurs et
            nécessite une justification écrite (audit critique).
          </p>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2 items-center text-sm">
        <span className="text-muted">Filtrer par source :</span>
        <FilterLink current={source} value={undefined} label="Toutes" />
        <FilterLink current={source} value="judicial_procedure" label="Procédure judiciaire" />
        <FilterLink current={source} value="manual" label="Manuel" />
        <FilterLink current={source} value="incident" label="Incident" />
        <span className="ml-4">
          <Link
            href={includeRemoved ? '?' : '?show_removed=1'}
            className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
              includeRemoved
                ? 'bg-amber-500/15 text-amber-600 border-amber-500/30'
                : 'border-border text-muted hover:bg-surface-dark'
            }`}
          >
            {includeRemoved ? 'Masquer retirés' : 'Inclure retirés'}
          </Link>
        </span>
      </div>

      {error ? (
        <div className="rounded-lg border border-error/30 bg-error/10 p-4 text-sm text-error">
          {error}
        </div>
      ) : (
        <BlacklistTable rows={rows} isAdmin={isAdmin} />
      )}
    </div>
  )
}

function FilterLink({
  current,
  value,
  label,
}: {
  current: BlacklistSource | undefined
  value: BlacklistSource | undefined
  label: string
}) {
  const isActive = current === value
  const href = value ? `?source=${value}` : '?'
  return (
    <Link
      href={href}
      className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
        isActive
          ? 'bg-primary text-white border-primary'
          : 'border-border text-muted hover:bg-surface-dark'
      }`}
    >
      {label}
    </Link>
  )
}
