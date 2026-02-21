import Link from 'next/link'
import { Shield, AlertTriangle, CheckCircle, Clock, Send, XCircle } from 'lucide-react'
import { getAllDeclarations, getIcadStats } from '@/lib/actions/icad'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { getIcadDeclarationTypeLabel, getIcadStatusLabel, getIcadStatusColor } from '@/lib/sda-utils'
import { formatDateShort } from '@/lib/utils'
import type { IcadDeclaration, IcadDeclarationStatus } from '@/lib/types/database'
import { IcadActionButtons } from '@/components/icad/icad-action-buttons'

interface DeclarationWithAnimal extends IcadDeclaration {
  animals: {
    id: string
    name: string
    species: string
    chip_number: string | null
    establishment_id: string
  }
}

export default async function IcadPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const params = await searchParams
  const ctx = await getEstablishmentContext()
  const canManage = ctx!.permissions.canManageMovements

  const filters: { status?: IcadDeclarationStatus } = {}
  if (params.status && params.status !== '') {
    filters.status = params.status as IcadDeclarationStatus
  }

  const [declarationsResult, statsResult] = await Promise.all([
    getAllDeclarations(filters),
    getIcadStats(),
  ])

  const declarations = (declarationsResult.data as DeclarationWithAnimal[]) || []
  const stats = statsResult.data || { pending: 0, submitted: 0, confirmed: 0, errors: 0, total: 0 }

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">I-CAD</h1>
            <p className="text-sm text-muted mt-1">
              Suivi des declarations I-CAD
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
        <div className="bg-surface rounded-xl border border-border p-4 text-center">
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-xs text-muted mt-1">Total</p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4 text-center">
          <Clock className="w-4 h-4 text-warning mx-auto mb-1" />
          <p className="text-2xl font-bold text-warning">{stats.pending}</p>
          <p className="text-xs text-muted mt-1">En attente</p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4 text-center">
          <Send className="w-4 h-4 text-info mx-auto mb-1" />
          <p className="text-2xl font-bold text-info">{stats.submitted}</p>
          <p className="text-xs text-muted mt-1">Soumises</p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4 text-center">
          <CheckCircle className="w-4 h-4 text-success mx-auto mb-1" />
          <p className="text-2xl font-bold text-success">{stats.confirmed}</p>
          <p className="text-xs text-muted mt-1">Confirmees</p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4 text-center">
          <XCircle className="w-4 h-4 text-error mx-auto mb-1" />
          <p className="text-2xl font-bold text-error">{stats.errors}</p>
          <p className="text-xs text-muted mt-1">Erreurs</p>
        </div>
      </div>

      {/* Pending alert */}
      {stats.pending > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4 mb-6">
          <AlertTriangle className="w-5 h-5 text-warning mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-sm">
              {stats.pending} declaration{stats.pending > 1 ? 's' : ''} en attente
            </p>
            <p className="text-sm text-muted mt-1">
              Pensez a declarer les mouvements sur le site I-CAD et a mettre a jour le statut ici.
            </p>
          </div>
        </div>
      )}

      {/* Filter */}
      <form className="mb-6">
        <select
          name="status"
          defaultValue={params.status || ''}
          onChange={(e) => {
            const form = e.target.form
            if (form) form.submit()
          }}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="">Tous les statuts</option>
          <option value="pending">En attente</option>
          <option value="submitted">Soumises</option>
          <option value="confirmed">Confirmees</option>
          <option value="rejected">Rejetees</option>
          <option value="error">Erreurs</option>
          <option value="not_required">Non requises</option>
        </select>
      </form>

      {/* List */}
      {declarations.length === 0 ? (
        <div className="bg-surface rounded-xl border border-border p-8 text-center">
          <Shield className="w-10 h-10 text-muted mx-auto mb-3" />
          <p className="text-muted text-sm">Aucune declaration I-CAD</p>
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 font-semibold text-muted">Animal</th>
                  <th className="px-4 py-3 font-semibold text-muted">Puce</th>
                  <th className="px-4 py-3 font-semibold text-muted">Type</th>
                  <th className="px-4 py-3 font-semibold text-muted">Statut</th>
                  <th className="px-4 py-3 font-semibold text-muted">Ref I-CAD</th>
                  <th className="px-4 py-3 font-semibold text-muted">Date</th>
                  {canManage && <th className="px-4 py-3 font-semibold text-muted text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {declarations.map((decl) => (
                  <tr key={decl.id} className="hover:bg-surface-hover transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/animals/${decl.animals.id}`}
                        className="font-medium hover:text-primary transition-colors"
                      >
                        {decl.animals.species === 'cat' ? '\uD83D\uDC31' : '\uD83D\uDC36'}{' '}
                        {decl.animals.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted font-mono text-xs">
                      {decl.animals.chip_number || <span className="text-error">Non puce</span>}
                    </td>
                    <td className="px-4 py-3">
                      {getIcadDeclarationTypeLabel(decl.declaration_type)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getIcadStatusColor(decl.status)}`}>
                        {getIcadStatusLabel(decl.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted font-mono text-xs">
                      {decl.icad_reference || <span className="text-muted/50">&mdash;</span>}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {formatDateShort(decl.created_at)}
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        <IcadActionButtons
                          declarationId={decl.id}
                          currentStatus={decl.status}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
