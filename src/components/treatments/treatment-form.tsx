'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, X } from 'lucide-react'
import { createTreatment, updateTreatment } from '@/lib/actions/treatments'
import type { AnimalTreatment, TreatmentFrequency, AnimalHealthRecord } from '@/lib/types/database'

const frequencyOptions: { value: TreatmentFrequency; label: string; description: string }[] = [
  { value: 'daily', label: 'Quotidien', description: '1x/jour' },
  { value: 'twice_daily', label: '2x/jour', description: 'Matin & soir' },
  { value: 'weekly', label: 'Hebdomadaire', description: '1x/semaine' },
  { value: 'custom', label: 'Personnalise', description: 'Horaires libres' },
]

interface TreatmentFormProps {
  animals: { id: string; nom: string }[]
  healthRecords?: AnimalHealthRecord[]
  editingTreatment?: AnimalTreatment
  preselectedAnimalId?: string
  onClose?: () => void
}

export function TreatmentForm({
  animals,
  healthRecords = [],
  editingTreatment,
  preselectedAnimalId,
  onClose,
}: Readonly<TreatmentFormProps>) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [name, setName] = useState(editingTreatment?.name || '')
  const [description, setDescription] = useState(editingTreatment?.description || '')
  const [animalId, setAnimalId] = useState(editingTreatment?.animal_id || preselectedAnimalId || '')
  const [healthRecordId, setHealthRecordId] = useState(editingTreatment?.health_record_id || '')
  const [frequency, setFrequency] = useState<TreatmentFrequency>(editingTreatment?.frequency || 'daily')
  const [times, setTimes] = useState<string[]>(
    editingTreatment?.times?.length ? editingTreatment.times : ['08:00']
  )
  const [startDate, setStartDate] = useState(
    editingTreatment?.start_date || new Date().toISOString().split('T')[0]
  )
  const [endDate, setEndDate] = useState(editingTreatment?.end_date || '')
  const [notes, setNotes] = useState(editingTreatment?.notes || '')

  // Filter health records by selected animal
  const filteredRecords = animalId
    ? healthRecords.filter((r) => r.animal_id === animalId)
    : []

  function handleFrequencyChange(f: TreatmentFrequency) {
    setFrequency(f)
    if (f === 'daily') setTimes(['08:00'])
    else if (f === 'twice_daily') setTimes(['08:00', '18:00'])
    else if (f === 'weekly') setTimes(['08:00'])
  }

  function addTimeSlot() {
    setTimes([...times, '12:00'])
  }

  function removeTimeSlot(index: number) {
    setTimes(times.filter((_, i) => i !== index))
  }

  function updateTimeSlot(index: number, value: string) {
    const newTimes = [...times]
    newTimes[index] = value
    setTimes(newTimes)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!name.trim()) {
      toast.error('Le nom du traitement est obligatoire')
      return
    }
    if (!animalId) {
      toast.error('Veuillez selectionner un animal')
      return
    }

    startTransition(async () => {
      if (editingTreatment) {
        const result = await updateTreatment(editingTreatment.id, {
          name: name.trim(),
          description: description.trim(),
          frequency,
          times,
          start_date: startDate,
          end_date: endDate || null,
          notes: notes.trim(),
        })
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success('Traitement mis a jour')
          router.refresh()
          onClose?.()
        }
      } else {
        const result = await createTreatment({
          animal_id: animalId,
          health_record_id: healthRecordId || null,
          name: name.trim(),
          description: description.trim(),
          frequency,
          times,
          start_date: startDate,
          end_date: endDate || null,
          notes: notes.trim(),
        })
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success('Traitement cree')
          // Reset form
          setName('')
          setDescription('')
          setAnimalId(preselectedAnimalId || '')
          setHealthRecordId('')
          setFrequency('daily')
          setTimes(['08:00'])
          setStartDate(new Date().toISOString().split('T')[0])
          setEndDate('')
          setNotes('')
          router.refresh()
          onClose?.()
        }
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface rounded-xl border border-border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          {editingTreatment ? 'Modifier le traitement' : 'Nouveau traitement'}
        </h3>
        {onClose && (
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-surface-hover transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Name */}
        <div className="md:col-span-2">
          <label htmlFor="treatmentName" className="block text-sm font-medium mb-1.5">
            Nom du traitement <span className="text-error">*</span>
          </label>
          <input
            type="text"
            id="treatmentName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Antibiotique amoxicilline..."
            required
            className="w-full px-3 py-2 bg-surface-dark border border-border rounded-lg text-sm
              focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
          />
        </div>

        {/* Description */}
        <div className="md:col-span-2">
          <label htmlFor="treatmentDescription" className="block text-sm font-medium mb-1.5">
            Description
          </label>
          <textarea
            id="treatmentDescription"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Posologie, instructions..."
            rows={2}
            className="w-full px-3 py-2 bg-surface-dark border border-border rounded-lg text-sm resize-y
              focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
          />
        </div>

        {/* Animal */}
        <div>
          <label htmlFor="treatmentAnimal" className="block text-sm font-medium mb-1.5">
            Animal <span className="text-error">*</span>
          </label>
          <select
            id="treatmentAnimal"
            value={animalId}
            onChange={(e) => { setAnimalId(e.target.value); setHealthRecordId('') }}
            required
            disabled={!!preselectedAnimalId}
            className="w-full px-3 py-2 bg-surface-dark border border-border rounded-lg text-sm
              focus:border-primary focus:ring-1 focus:ring-primary transition-colors
              disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <option value="">Selectionner un animal</option>
            {animals.map((a) => (
              <option key={a.id} value={a.id}>{a.nom}</option>
            ))}
          </select>
        </div>

        {/* Link to health record */}
        <div>
          <label htmlFor="healthRecord" className="block text-sm font-medium mb-1.5">
            Lier a un acte sante
          </label>
          <select
            id="healthRecord"
            value={healthRecordId}
            onChange={(e) => setHealthRecordId(e.target.value)}
            disabled={!animalId || filteredRecords.length === 0}
            className="w-full px-3 py-2 bg-surface-dark border border-border rounded-lg text-sm
              focus:border-primary focus:ring-1 focus:ring-primary transition-colors
              disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <option value="">
              {!animalId ? 'Selectionnez d\'abord un animal' : filteredRecords.length === 0 ? 'Aucun acte sante' : 'Optionnel'}
            </option>
            {filteredRecords.map((r) => (
              <option key={r.id} value={r.id}>
                {r.date} — {r.description?.substring(0, 50) || r.type}
              </option>
            ))}
          </select>
        </div>

        {/* Frequency */}
        <div className="md:col-span-2">
          <span className="block text-sm font-medium mb-2">Frequence <span className="text-error">*</span></span>
          <div className="flex flex-wrap gap-2">
            {frequencyOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleFrequencyChange(opt.value)}
                className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                  frequency === opt.value
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'bg-surface-dark border-border text-muted hover:border-border/50'
                }`}
              >
                {opt.label}
                <span className="text-xs text-muted ml-1">({opt.description})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Time slots */}
        <div className="md:col-span-2">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-medium">Horaires</span>
            {(frequency === 'custom' || frequency === 'twice_daily') && (
              <button
                type="button"
                onClick={addTimeSlot}
                className="text-xs text-primary hover:underline"
              >
                + Ajouter un horaire
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {times.map((time, index) => (
              <div key={index} className="flex items-center gap-1">
                <input
                  type="time"
                  value={time}
                  onChange={(e) => updateTimeSlot(index, e.target.value)}
                  className="px-3 py-2 bg-surface-dark border border-border rounded-lg text-sm
                    focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                />
                {times.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeTimeSlot(index)}
                    className="p-1 text-muted hover:text-error transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Date range */}
        <div>
          <label htmlFor="startDate" className="block text-sm font-medium mb-1.5">
            Date de debut <span className="text-error">*</span>
          </label>
          <input
            type="date"
            id="startDate"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
            className="w-full px-3 py-2 bg-surface-dark border border-border rounded-lg text-sm
              focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
          />
        </div>
        <div>
          <label htmlFor="endDate" className="block text-sm font-medium mb-1.5">
            Date de fin <span className="text-xs text-muted">(optionnel)</span>
          </label>
          <input
            type="date"
            id="endDate"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 bg-surface-dark border border-border rounded-lg text-sm
              focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
          />
        </div>

        {/* Notes */}
        <div className="md:col-span-2">
          <label htmlFor="treatmentNotes" className="block text-sm font-medium mb-1.5">
            Notes
          </label>
          <textarea
            id="treatmentNotes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes supplementaires..."
            rows={2}
            className="w-full px-3 py-2 bg-surface-dark border border-border rounded-lg text-sm resize-y
              focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90
            transition-colors disabled:opacity-50 flex items-center gap-2 text-sm font-semibold"
        >
          {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          {isPending
            ? (editingTreatment ? 'Mise a jour...' : 'Creation...')
            : (editingTreatment ? 'Mettre a jour' : 'Creer le traitement')
          }
        </button>
      </div>
    </form>
  )
}
