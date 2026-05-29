'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Save } from 'lucide-react'
import { toast } from 'sonner'
import {
  updateAbuseReportStatus,
  STATUS_LABELS,
} from '@/lib/actions/abuse-reports'
import type { AbuseReportStatus } from '@/lib/types/database'

interface Props {
  reportId: string
  currentStatus: AbuseReportStatus
  currentNotes: string | null
  currentResolutionSummary: string | null
}

export function ResolveActions({
  reportId,
  currentStatus,
  currentNotes,
  currentResolutionSummary,
}: Props) {
  const [status, setStatus] = useState<AbuseReportStatus>(currentStatus)
  const [notes, setNotes] = useState(currentNotes ?? '')
  const [resolutionSummary, setResolutionSummary] = useState(
    currentResolutionSummary ?? ''
  )
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSave() {
    startTransition(async () => {
      const res = await updateAbuseReportStatus(
        reportId,
        status,
        notes.trim() || null,
        status === 'resolved' ? resolutionSummary.trim() || null : null
      )
      if (res.ok) {
        toast.success('Signalement mis à jour')
        router.refresh()
      } else {
        toast.error(res.error || 'Erreur lors de la mise à jour')
      }
    })
  }

  return (
    <div className="space-y-3">
      <div>
        <label
          htmlFor="status"
          className="block text-xs font-medium text-muted uppercase tracking-wider mb-1"
        >
          Statut
        </label>
        <select
          id="status"
          value={status}
          onChange={(e) => setStatus(e.target.value as AbuseReportStatus)}
          className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm"
        >
          {(Object.entries(STATUS_LABELS) as [AbuseReportStatus, string][]).map(
            ([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            )
          )}
        </select>
      </div>

      <div>
        <label
          htmlFor="notes"
          className="block text-xs font-medium text-muted uppercase tracking-wider mb-1"
        >
          Notes équipe
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Démarches engagées, contacts pris, observations internes..."
          className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm resize-none"
        />
      </div>

      {status === 'resolved' && (
        <div>
          <label
            htmlFor="resolutionSummary"
            className="block text-xs font-medium text-muted uppercase tracking-wider mb-1"
          >
            Résumé de la résolution
          </label>
          <textarea
            id="resolutionSummary"
            value={resolutionSummary}
            onChange={(e) => setResolutionSummary(e.target.value)}
            rows={3}
            placeholder="Comment le signalement a-t-il été traité ?"
            className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm resize-none"
          />
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg gradient-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
      >
        <Save className="w-4 h-4" />
        {isPending ? 'Enregistrement...' : 'Enregistrer'}
      </button>
    </div>
  )
}
