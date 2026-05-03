'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createVetVisit } from '@/lib/actions/vet-visits'
import { DatePicker } from '@/components/ui/date-picker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { VeterinaryClinicWithVets } from '@/lib/types/database'

interface Props {
  clinics: VeterinaryClinicWithVets[]
}

const NONE = '__none__'

export function NewVetVisitForm({ clinics }: Readonly<Props>) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [date, setDate] = useState<string | null>(new Date().toISOString().split('T')[0])
  const [timeLabel, setTimeLabel] = useState('')
  const [locationLabel, setLocationLabel] = useState('')
  const [clinicId, setClinicId] = useState<string>(NONE)
  const [vetId, setVetId] = useState<string>(NONE)
  const [vetLabel, setVetLabel] = useState('')
  const [notes, setNotes] = useState('')

  const selectedClinic = useMemo(
    () => clinics.find((c) => c.id === clinicId) ?? null,
    [clinics, clinicId],
  )
  const availableVets = selectedClinic?.veterinarians ?? []

  function handleClinicChange(next: string) {
    setClinicId(next)
    // Reset vet when clinic changes
    setVetId(NONE)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!date) {
      toast.error('La date est obligatoire')
      return
    }
    startTransition(async () => {
      const resolvedVetId = vetId !== NONE ? vetId : null
      const resolvedVet = resolvedVetId ? availableVets.find((v) => v.id === resolvedVetId) : null
      const res = await createVetVisit({
        visit_date: date,
        time_label: timeLabel.trim() || null,
        location_label: locationLabel.trim() || null,
        veterinarian_id: resolvedVetId,
        vet_label: vetLabel.trim() || resolvedVet?.first_name || null,
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

  const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5'
  const inputClass = 'w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50'

  return (
    <form onSubmit={handleSubmit} className="bg-surface rounded-xl border border-border p-5 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="vv-date" className={labelClass}>Date *</label>
          <DatePicker id="vv-date" value={date} onChange={setDate} required />
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
          <label htmlFor="vv-clinic" className={labelClass}>Cabinet vétérinaire</label>
          <Select value={clinicId} onValueChange={handleClinicChange}>
            <SelectTrigger id="vv-clinic">
              <SelectValue placeholder="Aucun cabinet" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>— Aucun —</SelectItem>
              {clinics.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label htmlFor="vv-vet" className={labelClass}>Vétérinaire</label>
          <Select value={vetId} onValueChange={setVetId} disabled={!selectedClinic}>
            <SelectTrigger id="vv-vet">
              <SelectValue placeholder={selectedClinic ? 'Choisir un véto' : 'Choisissez d’abord un cabinet'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>— Non précisé —</SelectItem>
              {availableVets.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  Dr {v.first_name ? `${v.first_name} ` : ''}{v.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label htmlFor="vv-vet-label" className={labelClass}>Libellé véto (libre)</label>
          <input id="vv-vet-label" type="text" value={vetLabel} onChange={(e) => setVetLabel(e.target.value)} placeholder="JULIE, CAROLINE..." className={inputClass} />
        </div>
      </div>

      <div>
        <label htmlFor="vv-notes" className={labelClass}>Notes</label>
        <textarea id="vv-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputClass} resize-y`} />
      </div>

      <div className="flex gap-2 justify-end">
        <button type="button" onClick={() => router.back()} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-surface-hover transition-colors">Annuler</button>
        <button type="submit" disabled={isPending} className="px-4 py-2 rounded-lg gradient-primary text-white text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity">
          {isPending ? 'Création...' : 'Créer le passage'}
        </button>
      </div>
    </form>
  )
}
