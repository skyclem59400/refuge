'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  Filter,
  ChevronRight,
  Sparkles,
  FileText,
  Send,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import {
  type ConventionContract,
  type ConventionStatus,
  STATUS_LABELS,
  STATUS_CLASSES,
  formatCents,
} from '@/lib/actions/conventions-types'
import { markConventionAsSent, markConventionAsSigned, clearNewlyAddedFlag } from '@/lib/actions/conventions'

type ScopeFilter = 'all' | 'epci' | 'CAC' | 'CA2C' | 'Sud-Artois' | 'indep'

const EPCI_LABELS: Record<string, string> = {
  '200068500': 'CAC',
  '200030633': 'CA2C',
  '200035442': 'Sud-Artois',
}

export function ConventionsListClient({ initialList }: { initialList: ConventionContract[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [actingId, setActingId] = useState<string | null>(null)

  const [scope, setScope] = useState<ScopeFilter>('all')
  const [status, setStatus] = useState<ConventionStatus | 'all'>('all')
  const [newlyOnly, setNewlyOnly] = useState(false)
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    let result = initialList
    if (newlyOnly) result = result.filter((c) => c.newly_added)
    if (status !== 'all') result = result.filter((c) => c.status === status)
    if (scope === 'epci') result = result.filter((c) => c.epci_code_siren !== null)
    else if (scope === 'indep') result = result.filter((c) => c.municipality_code_insee !== null)
    else if (scope !== 'all') result = result.filter((c) => EPCI_LABELS[c.epci_code_siren || ''] === scope)
    if (q.trim()) {
      const needle = q.toLowerCase().trim()
      result = result.filter(
        (c) =>
          c.scope_name.toLowerCase().includes(needle) ||
          c.signatory_name.toLowerCase().includes(needle) ||
          c.contract_number.toLowerCase().includes(needle),
      )
    }
    return result
  }, [initialList, scope, status, newlyOnly, q])

  function handleMarkSent(id: string) {
    if (!confirm('Marquer cette convention comme envoyée ?')) return
    setActingId(id)
    startTransition(async () => {
      const res = await markConventionAsSent(id)
      setActingId(null)
      if (res.error) alert(res.error)
      else router.refresh()
    })
  }

  function handleMarkSigned(id: string) {
    const today = new Date().toISOString().slice(0, 10)
    const date = prompt('Date de signature (YYYY-MM-DD) :', today)
    if (!date) return
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      alert('Format date invalide. Utilise YYYY-MM-DD.')
      return
    }
    const method = confirm('Signature électronique (OK) ou papier (Annuler) ?') ? 'electronic' : 'paper'
    setActingId(id)
    startTransition(async () => {
      const res = await markConventionAsSigned({ id, signedDate: date, method })
      setActingId(null)
      if (res.error) alert(res.error)
      else router.refresh()
    })
  }

  function handleClearNewly(id: string) {
    setActingId(id)
    startTransition(async () => {
      await clearNewlyAddedFlag(id)
      setActingId(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end p-4 rounded-xl border border-border bg-surface">
        <div className="flex-1 min-w-[200px]">
          <label htmlFor="conv-q" className="block text-xs font-medium text-muted mb-1">Rechercher</label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              id="conv-q"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nom, signataire, n° de contrat…"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface-dark border border-border text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>

        <div>
          <label htmlFor="conv-scope" className="block text-xs font-medium text-muted mb-1">Périmètre</label>
          <select
            id="conv-scope"
            value={scope}
            onChange={(e) => setScope(e.target.value as ScopeFilter)}
            className="px-3 py-2 rounded-lg bg-surface-dark border border-border text-sm text-text"
          >
            <option value="all">Tous</option>
            <option value="epci">Tous EPCI</option>
            <option value="CAC">CAC uniquement</option>
            <option value="CA2C">CA2C uniquement</option>
            <option value="Sud-Artois">Sud-Artois uniquement</option>
            <option value="indep">Communes indépendantes</option>
          </select>
        </div>

        <div>
          <label htmlFor="conv-status" className="block text-xs font-medium text-muted mb-1">Statut</label>
          <select
            id="conv-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as ConventionStatus | 'all')}
            className="px-3 py-2 rounded-lg bg-surface-dark border border-border text-sm text-text"
          >
            <option value="all">Tous</option>
            {(Object.keys(STATUS_LABELS) as ConventionStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>

        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-dark border border-border text-sm text-text cursor-pointer">
          <input
            type="checkbox"
            checked={newlyOnly}
            onChange={(e) => setNewlyOnly(e.target.checked)}
            className="rounded"
          />
          <Sparkles className="w-3.5 h-3.5 text-warning" />
          Nouveaux uniquement
        </label>

        <div className="text-xs text-muted ml-auto">
          <Filter className="w-3.5 h-3.5 inline mr-1" />
          {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
        </div>
      </div>

      {/* Newly added highlight */}
      {!newlyOnly && filtered.some((c) => c.newly_added) && (
        <div className="rounded-xl border-2 border-warning/30 bg-warning/5 p-4">
          <div className="flex items-center gap-2 text-warning text-sm font-semibold mb-2">
            <Sparkles className="w-4 h-4" />
            Nouveaux contrats à envoyer
          </div>
          <p className="text-xs text-muted">
            Ces conventions viennent d&apos;être ajoutées au logiciel et sont prêtes à être envoyées aux mairies. Une fois envoyées, clique sur l&apos;étoile pour les sortir de la mise en avant.
          </p>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-dark text-muted text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3 font-medium">N°</th>
                <th className="text-left px-4 py-3 font-medium">Périmètre</th>
                <th className="text-left px-4 py-3 font-medium">Signataire</th>
                <th className="text-right px-4 py-3 font-medium">Population</th>
                <th className="text-right px-4 py-3 font-medium">Cotisation / an</th>
                <th className="text-left px-4 py-3 font-medium">Statut</th>
                <th className="text-left px-4 py-3 font-medium">Signé le</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted text-sm">
                    Aucune convention ne correspond à ces filtres.
                  </td>
                </tr>
              )}
              {filtered.map((c) => {
                const scopeBadge = c.epci_code_siren ? EPCI_LABELS[c.epci_code_siren] || 'EPCI' : 'Indep.'
                const isActing = actingId === c.id
                return (
                  <tr
                    key={c.id}
                    className={`border-t border-border hover:bg-surface-hover transition-colors ${
                      c.newly_added ? 'bg-warning/5' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-muted">{c.contract_number}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {c.newly_added && (
                          <button
                            type="button"
                            onClick={() => handleClearNewly(c.id)}
                            disabled={isActing}
                            className="text-warning hover:text-warning/70"
                            title="Sortir de la mise en avant"
                          >
                            <Sparkles className="w-3.5 h-3.5 fill-current" />
                          </button>
                        )}
                        <div>
                          <div className="font-medium text-text">{c.scope_name}</div>
                          <div className="text-xs text-muted">{scopeBadge}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text">{c.signatory_name || <span className="text-muted">—</span>}</td>
                    <td className="px-4 py-3 text-right text-text font-mono">
                      {c.population_reference.toLocaleString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-right text-text font-semibold font-mono">
                      {formatCents(Number(c.yearly_fee_cents))}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLASSES[c.status]}`}>
                        {STATUS_LABELS[c.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {c.signed_date
                        ? new Date(c.signed_date).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        {c.pdf_local_path && (
                          <a
                            href={`/api/conventions/${c.id}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-surface-dark hover:bg-surface-hover text-muted hover:text-text transition-colors"
                            title="Voir le PDF"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {c.status === 'ready' && (
                          <button
                            type="button"
                            onClick={() => handleMarkSent(c.id)}
                            disabled={isActing}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 transition-colors disabled:opacity-50"
                            title="Marquer comme envoyé"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {c.status !== 'signed' && c.status !== 'cancelled' && (
                          <button
                            type="button"
                            onClick={() => handleMarkSigned(c.id)}
                            disabled={isActing}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-success/10 hover:bg-success/20 text-success transition-colors disabled:opacity-50"
                            title="Marquer comme signé"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <Link
                          href={`/admin/conventions/${c.id}`}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-accent/10 hover:bg-accent/20 text-accent transition-colors"
                          title="Détail"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isPending && <p className="text-xs text-muted text-center">En cours...</p>}
    </div>
  )
}
