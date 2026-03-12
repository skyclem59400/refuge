'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { approveLeaveRequest, refuseLeaveRequest } from '@/lib/actions/leaves'
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

  function handleApprove() {
    startTransition(async () => {
      const result = await approveLeaveRequest(request.id, comment.trim() || undefined)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Demande validee')
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

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-surface rounded-xl border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* En-tete */}
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

        {/* Details de la demande */}
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

          {/* Actions */}
          {request.status === 'pending' && (
            <div className="space-y-4 pt-2">
              {/* Choix d'action si pas encore selectionne */}
              {action === null && (
                <div className="flex gap-3">
                  <button
                    onClick={() => setAction('approve')}
                    disabled={isPending}
                    className="flex-1 px-3 py-2 rounded-lg font-semibold text-white text-sm
                      bg-green-600 hover:bg-green-700 transition-colors
                      disabled:opacity-50 disabled:cursor-not-allowed"
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

              {/* Formulaire de commentaire pour approbation */}
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
                      onClick={handleApprove}
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

              {/* Formulaire de commentaire pour refus */}
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
