'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Pencil, Trash2, FileDown, FileSignature, Calendar, User, Euro,
  Loader2, Plus, AlertCircle, Clock, CheckCircle2, X,
} from 'lucide-react'
import { AbandonmentContractForm } from '@/components/abandonment-contracts/abandonment-contract-form'
import { deleteAbandonmentContract } from '@/lib/actions/abandonment-contracts'
import { formatDateShort } from '@/lib/utils'
import {
  ABANDONMENT_MOTIF_LABELS,
  type AbandonmentContract,
  type AbandonmentContractStatus,
  type Client,
} from '@/lib/types/database'

type Cedant = Pick<Client, 'id' | 'kind' | 'name' | 'first_name' | 'email' | 'phone' | 'address' | 'postal_code' | 'city'>

interface AbandonmentContractWithRelations extends AbandonmentContract {
  cedant?: Cedant
}

interface Props {
  animalId: string
  establishmentId: string
  contracts: AbandonmentContractWithRelations[]
  canManage: boolean
}

const STATUS_LABELS: Record<AbandonmentContractStatus, string> = {
  draft: 'Brouillon',
  pending_signature: 'En attente signature',
  active: 'Signé / actif',
  handover_completed: 'Animal remis',
  cancelled: 'Annulé',
}

const STATUS_STYLES: Record<AbandonmentContractStatus, string> = {
  draft: 'bg-muted/15 text-muted',
  pending_signature: 'bg-warning/15 text-warning',
  active: 'bg-success/15 text-success',
  handover_completed: 'bg-primary/15 text-primary',
  cancelled: 'bg-error/15 text-error',
}

function formatEuros(amount: number | null | undefined): string {
  if (amount == null || amount === 0) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)
}

function fullCedantName(c?: Cedant): string {
  if (!c) return '—'
  if (c.kind === 'organization' || !c.first_name) return c.name
  return `${c.name} ${c.first_name}`
}

export function AbandonmentContractsTab({ animalId, establishmentId, contracts, canManage }: Readonly<Props>) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [editingContract, setEditingContract] = useState<AbandonmentContractWithRelations | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function openCreate() { setEditingContract(null); setShowForm(true) }
  function openEdit(c: AbandonmentContractWithRelations) { setEditingContract(c); setShowForm(true) }
  function closeForm() { setShowForm(false); setEditingContract(null) }

  function handleDelete(id: string) {
    if (!window.confirm('Supprimer ce contrat d\'abandon ?')) return
    setDeletingId(id)
    startTransition(async () => {
      const result = await deleteAbandonmentContract(id)
      setDeletingId(null)
      if (result.error) toast.error(result.error)
      else { toast.success('Contrat supprimé'); router.refresh() }
    })
  }

  return (
    <div className="space-y-4">
      {/* Header + bouton créer */}
      {!showForm && canManage && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted">
            Contrats d&apos;abandon à distance par anticipation pour cet animal.
          </p>
          <button type="button" onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg gradient-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity">
            <Plus className="w-4 h-4" />
            Préparer un abandon
          </button>
        </div>
      )}

      {/* Form de création / édition */}
      {showForm && canManage && (
        <div className="bg-surface rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">
              {editingContract ? `Modifier ${editingContract.contract_number}` : 'Nouveau contrat d\'abandon'}
            </h3>
            <button type="button" onClick={closeForm} className="text-muted hover:text-foreground p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
          <AbandonmentContractForm
            animalId={animalId}
            establishmentId={establishmentId}
            contract={editingContract ?? undefined}
            onClose={closeForm}
          />
        </div>
      )}

      {/* Liste */}
      {contracts.length === 0 && !showForm ? (
        <div className="bg-surface rounded-xl border border-border p-8 text-center">
          <FileSignature className="w-8 h-8 text-muted/30 mx-auto mb-3" />
          <p className="text-sm text-muted">Aucun contrat d&apos;abandon enregistré.</p>
          {canManage && (
            <p className="text-xs text-muted mt-1">
              Préparez un abandon par anticipation pour cet animal avec le bouton ci-dessus.
            </p>
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
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_STYLES[c.status]}`}>
                      {STATUS_LABELS[c.status]}
                    </span>
                    {c.signature_status === 'signed' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-success/15 text-success">
                        <CheckCircle2 className="w-3 h-3" />
                        Signé
                      </span>
                    )}
                    {c.signature_status === 'pending' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-warning/15 text-warning">
                        <Clock className="w-3 h-3" />
                        En attente signature
                      </span>
                    )}
                    {c.signature_status === 'rejected' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-error/15 text-error">
                        <AlertCircle className="w-3 h-3" />
                        Refusé
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <a href={`/api/pdf/abandonment-contract/${c.id}`} target="_blank" rel="noopener noreferrer"
                    className="p-2 rounded-lg text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                    title="Aperçu PDF">
                    <FileDown className="w-4 h-4" />
                  </a>
                  {canManage && (
                    <>
                      <button type="button" onClick={() => openEdit(c)}
                        className="p-2 rounded-lg text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                        title="Modifier">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => handleDelete(c.id)}
                        disabled={isPending && deletingId === c.id}
                        className="p-2 rounded-lg text-muted hover:text-error hover:bg-error/10 transition-colors disabled:opacity-50"
                        title="Supprimer">
                        {isPending && deletingId === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div className="flex items-start gap-2 text-muted">
                  <User className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-text">{fullCedantName(c.cedant)}</div>
                    {(c.cedant?.city || c.cedant?.phone) && (
                      <div className="text-xs">{[c.cedant?.city, c.cedant?.phone].filter(Boolean).join(' · ')}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-2 text-muted">
                  <Calendar className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <div>Contrat du {formatDateShort(c.signature_date)}</div>
                    {c.expected_handover_date && (
                      <div className="text-xs">Remise prévue : {formatDateShort(c.expected_handover_date)}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-2 text-muted">
                  <Euro className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-text">{formatEuros(c.amount)}</div>
                    <div className="text-xs">{ABANDONMENT_MOTIF_LABELS[c.motif]}</div>
                  </div>
                </div>
              </div>

              {(c.note || c.motif_details) && (
                <div className="mt-3 pt-3 border-t border-border space-y-1 text-xs text-muted">
                  {c.motif_details && (
                    <div><span className="font-semibold text-text">Précisions motif : </span>{c.motif_details}</div>
                  )}
                  {c.note && <div><span className="font-semibold text-text">Note : </span>{c.note}</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
