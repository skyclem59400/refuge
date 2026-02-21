'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { updateDeclarationStatus, createDeclaration } from '@/lib/actions/icad'
import { getIcadDeclarationTypeLabel, getIcadStatusLabel, getIcadStatusColor } from '@/lib/sda-utils'
import { formatDateShort } from '@/lib/utils'
import type { IcadDeclaration, IcadDeclarationType, IcadDeclarationStatus } from '@/lib/types/database'
import { Shield, CheckCircle, Clock, AlertTriangle, Send, XCircle, Plus } from 'lucide-react'

interface IcadDeclarationsProps {
  animalId: string
  animalName: string
  chipNumber: string | null
  declarations: IcadDeclaration[]
  canManage: boolean
}

const declarationTypes: { value: IcadDeclarationType; label: string }[] = [
  { value: 'pound_entry', label: 'Entree en fourriere' },
  { value: 'shelter_transfer', label: 'Transfert en refuge' },
  { value: 'adoption', label: 'Adoption' },
  { value: 'return_to_owner', label: 'Restitution proprietaire' },
  { value: 'transfer_out', label: 'Transfert sortant' },
  { value: 'death', label: 'Deces' },
  { value: 'euthanasia', label: 'Euthanasie' },
  { value: 'identification', label: 'Identification' },
  { value: 'owner_change', label: 'Changement proprietaire' },
  { value: 'address_change', label: 'Changement adresse' },
]

export function IcadDeclarations({ animalId, animalName, chipNumber, declarations, canManage }: IcadDeclarationsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showNewForm, setShowNewForm] = useState(false)
  const [newType, setNewType] = useState<IcadDeclarationType>('pound_entry')
  const [newNotes, setNewNotes] = useState('')
  const [pendingAction, setPendingAction] = useState<string | null>(null)

  const pendingCount = declarations.filter(d => d.status === 'pending').length
  const errorCount = declarations.filter(d => d.status === 'error').length

  function handleCreate() {
    startTransition(async () => {
      const result = await createDeclaration({
        animal_id: animalId,
        declaration_type: newType,
        notes: newNotes || null,
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Declaration I-CAD creee')
        setShowNewForm(false)
        setNewNotes('')
        router.refresh()
      }
    })
  }

  function handleStatusChange(id: string, status: IcadDeclarationStatus) {
    setPendingAction(id)
    startTransition(async () => {
      const result = await updateDeclarationStatus(id, status)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Statut mis a jour : ${getIcadStatusLabel(status)}`)
        router.refresh()
      }
      setPendingAction(null)
    })
  }

  const inputClass = 'w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Declarations I-CAD</h3>
          {pendingCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-warning/15 text-warning">
              {pendingCount} en attente
            </span>
          )}
          {errorCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-error/15 text-error">
              {errorCount} erreur{errorCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
        {canManage && (
          <button
            onClick={() => setShowNewForm(!showNewForm)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Nouvelle declaration
          </button>
        )}
      </div>

      {/* Chip number warning */}
      {!chipNumber && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3">
          <AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
          <p className="text-sm text-warning">
            {animalName} n&apos;a pas de numero de puce. L&apos;identification est necessaire avant toute declaration I-CAD.
          </p>
        </div>
      )}

      {/* New declaration form */}
      {showNewForm && canManage && (
        <div className="bg-surface rounded-xl border border-border p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">Type</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as IcadDeclarationType)}
                className={inputClass}
              >
                {declarationTypes.map((dt) => (
                  <option key={dt.value} value={dt.value}>{dt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">Notes</label>
              <input
                type="text"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Notes optionnelles..."
                className={inputClass}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowNewForm(false)}
              className="px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-surface-hover transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleCreate}
              disabled={isPending}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white gradient-primary hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isPending ? 'Creation...' : 'Creer'}
            </button>
          </div>
        </div>
      )}

      {/* Declarations list */}
      {declarations.length === 0 ? (
        <div className="text-center py-6">
          <Shield className="w-8 h-8 text-muted mx-auto mb-2" />
          <p className="text-sm text-muted">Aucune declaration I-CAD</p>
        </div>
      ) : (
        <div className="space-y-2">
          {declarations.map((decl) => (
            <div
              key={decl.id}
              className="bg-surface rounded-lg border border-border p-3 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* Status icon */}
                {decl.status === 'confirmed' && <CheckCircle className="w-4 h-4 text-success shrink-0" />}
                {decl.status === 'pending' && <Clock className="w-4 h-4 text-warning shrink-0" />}
                {decl.status === 'submitted' && <Send className="w-4 h-4 text-info shrink-0" />}
                {(decl.status === 'error' || decl.status === 'rejected') && <XCircle className="w-4 h-4 text-error shrink-0" />}
                {decl.status === 'not_required' && <Shield className="w-4 h-4 text-muted shrink-0" />}

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">
                      {getIcadDeclarationTypeLabel(decl.declaration_type)}
                    </span>
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getIcadStatusColor(decl.status)}`}>
                      {getIcadStatusLabel(decl.status)}
                    </span>
                  </div>
                  <div className="text-xs text-muted mt-0.5">
                    {formatDateShort(decl.created_at)}
                    {decl.icad_reference && <span className="ml-2">Ref: {decl.icad_reference}</span>}
                    {decl.error_message && <span className="ml-2 text-error">{decl.error_message}</span>}
                  </div>
                </div>
              </div>

              {/* Quick actions */}
              {canManage && (decl.status === 'pending' || decl.status === 'error') && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleStatusChange(decl.id, 'submitted')}
                    disabled={pendingAction === decl.id}
                    className="px-2 py-1 rounded text-xs font-medium bg-info/10 text-info hover:bg-info/20 transition-colors disabled:opacity-50"
                    title="Marquer comme soumise"
                  >
                    Soumise
                  </button>
                  <button
                    onClick={() => handleStatusChange(decl.id, 'confirmed')}
                    disabled={pendingAction === decl.id}
                    className="px-2 py-1 rounded text-xs font-medium bg-success/10 text-success hover:bg-success/20 transition-colors disabled:opacity-50"
                    title="Marquer comme confirmee"
                  >
                    Confirmee
                  </button>
                  <button
                    onClick={() => handleStatusChange(decl.id, 'not_required')}
                    disabled={pendingAction === decl.id}
                    className="px-2 py-1 rounded text-xs font-medium bg-muted/10 text-muted hover:bg-muted/20 transition-colors disabled:opacity-50"
                    title="Non requise"
                  >
                    N/A
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
