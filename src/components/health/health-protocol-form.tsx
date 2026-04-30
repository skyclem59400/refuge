'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Trash2, GripVertical, Loader2 } from 'lucide-react'
import { createHealthProtocol, updateHealthProtocol } from '@/lib/actions/health-protocols'
import type {
  HealthProtocolWithSteps,
  HealthRecordType,
  ProtocolApplicableSpecies,
} from '@/lib/types/database'

const healthTypeOptions: { value: HealthRecordType; label: string }[] = [
  { value: 'vaccination', label: 'Vaccination' },
  { value: 'sterilization', label: 'Sterilisation' },
  { value: 'antiparasitic', label: 'Antiparasitaire' },
  { value: 'consultation', label: 'Consultation' },
  { value: 'surgery', label: 'Chirurgie' },
  { value: 'medication', label: 'Medicament' },
  { value: 'behavioral_assessment', label: 'Bilan comportemental' },
  { value: 'identification', label: 'Identification' },
  { value: 'radio', label: 'Radio' },
  { value: 'blood_test', label: 'Prise de sang' },
]

interface StepFormState {
  label: string
  health_record_type: HealthRecordType
  offset_days: number
  recurrence_days: number | null
  description: string
}

interface HealthProtocolFormProps {
  protocol?: HealthProtocolWithSteps
  onClose?: () => void
}

function buildInitialSteps(protocol?: HealthProtocolWithSteps): StepFormState[] {
  if (protocol?.steps && protocol.steps.length > 0) {
    return protocol.steps.map((s) => ({
      label: s.label,
      health_record_type: s.health_record_type,
      offset_days: s.offset_days,
      recurrence_days: s.recurrence_days,
      description: s.description || '',
    }))
  }
  return [{
    label: '',
    health_record_type: 'vaccination',
    offset_days: 0,
    recurrence_days: null,
    description: '',
  }]
}

export function HealthProtocolForm({ protocol, onClose }: Readonly<HealthProtocolFormProps>) {
  const isEditing = !!protocol
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [name, setName] = useState(protocol?.name || '')
  const [description, setDescription] = useState(protocol?.description || '')
  const [species, setSpecies] = useState<ProtocolApplicableSpecies>(protocol?.applicable_species || 'both')
  const [isActive, setIsActive] = useState(protocol?.is_active ?? true)
  const [steps, setSteps] = useState<StepFormState[]>(buildInitialSteps(protocol))

  function addStep() {
    setSteps([...steps, {
      label: '',
      health_record_type: 'vaccination',
      offset_days: steps.length === 0 ? 0 : steps[steps.length - 1].offset_days + 28,
      recurrence_days: null,
      description: '',
    }])
  }

  function removeStep(index: number) {
    setSteps(steps.filter((_, i) => i !== index))
  }

  function updateStep(index: number, patch: Partial<StepFormState>) {
    setSteps(steps.map((s, i) => i === index ? { ...s, ...patch } : s))
  }

  function moveStep(index: number, direction: -1 | 1) {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= steps.length) return
    const next = [...steps]
    const tmp = next[newIndex]
    next[newIndex] = next[index]
    next[index] = tmp
    setSteps(next)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!name.trim()) {
      toast.error('Le nom du protocole est obligatoire')
      return
    }

    if (steps.length === 0) {
      toast.error('Au moins une etape est requise')
      return
    }

    for (const [i, step] of steps.entries()) {
      if (!step.label.trim()) {
        toast.error(`L’etape ${i + 1} doit avoir un libelle`)
        return
      }
    }

    startTransition(async () => {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        applicable_species: species,
        is_active: isActive,
        steps: steps.map((s) => ({
          label: s.label.trim(),
          health_record_type: s.health_record_type,
          offset_days: Number(s.offset_days) || 0,
          recurrence_days: s.recurrence_days ? Number(s.recurrence_days) : null,
          description: s.description.trim() || null,
        })),
      }

      let result
      if (isEditing && protocol) {
        result = await updateHealthProtocol(protocol.id, payload)
      } else {
        result = await createHealthProtocol(payload)
      }

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(isEditing ? 'Protocole mis a jour' : 'Protocole cree')
        router.refresh()
        onClose?.()
      }
    })
  }

  const inputClass = 'w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50'
  const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5'

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Header info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <label htmlFor="proto-name" className={labelClass}>Nom du protocole *</label>
          <input id="proto-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} placeholder="Vaccination chiot" />
        </div>
        <div>
          <label htmlFor="proto-species" className={labelClass}>Espece</label>
          <select id="proto-species" value={species} onChange={(e) => setSpecies(e.target.value as ProtocolApplicableSpecies)} className={inputClass}>
            <option value="both">Chien et chat</option>
            <option value="dog">Chien uniquement</option>
            <option value="cat">Chat uniquement</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="proto-desc" className={labelClass}>Description</label>
        <textarea id="proto-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={`${inputClass} resize-y`} />
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          <span>Protocole actif (proposable lors de l’application)</span>
        </label>
      </div>

      {/* Steps */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">Etapes</h3>
          <button type="button" onClick={addStep} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded text-primary hover:bg-primary/10 transition-colors">
            <Plus className="w-3 h-3" />
            Ajouter une etape
          </button>
        </div>

        <div className="space-y-3">
          {steps.map((step, index) => (
            <div key={index} className="bg-surface-dark/50 rounded-lg border border-border p-3">
              <div className="flex items-start gap-2 mb-3">
                <div className="flex flex-col gap-0.5 mt-1">
                  <button type="button" onClick={() => moveStep(index, -1)} disabled={index === 0} className="text-muted hover:text-text disabled:opacity-30">
                    <GripVertical className="w-3 h-3" />
                  </button>
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-muted mt-2">Etape {index + 1}</span>
                <div className="flex-1" />
                {steps.length > 1 && (
                  <button type="button" onClick={() => removeStep(index)} className="p-1 text-muted hover:text-error transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label htmlFor={`step-label-${index}`} className={labelClass}>Libelle *</label>
                  <input id={`step-label-${index}`} type="text" value={step.label} onChange={(e) => updateStep(index, { label: e.target.value })} required className={inputClass} placeholder="1ere injection CHPPiL" />
                </div>
                <div>
                  <label htmlFor={`step-type-${index}`} className={labelClass}>Type d’acte</label>
                  <select id={`step-type-${index}`} value={step.health_record_type} onChange={(e) => updateStep(index, { health_record_type: e.target.value as HealthRecordType })} className={inputClass}>
                    {healthTypeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor={`step-offset-${index}`} className={labelClass}>Decalage (jours apres date de debut) *</label>
                  <input id={`step-offset-${index}`} type="number" min="0" value={step.offset_days} onChange={(e) => updateStep(index, { offset_days: parseInt(e.target.value, 10) || 0 })} required className={inputClass} />
                </div>
                <div>
                  <label htmlFor={`step-recurrence-${index}`} className={labelClass}>Recurrence (jours, optionnel)</label>
                  <input id={`step-recurrence-${index}`} type="number" min="0" value={step.recurrence_days ?? ''} onChange={(e) => updateStep(index, { recurrence_days: e.target.value ? parseInt(e.target.value, 10) : null })} className={inputClass} placeholder="365 pour rappel annuel" />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor={`step-desc-${index}`} className={labelClass}>Description / commentaire</label>
                  <input id={`step-desc-${index}`} type="text" value={step.description} onChange={(e) => updateStep(index, { description: e.target.value })} className={inputClass} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        {onClose && (
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-surface-hover transition-colors">
            Annuler
          </button>
        )}
        <button type="submit" disabled={isPending} className="gradient-primary hover:opacity-90 transition-opacity text-white px-4 py-2 rounded-lg font-semibold text-sm disabled:opacity-50 inline-flex items-center gap-2">
          {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
          {isEditing ? 'Mettre a jour' : 'Creer le protocole'}
        </button>
      </div>
    </form>
  )
}
