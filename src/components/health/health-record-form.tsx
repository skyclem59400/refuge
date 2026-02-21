'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createHealthRecord, updateHealthRecord } from '@/lib/actions/health'
import type { HealthRecordType } from '@/lib/types/database'

const typeLabels: Record<HealthRecordType, string> = {
  vaccination: 'Vaccination',
  sterilization: 'Sterilisation',
  antiparasitic: 'Antiparasitaire',
  consultation: 'Consultation',
  surgery: 'Chirurgie',
  medication: 'Medicament',
  behavioral_assessment: 'Bilan comportemental',
}

interface HealthRecordFormProps {
  animalId: string
  record?: {
    id: string
    type: HealthRecordType
    date: string
    description: string
    veterinarian: string | null
    next_due_date: string | null
    cost: number | null
    notes: string | null
  }
  onClose?: () => void
}

export function HealthRecordForm({ animalId, record, onClose }: HealthRecordFormProps) {
  const isEditing = !!record

  const [type, setType] = useState<HealthRecordType>(record?.type || 'vaccination')
  const [date, setDate] = useState(record?.date || new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState(record?.description || '')
  const [veterinarian, setVeterinarian] = useState(record?.veterinarian || '')
  const [nextDueDate, setNextDueDate] = useState(record?.next_due_date || '')
  const [cost, setCost] = useState(record?.cost?.toString() || '')
  const [notes, setNotes] = useState(record?.notes || '')

  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!description.trim()) {
      toast.error('La description est obligatoire')
      return
    }

    startTransition(async () => {
      if (isEditing) {
        const result = await updateHealthRecord(record.id, {
          type,
          date,
          description: description.trim(),
          veterinarian: veterinarian.trim() || null,
          next_due_date: nextDueDate || null,
          cost: cost ? parseFloat(cost) : null,
          notes: notes.trim() || null,
        })

        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success('Fiche sante mise a jour')
          onClose?.()
          router.refresh()
        }
      } else {
        const result = await createHealthRecord({
          animal_id: animalId,
          type,
          description: description.trim(),
          veterinarian: veterinarian.trim() || null,
          next_due_date: nextDueDate || null,
          cost: cost ? parseFloat(cost) : null,
          notes: notes.trim() || null,
        })

        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success('Fiche sante enregistree')
          onClose?.()
          router.refresh()
        }
      }
    })
  }

  const inputClass = 'w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50'
  const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5'

  return (
    <form onSubmit={handleSubmit} className="bg-surface rounded-xl border border-border p-5 space-y-4">
      {/* Row 1: Type + Date */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Type *</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as HealthRecordType)}
            className={inputClass}
            required
          >
            {Object.entries(typeLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Date *</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className={inputClass}
          />
        </div>
      </div>

      {/* Row 2: Description (full width) */}
      <div>
        <label className={labelClass}>Description *</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Decrivez l'acte de sante realise..."
          rows={3}
          required
          className={`${inputClass} resize-y`}
        />
      </div>

      {/* Row 3: Veterinaire + Cout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Veterinaire</label>
          <input
            type="text"
            value={veterinarian}
            onChange={(e) => setVeterinarian(e.target.value)}
            placeholder="Nom du veterinaire"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Cout (EUR)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="0.00"
            className={inputClass}
          />
        </div>
      </div>

      {/* Row 4: Prochain rappel (full width) */}
      <div>
        <label className={labelClass}>Prochain rappel</label>
        <input
          type="date"
          value={nextDueDate}
          onChange={(e) => setNextDueDate(e.target.value)}
          className={inputClass}
        />
      </div>

      {/* Row 5: Notes (full width) */}
      <div>
        <label className={labelClass}>Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes complementaires..."
          rows={2}
          className={`${inputClass} resize-y`}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-surface-hover transition-colors"
          >
            Annuler
          </button>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="gradient-primary hover:opacity-90 transition-opacity text-white px-4 py-2 rounded-lg font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending
            ? 'Enregistrement...'
            : isEditing
              ? 'Modifier'
              : 'Enregistrer'}
        </button>
      </div>
    </form>
  )
}
