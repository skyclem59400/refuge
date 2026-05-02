'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createHealthRecord, updateHealthRecord } from '@/lib/actions/health'
import { VeterinarianSelect } from '@/components/health/veterinarian-select'
import type { HealthRecordType } from '@/lib/types/database'

const typeLabels: Record<HealthRecordType, string> = {
  vaccination: 'Vaccination',
  sterilization: 'Sterilisation',
  antiparasitic: 'Antiparasitaire',
  consultation: 'Consultation',
  surgery: 'Chirurgie',
  medication: 'Medicament',
  behavioral_assessment: 'Bilan comportemental',
  identification: 'Identification',
  radio: 'Radio',
  blood_test: 'Prise de sang',
  cession: 'Cession véto',
}

interface HealthRecordFormProps {
  animalId: string
  /** Si true, l'animal est en procédure judiciaire — afficher l'alerte facture nominative et activer judicial_procedure */
  judicialAnimal?: boolean
  /** Suggestion par défaut du destinataire de la facture quand l'animal est en procédure */
  judicialBillingDefault?: string | null
  /** N° de puce déjà saisi sur la fiche animal (pré-rempli pour le bloc Identification) */
  currentChipNumber?: string | null
  record?: {
    id: string
    type: HealthRecordType
    date: string
    description: string
    veterinarian: string | null
    veterinarian_id: string | null
    next_due_date: string | null
    cost: number | null
    notes: string | null
    judicial_procedure?: boolean
    billed_to?: string | null
    invoice_reference?: string | null
  }
  onClose?: () => void
}

export function HealthRecordForm({ animalId, record, onClose, judicialAnimal = false, judicialBillingDefault = null, currentChipNumber = null }: Readonly<HealthRecordFormProps>) {
  const isEditing = !!record

  const [type, setType] = useState<HealthRecordType>(record?.type || 'vaccination')
  const [date, setDate] = useState(record?.date || new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState(record?.description || '')
  const [veterinarianId, setVeterinarianId] = useState<string | null>(record?.veterinarian_id || null)
  const [veterinarianName, setVeterinarianName] = useState<string>(record?.veterinarian || '')
  const [nextDueDate, setNextDueDate] = useState(record?.next_due_date || '')
  const [cost, setCost] = useState(record?.cost?.toString() || '')
  const [notes, setNotes] = useState(record?.notes || '')
  const [judicialProcedure, setJudicialProcedure] = useState<boolean>(record?.judicial_procedure ?? judicialAnimal)
  const [billedTo, setBilledTo] = useState<string>(record?.billed_to || judicialBillingDefault || '')
  const [invoiceReference, setInvoiceReference] = useState<string>(record?.invoice_reference || '')
  const [chipNumber, setChipNumber] = useState<string>(currentChipNumber || '')
  const [reportToAnimal, setReportToAnimal] = useState<boolean>(true)

  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleVetChange(vetId: string | null, displayName: string | null) {
    setVeterinarianId(vetId)
    setVeterinarianName(displayName || '')
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!description.trim()) {
      toast.error('La description est obligatoire')
      return
    }

    // Pour un acte d'identification, exiger le n° de puce
    if (type === 'identification' && !chipNumber.trim()) {
      toast.error('Le n° de puce est obligatoire pour un acte d’identification')
      return
    }

    const payload = {
      type,
      date,
      description: description.trim(),
      veterinarian: veterinarianName.trim() || null,
      veterinarian_id: veterinarianId,
      next_due_date: nextDueDate || null,
      cost: cost ? parseFloat(cost) : null,
      notes: notes.trim() || null,
      judicial_procedure: judicialProcedure,
      billed_to: judicialProcedure ? (billedTo.trim() || null) : null,
      invoice_reference: judicialProcedure ? (invoiceReference.trim() || null) : null,
      // Si type=identification et report activé, on remonte aussi sur l'animal
      identification_chip_number: type === 'identification' && reportToAnimal ? chipNumber.trim() : undefined,
      identification_date: type === 'identification' && reportToAnimal ? date : undefined,
    }

    startTransition(async () => {
      if (isEditing && record) {
        const result = await updateHealthRecord(record.id, payload)
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success(type === 'identification' && reportToAnimal ? 'Acte enregistré et puce mise à jour sur la fiche animal' : 'Fiche sante mise a jour')
          onClose?.()
          router.refresh()
        }
      } else {
        const result = await createHealthRecord({
          animal_id: animalId,
          ...payload,
        })
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success(type === 'identification' && reportToAnimal ? 'Acte enregistré et puce mise à jour sur la fiche animal' : 'Fiche sante enregistree')
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
      {/* Alerte procédure judiciaire */}
      {judicialAnimal && (
        <div className="rounded-lg border-2 border-error/40 bg-error/5 p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚖️</span>
            <div className="flex-1">
              <h4 className="font-bold text-error mb-1">Animal en procédure judiciaire</h4>
              <p className="text-xs text-text/80 leading-relaxed">
                <strong>Précisez à la clinique vétérinaire</strong> que cet animal est en procédure
                et que la facture doit être <strong>nominative</strong> au nom de
                {judicialBillingDefault ? ` "${judicialBillingDefault}"` : ' la SDA'} pour permettre le
                remboursement par le tribunal.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Row 1: Type + Date */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="health-type" className={labelClass}>Type *</label>
          <select
            id="health-type"
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
          <label htmlFor="health-date" className={labelClass}>Date *</label>
          <input
            id="health-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className={inputClass}
          />
        </div>
      </div>

      {/* Bloc spécifique : Identification (pose de puce) */}
      {type === 'identification' && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
          <div className="flex items-center gap-2 text-primary font-semibold text-sm">
            🔬 Identification (pose de puce)
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label htmlFor="health-chip-number" className={labelClass}>N° de puce *</label>
              <input
                id="health-chip-number"
                type="text"
                value={chipNumber}
                onChange={(e) => setChipNumber(e.target.value)}
                placeholder="250..."
                required
                className={inputClass}
              />
              {currentChipNumber && chipNumber !== currentChipNumber && (
                <p className="text-xs text-warning mt-1">
                  ⚠️ La fiche contient déjà la puce <strong>{currentChipNumber}</strong> — sera remplacée.
                </p>
              )}
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm pb-2">
                <input
                  type="checkbox"
                  checked={reportToAnimal}
                  onChange={(e) => setReportToAnimal(e.target.checked)}
                />
                <span>Reporter sur la fiche animal (puce + date + véto)</span>
              </label>
            </div>
          </div>
          <p className="text-xs text-muted">
            Le n° de puce, la date et le vétérinaire identifiant seront automatiquement enregistrés
            sur la fiche de l&apos;animal pour servir aux certificats et déclarations I-CAD.
          </p>
        </div>
      )}

      {/* Row 2: Description (full width) */}
      <div>
        <label htmlFor="health-description" className={labelClass}>Description *</label>
        <textarea
          id="health-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={type === 'identification' ? "Lieu d'identification, méthode (puce sous-cutanée), particularités..." : "Decrivez l'acte de sante realise..."}
          rows={3}
          required
          className={`${inputClass} resize-y`}
        />
      </div>

      {/* Row 3: Veterinaire + Cout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <VeterinarianSelect
          id="health-vet-select"
          value={veterinarianId}
          onChange={handleVetChange}
          inputClass={inputClass}
          labelClass={labelClass}
        />

        <div>
          <label htmlFor="health-cost" className={labelClass}>Cout (EUR)</label>
          <input
            id="health-cost"
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
        <label htmlFor="health-next-due-date" className={labelClass}>Prochain rappel</label>
        <input
          id="health-next-due-date"
          type="date"
          value={nextDueDate}
          onChange={(e) => setNextDueDate(e.target.value)}
          className={inputClass}
        />
      </div>

      {/* Row 5: Notes (full width) */}
      <div>
        <label htmlFor="health-notes" className={labelClass}>Notes</label>
        <textarea
          id="health-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes complementaires..."
          rows={2}
          className={`${inputClass} resize-y`}
        />
      </div>

      {/* Procédure judiciaire (visible si animal en procédure) */}
      {judicialAnimal && (
        <div className="rounded-lg border border-error/30 bg-error/5 p-4 space-y-3">
          <div className="flex items-center gap-2 text-error font-semibold text-sm">
            ⚖️ Suivi facture nominative (procédure)
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={judicialProcedure}
              onChange={(e) => setJudicialProcedure(e.target.checked)}
            />
            <span>Cet acte fait partie de la procédure (à inclure dans le dossier tribunal)</span>
          </label>
          {judicialProcedure && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label htmlFor="health-billed-to" className={labelClass}>Facturé à</label>
                <input
                  id="health-billed-to"
                  type="text"
                  value={billedTo}
                  onChange={(e) => setBilledTo(e.target.value)}
                  placeholder={judicialBillingDefault || 'SDA — pour remboursement tribunal'}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="health-invoice-ref" className={labelClass}>Réf. facture clinique</label>
                <input
                  id="health-invoice-ref"
                  type="text"
                  value={invoiceReference}
                  onChange={(e) => setInvoiceReference(e.target.value)}
                  placeholder="N° facture si déjà émise"
                  className={inputClass}
                />
              </div>
            </div>
          )}
        </div>
      )}
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
          {(() => {
            if (isPending) return 'Enregistrement...'
            if (isEditing) return 'Modifier'
            return 'Enregistrer'
          })()}
        </button>
      </div>
    </form>
  )
}
