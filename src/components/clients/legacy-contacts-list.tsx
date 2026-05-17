'use client'

import { useEffect, useState, useRef, useTransition } from 'react'
import { Loader2, Search, ArrowRight, CheckCircle2, Archive } from 'lucide-react'
import { searchLegacyContacts, type LegacyContact } from '@/lib/actions/legacy-contacts'
import { LegacyContactConvertModal } from './legacy-contact-convert-modal'

const PAGE_SIZE = 50

export function LegacyContactsList({ canEdit }: { canEdit: boolean }) {
  const [query, setQuery] = useState('')
  const [city, setCity] = useState('')
  const [showConverted, setShowConverted] = useState(false)
  const [page, setPage] = useState(0)
  const [data, setData] = useState<LegacyContact[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [_, startTransition] = useTransition()
  const [selected, setSelected] = useState<LegacyContact | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced fetch
  useEffect(() => {
    setLoading(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const res = await searchLegacyContacts({
          query,
          city,
          showConverted,
          page,
          pageSize: PAGE_SIZE,
        })
        if ('error' in res && res.error) {
          setData([])
          setTotal(0)
        } else if ('data' in res && res.data) {
          setData(res.data)
          setTotal(res.total ?? 0)
        }
        setLoading(false)
      })
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, city, showConverted, page])

  // Reset page when filters change
  useEffect(() => {
    setPage(0)
  }, [query, city, showConverted])

  const maxPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1)

  return (
    <div>
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 mb-4 flex items-start gap-2 text-xs">
        <Archive className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <strong className="text-amber-300">Archive Hunimalis — lecture seule</strong>
          <div className="text-muted mt-0.5">
            28 306 contacts importés depuis l'ancien logiciel. Pour ajouter un contact à votre répertoire actif,
            cliquez sur <strong className="text-text">Convertir</strong>.
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nom, téléphone..."
            className="w-full pl-9 pr-3 py-2.5 bg-surface-dark border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <input
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Ville"
          className="px-3 py-2.5 bg-surface-dark border border-border rounded-lg text-sm w-full sm:w-48 focus:border-primary focus:ring-1 focus:ring-primary"
        />
        <label className="flex items-center gap-2 px-3 py-2.5 bg-surface-dark border border-border rounded-lg text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={showConverted}
            onChange={(e) => setShowConverted(e.target.checked)}
          />
          <span className="text-muted">Inclure déjà convertis</span>
        </label>
      </div>

      {/* Stats */}
      <div className="text-xs text-muted mb-3">
        {loading ? (
          <span className="inline-flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" /> Recherche...
          </span>
        ) : (
          <>
            {total.toLocaleString('fr-FR')} résultat{total > 1 ? 's' : ''}
            {total > 0 && (
              <span className="ml-2">
                · Page {page + 1}/{maxPage + 1}
              </span>
            )}
          </>
        )}
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-dark border-b border-border">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-muted text-xs uppercase tracking-wider">Nom</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted text-xs uppercase tracking-wider">Adresse</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted text-xs uppercase tracking-wider hidden md:table-cell">CP</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted text-xs uppercase tracking-wider">Ville</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted text-xs uppercase tracking-wider hidden lg:table-cell">Téléphone</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted text-xs uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted">
                    Aucun contact trouvé dans l'archive.
                  </td>
                </tr>
              )}
              {data.map((c) => {
                const isConverted = !!c.converted_to_client_id
                return (
                  <tr
                    key={c.id}
                    className={`border-b border-border last:border-0 ${isConverted ? 'opacity-60' : 'hover:bg-surface-dark/50'}`}
                  >
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{c.full_name}</div>
                      {isConverted && (
                        <div className="text-[10px] text-success flex items-center gap-1 mt-0.5">
                          <CheckCircle2 className="w-3 h-3" />
                          Converti
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted truncate max-w-xs">{c.address ?? '—'}</td>
                    <td className="px-4 py-2.5 text-muted hidden md:table-cell font-mono text-xs">{c.postal_code ?? '—'}</td>
                    <td className="px-4 py-2.5 text-muted">{c.city ?? '—'}</td>
                    <td className="px-4 py-2.5 text-muted hidden lg:table-cell font-mono text-xs">
                      {c.phone_normalized ?? c.phone ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {canEdit && !isConverted && (
                        <button
                          onClick={() => setSelected(c)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                        >
                          Convertir
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 rounded-md text-sm bg-surface-dark border border-border disabled:opacity-50 hover:bg-surface"
          >
            ← Précédent
          </button>
          <div className="text-xs text-muted">
            Page {page + 1} / {maxPage + 1}
          </div>
          <button
            onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
            disabled={page >= maxPage}
            className="px-3 py-1.5 rounded-md text-sm bg-surface-dark border border-border disabled:opacity-50 hover:bg-surface"
          >
            Suivant →
          </button>
        </div>
      )}

      {/* Modal */}
      {selected && (
        <LegacyContactConvertModal
          contact={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
