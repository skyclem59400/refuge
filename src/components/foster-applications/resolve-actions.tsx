'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Workflow } from 'lucide-react'
import { updateFosterApplicationStatus } from '@/lib/actions/foster-applications'
import { FOSTER_STATUS_LABELS } from '@/lib/actions/foster-applications-constants'
import type { FosterApplicationStatus } from '@/lib/types/database'

interface ResolveActionsProps {
  applicationId: string
  currentStatus: FosterApplicationStatus
  currentNotes: string | null
}

export function FosterResolveActions({
  applicationId,
  currentStatus,
  currentNotes,
}: ResolveActionsProps) {
  const [status, setStatus] = useState<FosterApplicationStatus>(currentStatus)
  const [notes, setNotes] = useState(currentNotes ?? '')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSave() {
    startTransition(async () => {
      const res = await updateFosterApplicationStatus(applicationId, status, notes)
      if (res.ok) {
        toast.success('Candidature mise à jour')
        router.refresh()
      } else {
        toast.error(res.error || 'Erreur lors de la mise à jour')
      }
    })
  }

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
        <Workflow className="w-4 h-4 text-primary" /> Workflow
      </h2>

      <label htmlFor="foster-status" className="block text-xs font-medium text-muted mb-1">
        Statut
      </label>
      <select
        id="foster-status"
        value={status}
        onChange={(e) => setStatus(e.target.value as FosterApplicationStatus)}
        disabled={isPending}
        className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm mb-3"
      >
        {(Object.entries(FOSTER_STATUS_LABELS) as [FosterApplicationStatus, string][]).map(
          ([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ),
        )}
      </select>

      <label htmlFor="foster-notes" className="block text-xs font-medium text-muted mb-1">
        Notes internes
      </label>
      <textarea
        id="foster-notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={4}
        disabled={isPending}
        placeholder="Décision, contexte d'entretien ou visite domicile, prochaine étape..."
        className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm resize-none mb-3"
      />

      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="w-full px-4 py-2 rounded-lg gradient-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? 'Enregistrement...' : 'Enregistrer'}
      </button>
    </div>
  )
}
