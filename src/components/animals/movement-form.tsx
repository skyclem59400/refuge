'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { recordMovement } from '@/lib/actions/animals'
import type { AnimalStatus, MovementType, IcadStatus } from '@/lib/types/database'

interface MovementFormProps {
  animalId: string
  currentStatus: AnimalStatus
  onClose?: () => void
}

const movementsByStatus: Record<string, { value: MovementType; label: string }[]> = {
  pound: [
    { value: 'shelter_transfer', label: 'Transfert en refuge' },
    { value: 'return_to_owner', label: 'Restitution au proprietaire' },
    { value: 'transfer_out', label: 'Transfert vers autre refuge' },
    { value: 'death', label: 'Deces' },
    { value: 'euthanasia', label: 'Euthanasie' },
  ],
  shelter: [
    { value: 'adoption', label: 'Adoption' },
    { value: 'return_to_owner', label: 'Restitution au proprietaire' },
    { value: 'transfer_out', label: 'Transfert vers autre refuge' },
    { value: 'death', label: 'Deces' },
    { value: 'euthanasia', label: 'Euthanasie' },
  ],
}

const movementSuccessMessages: Record<MovementType, string> = {
  pound_entry: 'Entree en fourriere enregistree',
  shelter_transfer: 'Transfert en refuge enregistre',
  adoption: 'Adoption enregistree',
  return_to_owner: 'Restitution au proprietaire enregistree',
  transfer_out: 'Transfert enregistre',
  death: 'Deces enregistre',
  euthanasia: 'Euthanasie enregistree',
}

export function MovementForm({ animalId, currentStatus, onClose }: MovementFormProps) {
  const availableMovements = movementsByStatus[currentStatus] || []

  const [type, setType] = useState<MovementType | ''>('')
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [personName, setPersonName] = useState('')
  const [personContact, setPersonContact] = useState('')
  const [destination, setDestination] = useState('')
  const [icadStatus, setIcadStatus] = useState<IcadStatus>('pending')
  const [notes, setNotes] = useState('')

  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const isDeathOrEuthanasia = type === 'death' || type === 'euthanasia'
  const isTransferOut = type === 'transfer_out'

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!type) {
      toast.error('Le type de mouvement est obligatoire')
      return
    }

    if (!date) {
      toast.error('La date est obligatoire')
      return
    }

    startTransition(async () => {
      const result = await recordMovement(animalId, {
        type,
        date,
        notes: notes || null,
        person_name: personName || null,
        person_contact: personContact || null,
        destination: isTransferOut ? (destination || null) : null,
        icad_status: icadStatus,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(movementSuccessMessages[type] || 'Mouvement enregistre')
        onClose?.()
        router.refresh()
      }
    })
  }

  const inputClass = 'w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50'
  const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Type + Date */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Type de mouvement *</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as MovementType)}
            required
            className={inputClass}
          >
            <option value="">Selectionnez un type</option>
            {availableMovements.map(({ value, label }) => (
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

      {/* Warning for death/euthanasia */}
      {isDeathOrEuthanasia && (
        <div className="flex items-start gap-3 rounded-lg border border-orange-300 bg-orange-50 p-3 dark:border-orange-500/30 dark:bg-orange-500/10">
          <svg className="mt-0.5 h-5 w-5 shrink-0 text-orange-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <p className="text-sm text-orange-700 dark:text-orange-300">
            Attention : cette action est definitive et marquera l&apos;animal comme {type === 'death' ? 'Decede' : 'Euthanasie'}.
          </p>
        </div>
      )}

      {/* Person name + Contact */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Personne liee</label>
          <input
            type="text"
            value={personName}
            onChange={(e) => setPersonName(e.target.value)}
            placeholder="Nom de la personne"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Contact</label>
          <input
            type="text"
            value={personContact}
            onChange={(e) => setPersonContact(e.target.value)}
            placeholder="Telephone ou email"
            className={inputClass}
          />
        </div>
      </div>

      {/* Destination (only for transfer_out) */}
      {isTransferOut && (
        <div>
          <label className={labelClass}>Destination</label>
          <input
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Nom du refuge ou adresse de destination"
            className={inputClass}
          />
        </div>
      )}

      {/* I-CAD status */}
      <div>
        <label className={labelClass}>Declaration I-CAD</label>
        <select
          value={icadStatus}
          onChange={(e) => setIcadStatus(e.target.value as IcadStatus)}
          className={inputClass}
        >
          <option value="pending">En attente</option>
          <option value="declared">Declaree</option>
          <option value="not_required">Non requise</option>
        </select>
      </div>

      {/* Notes */}
      <div>
        <label className={labelClass}>Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes complementaires..."
          rows={3}
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
          disabled={isPending || !type}
          className="gradient-primary hover:opacity-90 transition-opacity text-white px-4 py-2 rounded-lg font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? 'Enregistrement...' : 'Enregistrer le mouvement'}
        </button>
      </div>
    </form>
  )
}
