'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { deleteLeaveRequest } from '@/lib/actions/leaves'
import { LeaveStatusBadge } from './leave-status-badge'
import { LeaveRequestReview } from './leave-request-review'
import { LeaveTypeManager } from './leave-type-manager'
import type { LeaveRequest, LeaveType, EstablishmentMember } from '@/lib/types/database'

type FilterTab = 'all' | 'pending' | 'approved' | 'refused'

const filterTabs: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'Toutes' },
  { key: 'pending', label: 'En attente' },
  { key: 'approved', label: 'Validees' },
  { key: 'refused', label: 'Refusees' },
]

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

interface AdminLeavesViewProps {
  readonly requests: LeaveRequest[]
  readonly leaveTypes: LeaveType[]
  readonly members: EstablishmentMember[]
  readonly pendingCount: number
}

export function AdminLeavesView({ requests, leaveTypes, members, pendingCount }: AdminLeavesViewProps) {
  const [reviewingRequest, setReviewingRequest] = useState<LeaveRequest | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'requests' | 'types'>('requests')
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleDelete(request: LeaveRequest) {
    setDeletingId(request.id)
  }

  function confirmDelete() {
    if (!deletingId) return
    startTransition(async () => {
      const result = await deleteLeaveRequest(deletingId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Demande supprimee')
        router.refresh()
      }
      setDeletingId(null)
    })
  }

  const typeMap = new Map(leaveTypes.map((t) => [t.id, t]))
  const memberMap = new Map(members.map((m) => [m.id, m]))

  const getMemberName = (memberId: string) => {
    const member = memberMap.get(memberId)
    return member?.full_name || member?.pseudo || member?.email || 'Inconnu'
  }

  const getLeaveType = (typeId: string) => typeMap.get(typeId)

  const filtered = activeFilter === 'all'
    ? requests
    : requests.filter((r) => r.status === activeFilter)

  return (
    <div className="space-y-6">
      {/* Onglets principaux : Demandes | Types de conges */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('requests')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            activeTab === 'requests'
              ? 'bg-primary text-white'
              : 'bg-surface-dark text-muted hover:text-text'
          }`}
        >
          Demandes
          {pendingCount > 0 && (
            <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-[11px] font-bold rounded-full bg-amber-500 text-white">
              {pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('types')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            activeTab === 'types'
              ? 'bg-primary text-white'
              : 'bg-surface-dark text-muted hover:text-text'
          }`}
        >
          Types de conges
        </button>
      </div>

      {activeTab === 'requests' && (
        <div>
          {/* Filtres par statut */}
          <div className="flex gap-1 mb-4 bg-surface-dark rounded-lg p-1">
            {filterTabs.map((tab) => {
              const count = tab.key === 'all'
                ? requests.length
                : requests.filter((r) => r.status === tab.key).length

              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveFilter(tab.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    activeFilter === tab.key
                      ? 'bg-surface text-text shadow-sm'
                      : 'text-muted hover:text-text'
                  }`}
                >
                  {tab.label} ({count})
                </button>
              )
            })}
          </div>

          {/* Liste des demandes */}
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-muted text-sm">
              Aucune demande de conge
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((request) => {
                const leaveType = typeMap.get(request.leave_type_id)
                const member = memberMap.get(request.member_id)

                return (
                  <div
                    key={request.id}
                    className="bg-surface rounded-lg border border-border p-4 hover:bg-surface-hover transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {leaveType && (
                            <span
                              className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: leaveType.color }}
                            />
                          )}
                          <span className="text-sm font-semibold text-text">
                            {leaveType?.name ?? 'Type inconnu'}
                          </span>
                          <LeaveStatusBadge status={request.status} />
                        </div>

                        {member && (
                          <p className="text-xs text-muted mt-1">
                            {member.full_name || member.pseudo || member.email || 'Membre inconnu'}
                          </p>
                        )}

                        <div className="flex items-center gap-3 mt-2 text-xs text-muted">
                          <span>
                            {formatDate(request.start_date)} - {formatDate(request.end_date)}
                          </span>
                          <span className="font-semibold text-text">
                            {request.days_count} jour{request.days_count > 1 ? 's' : ''}
                          </span>
                          {(request.half_day_start || request.half_day_end) && (
                            <span className="text-[11px]">
                              {request.half_day_start && '(demi-j. debut)'}
                              {request.half_day_start && request.half_day_end && ' '}
                              {request.half_day_end && '(demi-j. fin)'}
                            </span>
                          )}
                        </div>

                        {request.reason && (
                          <p className="text-xs text-muted mt-1.5 line-clamp-2">
                            {request.reason}
                          </p>
                        )}

                        {request.admin_comment && (
                          <p className="text-xs text-muted mt-1 italic border-l-2 border-border pl-2">
                            {request.admin_comment}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Bouton traiter pour les demandes en attente */}
                        {request.status === 'pending' && (
                          <button
                            onClick={() => setReviewingRequest(request)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold
                              bg-primary/15 text-primary hover:bg-primary/25 transition-colors"
                          >
                            Traiter
                          </button>
                        )}

                        {/* Bouton supprimer */}
                        <button
                          onClick={() => handleDelete(request)}
                          className="p-1.5 rounded-lg text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
                          title="Supprimer la demande"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'types' && (
        <LeaveTypeManager leaveTypes={leaveTypes} />
      )}

      {/* Modale confirmation suppression */}
      {deletingId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-xl border border-border w-full max-w-sm p-5">
            <h3 className="text-lg font-bold text-text mb-2">Supprimer la demande ?</h3>
            <p className="text-sm text-muted mb-5">
              Cette action est irreversible. Si la demande etait validee, le solde de conges sera retabli.
            </p>
            <div className="flex gap-3">
              <button
                onClick={confirmDelete}
                disabled={isPending}
                className="flex-1 px-3 py-2 rounded-lg font-semibold text-white text-sm
                  bg-red-600 hover:bg-red-700 transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? 'Suppression...' : 'Supprimer'}
              </button>
              <button
                onClick={() => setDeletingId(null)}
                disabled={isPending}
                className="flex-1 px-3 py-2 rounded-lg font-semibold text-sm text-muted
                  bg-surface-dark hover:bg-surface-hover transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {reviewingRequest && (
        <LeaveRequestReview
          request={reviewingRequest}
          leaveType={getLeaveType(reviewingRequest.leave_type_id)}
          memberName={getMemberName(reviewingRequest.member_id)}
          onClose={() => setReviewingRequest(null)}
          onReviewed={() => { setReviewingRequest(null); router.refresh() }}
        />
      )}
    </div>
  )
}
