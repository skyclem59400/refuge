'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { markInquiryResolved } from '@/lib/actions/chat-inquiries'

export function ResolveActions({ inquiryId, resolvedBy }: { inquiryId: string; resolvedBy: string }) {
  const [notes, setNotes] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleResolve() {
    startTransition(async () => {
      const res = await markInquiryResolved(inquiryId, notes.trim() || null, resolvedBy)
      if (res.ok) {
        router.refresh()
      } else {
        alert(res.error || 'Erreur')
      }
    })
  }

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Marquer résolu
      </h2>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        placeholder="Notes de résolution (optionnel)..."
        className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm resize-none mb-3"
      />
      <button
        onClick={handleResolve}
        disabled={isPending}
        className="w-full px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50"
      >
        {isPending ? 'En cours...' : 'Marquer comme résolu'}
      </button>
    </div>
  )
}
