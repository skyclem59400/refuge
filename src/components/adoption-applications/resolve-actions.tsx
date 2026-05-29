'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Save } from 'lucide-react'
import { updateAdoptionApplicationStatus } from '@/lib/actions/adoption-applications'
import type { AdoptionInquiryStatus } from '@/lib/types/database'

const STATUS_OPTIONS: { value: AdoptionInquiryStatus; label: string }[] = [
  { value: 'pending', label: 'À traiter' },
  { value: 'qualified', label: 'Qualifiée' },
  { value: 'interview_scheduled', label: 'Entretien planifié' },
  { value: 'accepted', label: 'Acceptée' },
  { value: 'declined', label: 'Refusée' },
  { value: 'archived', label: 'Archivée' },
]

interface Props {
  applicationId: string
  currentStatus: AdoptionInquiryStatus
  currentNotes: string | null
}

export function ResolveActions({ applicationId, currentStatus, currentNotes }: Props) {
  const [status, setStatus] = useState<AdoptionInquiryStatus>(currentStatus)
  const [notes, setNotes] = useState(currentNotes ?? '')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSave() {
    startTransition(async () => {
      const res = await updateAdoptionApplicationStatus(applicationId, status, notes)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('Candidature mise à jour')
        router.refresh()
      }
    })
  }

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <h2 className="font-semibold text-sm mb-4 flex items-center gap-2">
        <Save className="w-4 h-4 text-primary" /> Workflow
      </h2>

      <div className="space-y-3">
        <div>
          <label htmlFor="status" className="block text-xs font-medium text-muted mb-1">
            Statut
          </label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as AdoptionInquiryStatus)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="notes" className="block text-xs font-medium text-muted mb-1">
            Notes équipe
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={5}
            placeholder="Observations internes, points à clarifier, blocage..."
            className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm resize-none"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={isPending}
          className="w-full px-4 py-2 rounded-lg gradient-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isPending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  )
}
