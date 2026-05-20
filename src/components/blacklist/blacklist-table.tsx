'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Ban, AlertOctagon, ShieldAlert, X, Loader2 } from 'lucide-react'
import { removeFromBlacklist, type BlacklistedClientRow } from '@/lib/actions/blacklist'
import { BLACKLIST_SOURCE_LABELS } from '@/lib/types/database'
import { formatDateShort } from '@/lib/utils'

interface Props {
  readonly rows: BlacklistedClientRow[]
  readonly isAdmin: boolean
}

export function BlacklistTable({ rows, isAdmin }: Props) {
  const [removeTarget, setRemoveTarget] = useState<BlacklistedClientRow | null>(null)

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <Ban className="w-10 h-10 text-muted/30 mx-auto mb-3" />
        <p className="text-sm text-muted">Aucun contact sur la liste noire.</p>
      </div>
    )
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-hover/50">
              <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Contact</th>
              <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Motif</th>
              <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Source</th>
              <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Inscrit le</th>
              <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Animaux liés</th>
              <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Inscrit par</th>
              <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Statut</th>
              <th className="text-right px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => {
              const displayName = row.first_name ? `${row.name} ${row.first_name}` : row.name
              const isRemoved = !!row.blacklist_removed_at
              return (
                <tr key={row.id} className="hover:bg-surface-hover/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/clients/${row.id}`} className="font-medium hover:text-primary">
                      {displayName}
                    </Link>
                    {row.email && <div className="text-xs text-muted truncate max-w-[200px]">{row.email}</div>}
                    {row.phone && <div className="text-xs text-muted">{row.phone}</div>}
                  </td>
                  <td className="px-4 py-3 text-muted max-w-md">
                    <span className="line-clamp-2 text-xs">{row.blacklist_reason || '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    {row.blacklist_source && (
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-error/10 text-error border border-error/20">
                        {BLACKLIST_SOURCE_LABELS[row.blacklist_source]}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted text-xs">
                    {row.blacklisted_at ? formatDateShort(row.blacklisted_at) : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {row.blacklisted_animals.length === 0 ? (
                      <span className="text-muted">—</span>
                    ) : (
                      <ul className="space-y-0.5">
                        {row.blacklisted_animals.slice(0, 3).map((a) => (
                          <li key={a.id}>
                            <Link href={`/animals/${a.id}`} className="hover:text-primary">
                              🐾 {a.name}
                              {a.medal_number && <span className="text-muted"> ({a.medal_number})</span>}
                            </Link>
                          </li>
                        ))}
                        {row.blacklisted_animals.length > 3 && (
                          <li className="text-muted">+{row.blacklisted_animals.length - 3} autres</li>
                        )}
                      </ul>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted text-xs">
                    {row.blacklisted_by_name || '—'}
                  </td>
                  <td className="px-4 py-3">
                    {isRemoved ? (
                      <div className="space-y-0.5">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-muted/15 text-muted">
                          Retiré le {formatDateShort(row.blacklist_removed_at!)}
                        </span>
                        {row.blacklist_removed_by_name && (
                          <div className="text-[10px] text-muted">par {row.blacklist_removed_by_name}</div>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-error/15 text-error border border-error/30">
                        <Ban className="w-3 h-3" />
                        ACTIF
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!isRemoved && isAdmin && (
                      <button
                        type="button"
                        onClick={() => setRemoveTarget(row)}
                        className="px-2 py-1 rounded text-xs font-medium bg-amber-500/15 text-amber-600 hover:bg-amber-500/25 transition-colors"
                        title="Retirer de la liste noire (admin seulement)"
                      >
                        Retirer
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {removeTarget && (
        <RemoveBlacklistModal
          target={removeTarget}
          onClose={() => setRemoveTarget(null)}
        />
      )}
    </>
  )
}

function RemoveBlacklistModal({
  target,
  onClose,
}: {
  target: BlacklistedClientRow
  onClose: () => void
}) {
  const [reason, setReason] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const displayName = target.first_name ? `${target.name} ${target.first_name}` : target.name

  const handleConfirm = () => {
    if (reason.trim().length < 10) {
      toast.error('Le motif doit faire au moins 10 caractères (audit critique).')
      return
    }
    startTransition(async () => {
      const res = await removeFromBlacklist({ client_id: target.id, reason: reason.trim() })
      if ('error' in res) {
        toast.error(res.error)
      } else {
        toast.success('Contact retiré de la liste noire')
        onClose()
        router.refresh()
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-surface border-2 border-error/30 rounded-xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <AlertOctagon className="w-5 h-5 text-error" />
            Retirer de la liste noire
          </h3>
          <button type="button" onClick={onClose} className="text-muted hover:text-text">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-error/5 border border-error/30 rounded-lg p-3 text-xs space-y-1">
            <p className="font-semibold text-error flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4" />
              Action sensible — audit critique
            </p>
            <p className="text-muted">
              Vous êtes sur le point de retirer <strong className="text-text">{displayName}</strong> de la
              liste noire SDA. Le contact pourra à nouveau apparaître dans les recherches d&apos;adoptants
              et les blocages automatiques seront désactivés pour cette personne.
            </p>
          </div>

          <div>
            <label htmlFor="remove-reason" className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
              Motif du retrait * <span className="text-muted">(min. 10 caractères, conservé en audit)</span>
            </label>
            <textarea
              id="remove-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              required
              placeholder="Exemple : Acquittement par la cour d'appel de Douai le 2026-04-15, dossier n°..."
              className="w-full px-3 py-2 bg-surface-dark border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-error/50 resize-y"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 rounded-lg text-sm text-muted border border-border hover:bg-surface-dark transition-colors disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={isPending || reason.trim().length < 10}
              onClick={handleConfirm}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirmer le retrait
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
