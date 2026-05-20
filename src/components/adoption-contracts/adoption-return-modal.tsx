'use client'

import { useEffect, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle, Loader2, X, RotateCcw } from 'lucide-react'
import {
  returnAdoptionDuringTrial,
  getReturnEligibility,
} from '@/lib/actions/adoption-return'

type Method = 'cheque' | 'virement' | 'especes' | 'cb' | 'autre'

interface Props {
  contractId: string
  contractNumber: string
  animalName: string
  adopterName: string
  onClose: () => void
}

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function AdoptionReturnModal({
  contractId,
  contractNumber,
  animalName,
  adopterName,
  onClose,
}: Props) {
  const router = useRouter()
  const [eligibility, setEligibility] = useState<{
    eligible: boolean
    trial_period_ends_at: string
    adoption_fee: number
    non_refundable_amount: number
    max_refund: number
    status: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [returnDate, setReturnDate] = useState(todayIso())
  const [refunded, setRefunded] = useState<number>(0)
  const [method, setMethod] = useState<Method>('cheque')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [isPending, startTransition] = useTransition()
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    let cancelled = false
    getReturnEligibility(contractId)
      .then((res) => {
        if (cancelled) return
        if (res.error || !res.data) {
          toast.error(res.error || 'Erreur')
        } else {
          setEligibility(res.data)
          setRefunded(res.data.max_refund)
        }
      })
      .catch((err) => {
        if (cancelled) return
        toast.error((err as Error).message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [contractId])

  function handleSubmit() {
    if (!eligibility || !eligibility.eligible) return
    startTransition(async () => {
      const res = await returnAdoptionDuringTrial({
        contract_id: contractId,
        return_date: returnDate,
        refunded_amount: refunded,
        refund_payment_method: method,
        return_reason: reason.trim() || undefined,
        notes: notes.trim() || undefined,
      })
      if ('error' in res && res.error) {
        toast.error(res.error)
        return
      }
      toast.success('Retour enregistre.')
      setSuccess(true)
      router.refresh()
    })
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        e.stopPropagation()
        if (e.target === e.currentTarget) onClose()
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-surface border-b border-border px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-amber-500" />
              Retour adoption pendant periode d&apos;accueil
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Contrat {contractNumber} - {animalName} - {adopterName}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-dark text-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              Verification de l&apos;eligibilite...
            </div>
          ) : !eligibility ? (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-500">
              Impossible de charger les donnees du contrat.
            </div>
          ) : !eligibility.eligible ? (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm space-y-1">
                <p className="font-semibold text-red-500">
                  Hors periode d&apos;accueil ou contrat non actif.
                </p>
                <p className="text-muted text-xs">
                  Statut : {eligibility.status} - fin de periode d&apos;accueil prevue le{' '}
                  {new Date(eligibility.trial_period_ends_at + 'T00:00:00').toLocaleDateString('fr-FR')}.
                  Utilise la procedure d&apos;abandon classique pour un retour apres la periode.
                </p>
              </div>
            </div>
          ) : success ? (
            <div className="space-y-3">
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-sm text-emerald-500">
                Retour enregistre. L&apos;animal est de retour au refuge, le contrat est annule
                et le remboursement est trace.
              </div>
              <a
                href={`/api/pdf/adoption-cancellation/${contractId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90"
              >
                Telecharger l&apos;avenant d&apos;annulation (PDF)
              </a>
              <button
                onClick={onClose}
                className="w-full px-4 py-2 rounded-lg bg-surface-dark text-muted hover:text-text text-sm font-semibold"
              >
                Fermer
              </button>
            </div>
          ) : (
            <>
              <div className="bg-amber-500/5 border border-amber-500/30 rounded-lg p-3 text-xs space-y-1">
                <p>
                  Periode d&apos;accueil jusqu&apos;au{' '}
                  <span className="font-semibold text-text">
                    {new Date(eligibility.trial_period_ends_at + 'T00:00:00').toLocaleDateString('fr-FR')}
                  </span>
                </p>
                <p className="text-muted">
                  Frais d&apos;adoption initial :{' '}
                  <span className="font-semibold text-text">{eligibility.adoption_fee.toFixed(2)} EUR</span>{' '}
                  - non remboursable :{' '}
                  <span className="font-semibold text-text">
                    {eligibility.non_refundable_amount.toFixed(2)} EUR
                  </span>
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                    Date du retour
                  </label>
                  <input
                    type="date"
                    value={returnDate}
                    max={eligibility.trial_period_ends_at}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-dark border border-border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                    Mode de remboursement
                  </label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as Method)}
                    className="w-full px-3 py-2 bg-surface-dark border border-border rounded-lg text-sm"
                  >
                    <option value="cheque">Cheque</option>
                    <option value="virement">Virement</option>
                    <option value="especes">Especes</option>
                    <option value="cb">Carte bancaire</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                  Montant rembourse (EUR)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  max={eligibility.max_refund}
                  value={refunded}
                  onChange={(e) => setRefunded(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-surface-dark border border-border rounded-lg text-sm"
                />
                <p className="text-[11px] text-muted mt-1">
                  Max remboursable : {eligibility.max_refund.toFixed(2)} EUR
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                  Motif du retour
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  placeholder="Ex : incompatibilite chats, comportement..."
                  className="w-full px-3 py-2 bg-surface-dark border border-border rounded-lg text-sm resize-y"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                  Note interne (facultatif)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes a tracer sur le mouvement de l'animal"
                  className="w-full px-3 py-2 bg-surface-dark border border-border rounded-lg text-sm"
                />
              </div>
            </>
          )}
        </div>

        {!success && (
          <div className="sticky bottom-0 bg-surface border-t border-border px-5 py-3 flex justify-end gap-2">
            <button
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 rounded-lg text-sm font-medium text-muted hover:text-text"
            >
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              disabled={isPending || loading || !eligibility?.eligible}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Enregistrer le retour
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
