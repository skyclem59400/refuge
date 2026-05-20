'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Ban, AlertOctagon, X, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { BLACKLIST_MATCH_LABELS, type BlacklistMatch } from '@/lib/types/database'

interface Props {
  readonly matches: BlacklistMatch[]
  readonly onClose: () => void
  readonly onConfirmOverride: (reason: string) => void
}

/**
 * Modal de blocage : s'ouvre quand on tente une adoption / contrat avec un
 * adoptant qui matche la liste noire. Affiche la liste des matches et exige
 * une raison écrite + permissions admin pour forcer.
 */
export function BlacklistOverrideModal({ matches, onClose, onConfirmOverride }: Props) {
  const [reason, setReason] = useState('')

  const handleConfirm = () => {
    if (reason.trim().length < 10) {
      toast.error('Le motif d\'override doit faire au moins 10 caractères (audit critique).')
      return
    }
    onConfirmOverride(reason.trim())
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-surface border-2 border-error rounded-xl w-full max-w-xl my-8 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-border bg-error/10">
          <h3 className="font-bold text-base flex items-center gap-2 text-error">
            <AlertOctagon className="w-5 h-5" />
            Adoptant inscrit sur la liste noire SDA
          </h3>
          <button type="button" onClick={onClose} className="text-muted hover:text-text">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-lg border-2 border-error/40 bg-error/10 p-4">
            <p className="font-semibold text-error text-sm flex items-center gap-2">
              <Ban className="w-4 h-4" />
              Adoption bloquée — vérification liste noire
            </p>
            <p className="text-xs text-muted mt-2">
              Cet adoptant correspond à un ou plusieurs contacts inscrits sur la liste noire SDA
              (procédure judiciaire, incident...).
            </p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider font-semibold text-muted mb-2">
              Correspondances détectées
            </p>
            <ul className="space-y-2">
              {matches.map((m, idx) => (
                <li key={`${m.client_id}-${idx}`} className="rounded-lg border border-error/30 bg-error/5 p-3 text-xs">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Link
                      href={`/clients/${m.client_id}`}
                      target="_blank"
                      className="font-semibold text-text hover:text-primary"
                    >
                      {m.client_first_name ? `${m.client_name} ${m.client_first_name}` : m.client_name}
                    </Link>
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-error/15 text-error border border-error/30">
                      {BLACKLIST_MATCH_LABELS[m.match_strength]}
                    </span>
                  </div>
                  {m.blacklist_reason && (
                    <p className="text-muted mt-1.5 line-clamp-3">{m.blacklist_reason}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-700 dark:text-amber-400">
              <p className="font-semibold">Forcer l&apos;adoption ?</p>
              <p className="mt-1">
                L&apos;override est réservé aux administrateurs et tracé en audit critique.
                Renseignez un motif détaillé ci-dessous.
              </p>
            </div>
          </div>

          <div>
            <label htmlFor="override-reason" className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
              Motif d&apos;override * <span className="text-muted">(min. 10 caractères)</span>
            </label>
            <textarea
              id="override-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 bg-surface-dark border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-error/50 resize-y"
              placeholder="Exemple : Homonymie confirmée — il s'agit d'une autre personne (date de naissance différente, etc.)"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-surface-dark transition-colors"
            >
              Annuler l&apos;adoption
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={reason.trim().length < 10}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-error text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <AlertOctagon className="w-4 h-4" />
              Forcer l&apos;adoption malgré tout
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
