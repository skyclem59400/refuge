'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Power, ListChecks, Loader2 } from 'lucide-react'
import { HealthProtocolForm } from '@/components/health/health-protocol-form'
import { deleteHealthProtocol, updateHealthProtocol } from '@/lib/actions/health-protocols'
import type { HealthProtocolWithSteps } from '@/lib/types/database'

interface HealthProtocolsClientProps {
  protocols: HealthProtocolWithSteps[]
  canManage: boolean
}

const speciesLabels: Record<string, string> = {
  cat: 'Chat',
  dog: 'Chien',
  both: 'Chien & chat',
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

export function HealthProtocolsClient({ protocols, canManage }: Readonly<HealthProtocolsClientProps>) {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<HealthProtocolWithSteps | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleNew() {
    setEditing(null)
    setShowForm(true)
  }

  function handleEdit(protocol: HealthProtocolWithSteps) {
    setEditing(protocol)
    setShowForm(true)
  }

  function handleClose() {
    setShowForm(false)
    setEditing(null)
  }

  function handleDelete(protocol: HealthProtocolWithSteps) {
    if (!window.confirm(`Supprimer le protocole "${protocol.name}" ? Cette action est irreversible.`)) return
    setActingId(protocol.id)
    startTransition(async () => {
      const result = await deleteHealthProtocol(protocol.id)
      setActingId(null)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Protocole supprime')
        router.refresh()
      }
    })
  }

  function handleToggleActive(protocol: HealthProtocolWithSteps) {
    setActingId(protocol.id)
    startTransition(async () => {
      const result = await updateHealthProtocol(protocol.id, {
        name: protocol.name,
        description: protocol.description,
        applicable_species: protocol.applicable_species,
        is_active: !protocol.is_active,
        steps: protocol.steps.map((s) => ({
          label: s.label,
          health_record_type: s.health_record_type,
          offset_days: s.offset_days,
          recurrence_days: s.recurrence_days,
          description: s.description,
        })),
      })
      setActingId(null)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(protocol.is_active ? 'Protocole desactive' : 'Protocole reactive')
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-4">
      {canManage && !showForm && (
        <div>
          <button
            type="button"
            onClick={handleNew}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold gradient-primary text-white hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Nouveau protocole
          </button>
        </div>
      )}

      {showForm && canManage && (
        <div className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-base font-semibold mb-4">
            {editing ? `Modifier "${editing.name}"` : 'Nouveau protocole'}
          </h2>
          <HealthProtocolForm protocol={editing || undefined} onClose={handleClose} />
        </div>
      )}

      {protocols.length === 0 && !showForm ? (
        <div className="bg-surface rounded-xl border border-border p-8 text-center">
          <ListChecks className="w-8 h-8 text-muted/30 mx-auto mb-3" />
          <p className="text-sm text-muted">Aucun protocole defini.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {protocols.map((p) => (
            <div key={p.id} className={`bg-surface rounded-xl border border-border p-5 ${!p.is_active ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-semibold">{p.name}</h3>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-info/15 text-info">
                      {speciesLabels[p.applicable_species]}
                    </span>
                    {!p.is_active && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-muted/15 text-muted">
                        Desactive
                      </span>
                    )}
                  </div>
                  {p.description && <p className="text-xs text-muted mt-1">{p.description}</p>}
                </div>
                {canManage && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(p)}
                      disabled={isPending && actingId === p.id}
                      className="p-2 rounded-lg text-muted hover:text-warning hover:bg-warning/10 transition-colors disabled:opacity-50"
                      title={p.is_active ? 'Desactiver' : 'Reactiver'}
                    >
                      {isPending && actingId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEdit(p)}
                      className="p-2 rounded-lg text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                      title="Modifier"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(p)}
                      disabled={isPending && actingId === p.id}
                      className="p-2 rounded-lg text-muted hover:text-error hover:bg-error/10 transition-colors disabled:opacity-50"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="border-t border-border pt-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">{p.steps.length} etape(s)</h4>
                <ol className="space-y-1.5 text-sm">
                  {p.steps.map((step) => (
                    <li key={step.id} className="flex items-start gap-3">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold shrink-0 mt-0.5">
                        {step.step_order}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{step.label}</span>
                        <span className="text-xs text-muted ml-2">
                          ({healthTypeLabels[step.health_record_type] || step.health_record_type})
                        </span>
                        <span className="text-xs text-muted ml-2">
                          J+{step.offset_days}
                          {step.recurrence_days && ` · rappel ${step.recurrence_days}j`}
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
