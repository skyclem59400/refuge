'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createVetVisit } from '@/lib/actions/vet-visits'
import type { VeterinaryClinicWithVets } from '@/lib/types/database'

interface Props {
  clinics: VeterinaryClinicWithVets[]
}

export function NewVetVisitForm({ clinics }: Readonly<Props>) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [timeLabel, setTimeLabel] = useState('')
  const [locationLabel, setLocationLabel] = useState('')
  const [vetId, setVetId] = useState('')
  const [vetLabel, setVetLabel] = useState('')
  const [notes, setNotes] = useState('')

  const allVets = clinics.flatMap((c) => c.veterinarians.map((v) => ({ ...v, clinic_name: c.name })))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await createVetVisit({
        visit_date: date,
        time_label: timeLabel.trim() || null,
        location_label: locationLabel.trim() || null,
        veterinarian_id: vetId || null,
        vet_label: vetLabel.trim() || (vetId ? (allVets.find((v) => v.id === vetId)?.first_name || '') : null),
        notes: notes.trim() || null,
      })
      if (res.error) {
        toast.error(res.error)
      } else if (res.data) {
        toast.success('Passage véto créé')
        router.push(`/sante/planning/${res.data.id}`)
      }
    })
  }

  const inputClass = 'w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50'
  const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5'

  return (
    <form onSubmit={handleSubmit} className="bg-surface rounded-xl border border-border p-5 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="vv-date" className={labelClass}>Date *</label>
          <input id="vv-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="vv-time" className={labelClass}>Créneau</label>
          <input id="vv-time" type="text" value={timeLabel} onChange={(e) => setTimeLabel(e.target.value)} placeholder="9H-11H" className={inputClass} />
        </div>
        <div>
          <label htmlFor="vv-loc" className={labelClass}>Lieu</label>
          <input id="vv-loc" type="text" value={locationLabel} onChange={(e) => setLocationLabel(e.target.value)} placeholder="Saint Druon (SV) / Tilques (TQ)..." className={inputClass} />
        </div>
        <div>
          <label htmlFor="vv-vet" className={labelClass}>Vétérinaire (référencé)</label>
          <select id="vv-vet" value={vetId} onChange={(e) => setVetId(e.target.value)} className={inputClass}>
            <option value="">— Aucun —</option>
            {allVets.map((v) => (
              <option key={v.id} value={v.id}>
                Dr {v.first_name ? `${v.first_name} ` : ''}{v.last_name} ({v.clinic_name})
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label htmlFor="vv-vet-label" className={labelClass}>Libellé véto (libre)</label>
          <input id="vv-vet-label" type="text" value={vetLabel} onChange={(e) => setVetLabel(e.target.value)} placeholder="JULIE, CAROLINE..." className={inputClass} />
        </div>
      </div>

      <div>
        <label htmlFor="vv-notes" className={labelClass}>Notes</label>
        <textarea id="vv-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputClass} resize-y`} />
      </div>

      <div className="flex gap-2 justify-end">
        <button type="button" onClick={() => router.back()} className="px-4 py-2 rounded-lg border border-border text-sm">Annuler</button>
        <button type="submit" disabled={isPending} className="px-4 py-2 rounded-lg gradient-primary text-white text-sm font-semibold disabled:opacity-50">
          {isPending ? 'Création...' : 'Créer le passage'}
        </button>
      </div>
    </form>
  )
}
