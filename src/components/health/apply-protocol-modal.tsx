'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, X, ListChecks } from 'lucide-react'
import { applyProtocolToAnimal } from '@/lib/actions/health-protocols'
import type { AnimalSpecies, HealthProtocolWithSteps } from '@/lib/types/database'

interface ApplyProtocolModalProps {
  animalId: string
  animalSpecies: AnimalSpecies
  protocols: HealthProtocolWithSteps[]
  onClose: () => void
}

const healthTypeLabels: Record<string, string> = {
  vaccination: 'Vaccination',
  sterilization: 'Sterilisation',
  antiparasitic: 'Antiparasitaire',
  consultation: 'Consultation',
  surgery: 'Chirurgie',
  medication: 'Medicament',
  behavioral_assessment: 'Bilan comportemental',
}

export function ApplyProtocolModal({ animalId, animalSpecies, protocols, onClose }: Readonly<ApplyProtocolModalProps>) {
  const [selectedProtocolId, setSelectedProtocolId] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  // Filter protocols by species and active state
  const eligibleProtocols = protocols.filter((p) =>
    p.is_active && (p.applicable_species === 'both' || p.applicable_species === animalSpecies)
  )

  const selectedProtocol = eligibleProtocols.find((p) => p.id === selectedProtocolId)

  function computePreviewDate(offsetDays: number): string {
    const start = new Date(startDate)
    start.setDate(start.getDate() + offsetDays)
    return start.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!selectedProtocolId) {
      toast.error('Selectionnez un protocole')
      return
    }
    if (!startDate) {
      toast.error('La date de debut est obligatoire')
      return
    }

    startTransition(async () => {
      const result = await applyProtocolToAnimal({
        animalId,
        protocolId: selectedProtocolId,
        startDate,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Protocole applique : ${selectedProtocol?.steps.length} acte(s) genere(s)`)
        router.refresh()
        onClose()
      }
    })
  }

  const inputClass = 'w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50'
  const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-surface rounded-xl border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold">Appliquer un protocole de soins</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-muted hover:text-text transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {eligibleProtocols.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted">
              <p>Aucun protocole disponible pour cette espece.</p>
              <p className="text-xs mt-2">Creez-en depuis la page <strong>Sante &gt; Protocoles</strong>.</p>
            </div>
          ) : (
            <>
              <div>
                <label htmlFor="apply-protocol" className={labelClass}>Protocole *</label>
                <select id="apply-protocol" value={selectedProtocolId} onChange={(e) => setSelectedProtocolId(e.target.value)} required className={inputClass}>
                  <option value="">Selectionnez un protocole</option>
                  {eligibleProtocols.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.steps.length} etape(s))</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="apply-start-date" className={labelClass}>Date de debut *</label>
                <input id="apply-start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className={inputClass} />
              </div>

              {selectedProtocol && (
                <div className="bg-surface-dark/50 rounded-lg border border-border p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">Apercu des actes generes</h3>
                  <ol className="space-y-2 text-sm">
                    {selectedProtocol.steps.map((step) => (
                      <li key={step.id} className="flex items-start gap-3">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold shrink-0">
                          {step.step_order}
                        </span>
                        <div className="flex-1">
                          <div className="font-medium">{step.label}</div>
                          <div className="text-xs text-muted mt-0.5">
                            {healthTypeLabels[step.health_record_type] || step.health_record_type}
                            {' · '}
                            <span className="font-mono">{computePreviewDate(step.offset_days)}</span>
                            {step.recurrence_days && (
                              <span className="ml-1">(rappel tous les {step.recurrence_days}j)</span>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                  <p className="text-xs text-muted mt-3 italic">
                    Les dates pourront etre ajustees individuellement apres creation.
                  </p>
                </div>
              )}
            </>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-surface-hover transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={isPending || eligibleProtocols.length === 0} className="gradient-primary hover:opacity-90 transition-opacity text-white px-4 py-2 rounded-lg font-semibold text-sm disabled:opacity-50 inline-flex items-center gap-2">
              {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
              Appliquer le protocole
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
