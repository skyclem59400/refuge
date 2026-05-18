'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, ShieldAlert } from 'lucide-react'
import { approveLeaveRequest, refuseLeaveRequest } from '@/lib/actions/leaves'
import { getCoverageImpactForRequest } from '@/lib/actions/leave-coverage'
import type { CoverageImpactResult } from '@/lib/actions/leave-coverage'
import { LeaveStatusBadge } from './leave-status-badge'
import type { LeaveRequest, LeaveType } from '@/lib/types/database'

interface LeaveRequestReviewProps {
  request: LeaveRequest
  leaveType?: LeaveType
  memberName: string
  onClose: () => void
  onReviewed: () => void
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export function LeaveRequestReview({
  request,
  leaveType,
  memberName,
  onClose,
  onReviewed,
}: LeaveRequestReviewProps) {
  const [isPending, startTransition] = useTransition()
  const [action, setAction] = useState<'approve' | 'refuse' | null>(null)
  const [comment, setComment] = useState('')
  const [impact, setImpact] = useState<CoverageImpactResult | null>(null)
  const [impactLoading, setImpactLoading] = useState(true)
  const [needsForce, setNeedsForce] = useState(false)
  const [forceComment, setForceComment] = useState('')

  useEffect(() => {
    let cancelled = false
    setImpactLoading(true)
    getCoverageImpactForRequest(request.id).then((res) => {
      if (cancelled) return
      if (res.data) setImpact(res.data)
      setImpactLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [request.id])

  function handleApprove(force = false) {
    if (force && !forceComment.trim()) {
      toast.error('Un motif est obligatoire pour forcer la validation')
      return
    }
    startTransition(async () => {
      const finalComment = force
        ? forceComment.trim()
        : comment.trim() || undefined
      const result = await approveLeaveRequest(request.id, finalComment, { force })
      if ('error' in result) {
        if (result.below_threshold) {
          setNeedsForce(true)
          toast.error(result.error)
        } else {
          toast.error(result.error)
        }
      } else {
        toast.success(result.forced ? 'Demande validee (forcee)' : 'Demande validee')
        onReviewed()
      }
    })
  }

  function handleRefuse() {
    if (!comment.trim()) {
      toast.error('Un commentaire est obligatoire pour refuser une demande')
      return
    }
    startTransition(async () => {
      const result = await refuseLeaveRequest(request.id, comment.trim())
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Demande refusee')
        onReviewed()
      }
    })
  }

  const showThresholdBanner = impact?.will_go_below && !needsForce

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-surface rounded-xl border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-bold text-text">Examiner la demande</h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-text transition-colors p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">Collaborateur</span>
              <span className="text-sm font-semibold text-text">{memberName}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">Type</span>
              <div className="flex items-center gap-2">
                {leaveType && (
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: leaveType.color }}
                  />
                )}
                <span className="text-sm text-text">{leaveType?.name ?? 'Type inconnu'}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">Periode</span>
              <span className="text-sm text-text">
                {formatDate(request.start_date)} - {formatDate(request.end_date)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">Duree</span>
              <span className="text-sm font-semibold text-text">
                {request.days_count} jour{request.days_count > 1 ? 's' : ''}
                {request.half_day_start && ' (demi-j. debut)'}
                {request.half_day_end && ' (demi-j. fin)'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">Statut</span>
              <LeaveStatusBadge status={request.status} />
            </div>

            {request.reason && (
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted block mb-1">Motif</span>
                <p className="text-sm text-text bg-surface-dark rounded-lg p-3">
                  {request.reason}
                </p>
              </div>
            )}
          </div>

          {/* Impact couverture */}
          {request.status === 'pending' && (
            <div className="border-t border-border pt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
                Impact sur l&apos;effectif
              </p>
              {impactLoading ? (
                <p className="text-xs text-muted italic">Calcul en cours...</p>
              ) : !impact ? (
                <p className="text-xs text-muted italic">Impossible de calculer l&apos;impact</p>
              ) : !impact.member_is_salaried ? (
                <p className="text-xs text-muted">
                  Demandeur non salarie : aucun impact sur le seuil minimum de salaries.
                </p>
              ) : impact.will_go_below ? (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-semibold text-red-500">
                      Sous le seuil : {impact.worst_available_salaried}/{impact.threshold} salaries le jour le plus critique.
                    </p>
                    <p className="text-muted">
                      Validation bloquee. Un administrateur peut forcer la validation avec un motif.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-emerald-400">
                  OK : minimum {impact.worst_available_salaried}/{impact.threshold} salaries dispo
                  sur la periode.
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          {request.status === 'pending' && (
            <div className="space-y-4 pt-2">
              {action === null && !needsForce && (
                <div className="flex gap-3">
                  <button
                    onClick={() => setAction('approve')}
                    disabled={isPending || !!showThresholdBanner}
                    className="flex-1 px-3 py-2 rounded-lg font-semibold text-white text-sm
                      bg-green-600 hover:bg-green-700 transition-colors
                      disabled:opacity-50 disabled:cursor-not-allowed"
                    title={showThresholdBanner ? 'Validation bloquee par le seuil minimum' : undefined}
                  >
                    Valider
                  </button>
                  <button
                    onClick={() => setAction('refuse')}
                    disabled={isPending}
                    className="flex-1 px-3 py-2 rounded-lg font-semibold text-white text-sm
                      bg-red-600 hover:bg-red-700 transition-colors
                      disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Refuser
                  </button>
                </div>
              )}

              {/* Bouton force quand le seuil bloque */}
              {showThresholdBanner && action === null && !needsForce && (
                <button
                  onClick={() => setNeedsForce(true)}
                  disabled={isPending}
                  className="w-full px-3 py-2 rounded-lg font-semibold text-sm
                    bg-amber-500/10 text-amber-500 border border-amber-500/30
                    hover:bg-amber-500/20 transition-colors flex items-center justify-center gap-2"
                >
                  <ShieldAlert className="w-4 h-4" />
                  Forcer la validation sous le seuil
                </button>
              )}

              {/* Form override (forcer la validation) */}
              {needsForce && (
                <div className="space-y-3 bg-amber-500/5 border border-amber-500/30 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <p className="font-semibold text-amber-500">Validation forcee</p>
                      <p className="text-muted mt-0.5">
                        Vous allez approuver malgre un effectif sous le seuil minimum.
                        Le motif sera enregistre dans l&apos;historique.
                      </p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1.5">
                      Motif (obligatoire)
                    </label>
                    <textarea
                      value={forceComment}
                      onChange={(e) => setForceComment(e.target.value)}
                      rows={2}
                      placeholder="Ex : remplacement organise via X..."
                      className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm resize-y
                        focus:border-primary focus:ring-1 focus:ring-primary transition-colors
                        placeholder:text-muted/50"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleApprove(true)}
                      disabled={isPending || !forceComment.trim()}
                      className="flex-1 px-3 py-2 rounded-lg font-semibold text-white text-sm
                        bg-amber-600 hover:bg-amber-700 transition-colors
                        disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isPending ? 'Validation...' : 'Confirmer la validation forcee'}
                    </button>
                    <button
                      onClick={() => { setNeedsForce(false); setForceComment('') }}
                      disabled={isPending}
                      className="px-3 py-2 rounded-lg font-semibold text-sm text-muted
                        bg-surface-dark hover:bg-surface-hover transition-colors
                        disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}

              {action === 'approve' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                      Commentaire (facultatif)
                    </label>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={2}
                      placeholder="Ajouter un commentaire..."
                      className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm resize-y
                        focus:border-primary focus:ring-1 focus:ring-primary transition-colors
                        placeholder:text-muted/50"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleApprove(false)}
                      disabled={isPending}
                      className="flex-1 px-3 py-2 rounded-lg font-semibold text-white text-sm
                        bg-green-600 hover:bg-green-700 transition-colors
                        disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isPending ? 'Validation...' : 'Confirmer la validation'}
                    </button>
                    <button
                      onClick={() => { setAction(null); setComment('') }}
                      disabled={isPending}
                      className="px-3 py-2 rounded-lg font-semibold text-sm text-muted
                        bg-surface-dark hover:bg-surface-hover transition-colors
                        disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Retour
                    </button>
                  </div>
                </div>
              )}

              {action === 'refuse' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                      Motif du refus *
                    </label>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={3}
                      required
                      placeholder="Indiquez le motif du refus..."
                      className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm resize-y
                        focus:border-primary focus:ring-1 focus:ring-primary transition-colors
                        placeholder:text-muted/50"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleRefuse}
                      disabled={isPending || !comment.trim()}
                      className="flex-1 px-3 py-2 rounded-lg font-semibold text-white text-sm
                        bg-red-600 hover:bg-red-700 transition-colors
                        disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isPending ? 'Refus en cours...' : 'Confirmer le refus'}
                    </button>
                    <button
                      onClick={() => { setAction(null); setComment('') }}
                      disabled={isPending}
                      className="px-3 py-2 rounded-lg font-semibold text-sm text-muted
                        bg-surface-dark hover:bg-surface-hover transition-colors
                        disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Retour
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
