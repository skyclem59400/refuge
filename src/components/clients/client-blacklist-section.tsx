'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Ban, ShieldAlert, AlertOctagon, X, Loader2 } from 'lucide-react'
import { removeFromBlacklist } from '@/lib/actions/blacklist'
import { BLACKLIST_SOURCE_LABELS, type Client } from '@/lib/types/database'
import { formatDateShort } from '@/lib/utils'

interface Props {
  readonly client: Client
  readonly linkedAnimals: Array<{ id: string; name: string; medal_number: string | null }>
  readonly isAdmin: boolean
}

export function ClientBlacklistSection({ client, linkedAnimals, isAdmin }: Props) {
  const [showRemove, setShowRemove] = useState(false)
  const isRemoved = !!client.blacklist_removed_at

  return (
    <div className="bg-surface rounded-xl border-2 border-error/30 overflow-hidden">
      <div className="p-5 border-b border-error/30 bg-error/5 flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Ban className="w-5 h-5 text-error" />
          Liste noire SDA
        </h3>
        {!isRemoved && isAdmin && (
          <button
            type="button"
            onClick={() => setShowRemove(true)}
            className="px-3 py-1.5 rounded text-xs font-medium bg-amber-500/15 text-amber-600 hover:bg-amber-500/25 transition-colors"
          >
            Retirer de la liste noire
          </button>
        )}
      </div>

      <div className="p-5 space-y-4 text-sm">
        {isRemoved ? (
          <div className="rounded-lg border border-muted/30 bg-muted/5 p-3">
            <p className="font-semibold text-text">Retiré de la liste noire</p>
            <p className="text-xs text-muted mt-1">
              Retiré le {formatDateShort(client.blacklist_removed_at!)}
            </p>
            {client.blacklist_removal_reason && (
              <p className="text-xs text-muted mt-2 whitespace-pre-wrap">
                <strong>Motif :</strong> {client.blacklist_removal_reason}
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-error/30 bg-error/5 p-3 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-error shrink-0 mt-0.5" />
            <div className="text-xs text-error">
              Inscription active — bloque automatiquement les tentatives d&apos;adoption.
            </div>
          </div>
        )}

        <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {client.blacklist_source && (
            <div>
              <dt className="text-muted uppercase tracking-wider font-semibold">Source</dt>
              <dd className="mt-0.5 font-medium">{BLACKLIST_SOURCE_LABELS[client.blacklist_source]}</dd>
            </div>
          )}
          {client.blacklisted_at && (
            <div>
              <dt className="text-muted uppercase tracking-wider font-semibold">Inscrit le</dt>
              <dd className="mt-0.5 font-medium">{formatDateShort(client.blacklisted_at)}</dd>
            </div>
          )}
        </dl>

        {client.blacklist_reason && (
          <div>
            <p className="text-xs uppercase tracking-wider text-muted font-semibold mb-1">Motif</p>
            <p className="whitespace-pre-wrap text-xs bg-surface-dark rounded-lg p-3 border border-border">
              {client.blacklist_reason}
            </p>
          </div>
        )}

        {linkedAnimals.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-wider text-muted font-semibold mb-1">
              Animaux liés ({linkedAnimals.length})
            </p>
            <ul className="space-y-1 text-xs">
              {linkedAnimals.map((a) => (
                <li key={a.id}>
                  <Link href={`/animals/${a.id}`} className="hover:text-primary">
                    🐾 {a.name}
                    {a.medal_number && <span className="text-muted"> · médaille {a.medal_number}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {showRemove && (
        <RemoveModal
          client={client}
          onClose={() => setShowRemove(false)}
        />
      )}
    </div>
  )
}

function RemoveModal({ client, onClose }: { client: Client; onClose: () => void }) {
  const [reason, setReason] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const displayName = client.first_name ? `${client.name} ${client.first_name}` : client.name

  const handleConfirm = () => {
    if (reason.trim().length < 10) {
      toast.error('Le motif doit faire au moins 10 caractères')
      return
    }
    startTransition(async () => {
      const res = await removeFromBlacklist({ client_id: client.id, reason: reason.trim() })
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
          <p className="text-sm text-muted">
            Retrait de <strong className="text-text">{displayName}</strong>. Action critique tracée
            en audit.
          </p>
          <div>
            <label htmlFor="cl-remove-reason" className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
              Motif du retrait * (min. 10 caractères)
            </label>
            <textarea
              id="cl-remove-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              required
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
              Confirmer
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
