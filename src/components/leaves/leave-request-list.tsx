'use client'

import { useState } from 'react'
import { LeaveStatusBadge } from './leave-status-badge'
import type { LeaveRequest, LeaveType, EstablishmentMember, LeaveRequestStatus } from '@/lib/types/database'

interface LeaveRequestListProps {
  requests: LeaveRequest[]
  leaveTypes: LeaveType[]
  showMember?: boolean
  members?: EstablishmentMember[]
  onCancel?: (id: string) => void
}

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

export function LeaveRequestList({
  requests,
  leaveTypes,
  showMember = false,
  members = [],
  onCancel,
}: LeaveRequestListProps) {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')

  const typeMap = new Map(leaveTypes.map((t) => [t.id, t]))
  const memberMap = new Map(members.map((m) => [m.id, m]))

  const filtered = activeFilter === 'all'
    ? requests
    : requests.filter((r) => r.status === activeFilter)

  return (
    <div>
      {/* Onglets de filtre */}
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

      {/* Liste */}
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
                      {/* Pastille couleur type */}
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

                    {showMember && member && (
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

                  {/* Bouton annuler */}
                  {onCancel && request.status === 'pending' && (
                    <button
                      onClick={() => onCancel(request.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold
                        bg-danger/15 text-danger hover:bg-danger/25 transition-colors flex-shrink-0"
                    >
                      Annuler
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
