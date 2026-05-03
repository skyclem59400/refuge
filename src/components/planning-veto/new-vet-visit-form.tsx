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

// Time slots every 30 min from 06:00 to 21:00
const TIME_SLOTS: string[] = (() => {
  const slots: string[] = []
  for (let h = 6; h <= 21; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`)
    slots.push(`${String(h).padStart(2, '0')}:30`)
  }
  return slots
})()

function displaySlot(t: string): string {
  if (!t) return ''
  const [h, m] = t.split(':')
  const hNum = parseInt(h, 10)
  return m === '00' ? `${hNum}H` : `${hNum}H${m}`
}

function buildTimeLabel(start: string, end: string): string | null {
  const s = displaySlot(start)
  const e = displaySlot(end)
  if (!s && !e) return null
  if (s && e) return `${s}-${e}`
  if (s) return `À partir de ${s}`
  return `Jusqu'à ${e}`
}

export function NewVetVisitForm({ clinics }: Readonly<Props>) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [date, setDate] = useState<string | null>(new Date().toISOString().split('T')[0])
  const [startTime, setStartTime] = useState<string>(NONE)
  const [endTime, setEndTime] = useState<string>(NONE)
  const [locationLabel, setLocationLabel] = useState('')
  const [clinicId, setClinicId] = useState<string>(NONE)
  const [vetId, setVetId] = useState<string>(NONE)
  const [notes, setNotes] = useState('')

  const selectedClinic = useMemo(
    () => clinics.find((c) => c.id === clinicId) ?? null,
    [clinics, clinicId],
  )
  const availableVets = selectedClinic?.veterinarians ?? []

  function handleClinicChange(next: string) {
    setClinicId(next)
    setVetId(NONE)
  }

  // End time options : only slots strictly after start (if start is set)
  const endTimeOptions = useMemo(() => {
    if (startTime === NONE) return TIME_SLOTS
    return TIME_SLOTS.filter((t) => t > startTime)
  }, [startTime])

  function handleStartChange(next: string) {
    setStartTime(next)
    if (next !== NONE && endTime !== NONE && endTime <= next) {
      setEndTime(NONE)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!date) {
      toast.error('La date est obligatoire')
      return
    }
    startTransition(async () => {
      const resolvedVetId = vetId !== NONE ? vetId : null
      const resolvedStart = startTime !== NONE ? startTime : ''
      const resolvedEnd = endTime !== NONE ? endTime : ''
      const res = await createVetVisit({
        visit_date: date,
        time_label: buildTimeLabel(resolvedStart, resolvedEnd),
        location_label: locationLabel.trim() || null,
        veterinarian_id: resolvedVetId,
        vet_label: null,
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
          <label htmlFor="vv-loc" className={labelClass}>Lieu</label>
          <input id="vv-loc" type="text" value={locationLabel} onChange={(e) => setLocationLabel(e.target.value)} placeholder="Saint Druon (SV) / Tilques (TQ)..." className={inputClass} />
        </div>
        <div className="md:col-span-1">
          <span className={labelClass}>Créneau</span>
          <div className="flex items-center gap-2">
            <Select value={startTime} onValueChange={handleStartChange}>
              <SelectTrigger id="vv-start" aria-label="Heure de début">
                <SelectValue placeholder="Début" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {TIME_SLOTS.map((t) => (
                  <SelectItem key={t} value={t}>{displaySlot(t)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-muted text-sm shrink-0">→</span>
            <Select value={endTime} onValueChange={setEndTime}>
              <SelectTrigger id="vv-end" aria-label="Heure de fin">
                <SelectValue placeholder="Fin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {endTimeOptions.map((t) => (
                  <SelectItem key={t} value={t}>{displaySlot(t)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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

        <div className="md:col-span-2">
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
