'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Plus,
  Pencil,
  Trash2,
  FileDown,
  Home,
  Calendar,
  User,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { FosterContractForm } from '@/components/foster-contracts/foster-contract-form'
import { deleteFosterContract } from '@/lib/actions/foster-contracts'
import { formatDateShort } from '@/lib/utils'
import type { FosterContract, FosterContractStatus } from '@/lib/types/database'

interface FosterContractWithRelations extends FosterContract {
  foster?: {
    id: string
    name: string
    email: string | null
    phone: string | null
    city: string | null
  }
}

interface FosterContractsTabProps {
  animalId: string
  contracts: FosterContractWithRelations[]
  canManage: boolean
}

const statusLabels: Record<FosterContractStatus, string> = {
  draft: 'Brouillon',
  active: 'Actif',
  ended: 'Termine',
  cancelled: 'Annule',
}

const statusStyles: Record<FosterContractStatus, string> = {
  draft: 'bg-muted/15 text-muted',
  active: 'bg-success/15 text-success',
  ended: 'bg-info/15 text-info',
  cancelled: 'bg-warning/15 text-warning',
}

export function FosterContractsTab({ animalId, contracts, canManage }: Readonly<FosterContractsTabProps>) {
  const [showForm, setShowForm] = useState(false)
  const [editingContract, setEditingContract] = useState<FosterContractWithRelations | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleEdit(contract: FosterContractWithRelations) {
    setEditingContract(contract)
    setShowForm(true)
  }

  function handleNewContract() {
    setEditingContract(null)
    setShowForm(true)
  }

  function handleClose() {
    setShowForm(false)
    setEditingContract(null)
  }

  function handleDelete(contractId: string) {
    if (!window.confirm('Supprimer ce contrat FA ? Cette action est irreversible.')) return
    setDeletingId(contractId)
    startTransition(async () => {
      const result = await deleteFosterContract(contractId)
      setDeletingId(null)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Contrat supprime')
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
            onClick={handleNewContract}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold gradient-primary text-white hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Nouveau contrat FA
          </button>
        </div>
      )}

      {showForm && canManage && (
        <div className="bg-surface rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold mb-4">
            {editingContract ? `Modifier le contrat ${editingContract.contract_number}` : 'Nouveau contrat FA'}
          </h3>
          <FosterContractForm
            animalId={animalId}
            contract={editingContract || undefined}
            onClose={handleClose}
          />
        </div>
      )}

      {contracts.length === 0 && !showForm ? (
        <div className="bg-surface rounded-xl border border-border p-8 text-center">
          <Home className="w-8 h-8 text-muted/30 mx-auto mb-3" />
          <p className="text-sm text-muted">Aucun contrat de placement en famille d’accueil enregistre.</p>
          {!canManage && (
            <p className="text-xs text-muted mt-1">Vous n’avez pas la permission de creer un contrat.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {contracts.map((c) => (
            <div key={c.id} className="bg-surface rounded-xl border border-border p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base font-semibold">{c.contract_number}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusStyles[c.status]}`}>
                      {statusLabels[c.status]}
                    </span>
                    {c.signed_at && (
                      <span className="inline-flex items-center gap-1 text-xs text-success">
                        <CheckCircle2 className="w-3 h-3" />
                        Signe le {formatDateShort(c.signed_at)}
                      </span>
                    )}
                    {c.status === 'draft' && !c.signed_at && (
                      <span className="inline-flex items-center gap-1 text-xs text-warning">
                        <AlertCircle className="w-3 h-3" />
                        Non signe
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <a
                    href={`/api/pdf/foster-contract/${c.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                    title="Telecharger / imprimer le contrat"
                  >
                    <FileDown className="w-4 h-4" />
                  </a>
                  {canManage && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleEdit(c)}
                        className="p-2 rounded-lg text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                        title="Modifier"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(c.id)}
                        disabled={isPending && deletingId === c.id}
                        className="p-2 rounded-lg text-muted hover:text-error hover:bg-error/10 transition-colors disabled:opacity-50"
                        title="Supprimer"
                      >
                        {isPending && deletingId === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="flex items-start gap-2 text-muted">
                  <User className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-text">{c.foster?.name || '—'}</div>
                    {(c.foster?.city || c.foster?.phone) && (
                      <div className="text-xs">{[c.foster?.city, c.foster?.phone].filter(Boolean).join(' · ')}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-2 text-muted">
                  <Calendar className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <div>Du {formatDateShort(c.start_date)}</div>
                    {c.expected_end_date && <div className="text-xs">Fin previsionnelle : {formatDateShort(c.expected_end_date)}</div>}
                    {c.actual_end_date && <div className="text-xs text-info">Termine le {formatDateShort(c.actual_end_date)}</div>}
                  </div>
                </div>
              </div>

              {(c.special_conditions || c.other_animals_at_home) && (
                <div className="mt-3 pt-3 border-t border-border space-y-1 text-xs text-muted">
                  {c.other_animals_at_home && <div><span className="font-semibold text-text">Autres animaux : </span>{c.other_animals_at_home}</div>}
                  {c.special_conditions && <div><span className="font-semibold text-text">Conditions : </span>{c.special_conditions}</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
