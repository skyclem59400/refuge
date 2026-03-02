'use client'

import { useState } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  ArrowRight,
  Activity,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

interface ActivityLog {
  id: string
  establishment_id: string
  user_id: string
  action: string
  entity_type: string
  entity_id: string | null
  entity_name: string | null
  parent_type: string | null
  parent_id: string | null
  details: Record<string, unknown>
  created_at: string
}

interface ActivityTimelineProps {
  logs: ActivityLog[]
  userNames: Record<string, string>
}

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return "a l'instant"
  if (diffMin < 60) return `il y a ${diffMin} min`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `il y a ${diffHours}h`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `il y a ${diffDays}j`
  const diffWeeks = Math.floor(diffDays / 7)
  if (diffWeeks < 5) return `il y a ${diffWeeks} sem`
  const diffMonths = Math.floor(diffDays / 30)
  return `il y a ${diffMonths} mois`
}

const actionIcons: Record<string, { icon: typeof Plus; bg: string; text: string }> = {
  create: { icon: Plus, bg: 'bg-success/15', text: 'text-success' },
  update: { icon: Pencil, bg: 'bg-info/15', text: 'text-info' },
  delete: { icon: Trash2, bg: 'bg-error/15', text: 'text-error' },
  assign: { icon: ArrowRight, bg: 'bg-primary/15', text: 'text-primary' },
}

const defaultActionIcon = { icon: Activity, bg: 'bg-muted/15', text: 'text-muted' }

const actionVerbs: Record<string, string> = {
  create: 'cree',
  update: 'modifie',
  delete: 'supprime',
  assign: 'assigne',
}

const entityTypeLabels: Record<string, string> = {
  animal: "l'animal",
  outing: 'la sortie',
  health_record: 'le soin',
  movement: 'le mouvement',
  assignment: "l'assignation",
  member: 'le membre',
  box: 'le box',
  post: 'la publication',
  donation: 'le don',
  document: 'le document',
  intervention: "l'intervention",
}

export function ActivityTimeline({ logs, userNames }: ActivityTimelineProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted">
        <Activity className="w-10 h-10 mb-3" />
        <p className="text-sm">Aucune activite enregistree</p>
      </div>
    )
  }

  return (
    <div className="border-l-2 border-border ml-4">
      {logs.map((log) => {
        const { icon: Icon, bg, text } = actionIcons[log.action] || defaultActionIcon
        const userName = userNames[log.user_id] || 'Utilisateur inconnu'
        const verb = actionVerbs[log.action] || log.action
        const entityLabel = entityTypeLabels[log.entity_type] || log.entity_type
        const hasDetails = log.details && Object.keys(log.details).length > 0
        const isExpanded = expandedIds.has(log.id)

        return (
          <div key={log.id} className="pl-6 pb-6 relative">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center -ml-4 absolute top-0 left-0 ${bg} ${text}`}
            >
              <Icon className="w-4 h-4" />
            </div>

            <div className="ml-6">
              <p className="text-sm text-text">
                <span className="font-medium">{userName}</span> a {verb}{' '}
                {entityLabel}
                {log.entity_name && (
                  <span className="font-medium"> {log.entity_name}</span>
                )}
              </p>

              <p className="text-xs text-muted mt-0.5">{timeAgo(log.created_at)}</p>

              {hasDetails && (
                <div className="mt-1">
                  <button
                    type="button"
                    onClick={() => toggleExpanded(log.id)}
                    className="flex items-center gap-1 text-xs text-muted hover:text-text transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                    Details
                  </button>

                  {isExpanded && (
                    <pre className="mt-2 p-2 bg-surface-hover rounded text-xs font-mono overflow-x-auto text-text">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
