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
  Send,
  RefreshCw,
  Eye,
  Mail,
  Clock,
} from 'lucide-react'
import { FosterContractForm } from '@/components/foster-contracts/foster-contract-form'
import { deleteFosterContract } from '@/lib/actions/foster-contracts'
import { sendContractForSignature, syncContractSignatureStatus } from '@/lib/actions/foster-contract-signature'
import { formatDateShort } from '@/lib/utils'
import type { FosterContract, FosterContractStatus, SignatureStatus } from '@/lib/types/database'

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

const signatureStatusConfig: Record<SignatureStatus, { label: string; icon: typeof Mail; className: string }> = {
  not_sent:  { label: 'Non envoye',         icon: Mail,         className: 'bg-muted/15 text-muted' },
  pending:   { label: 'En attente signature', icon: Clock,        className: 'bg-warning/15 text-warning' },
  viewed:    { label: 'Consulte par la FA', icon: Eye,          className: 'bg-info/15 text-info' },
  signed:    { label: 'Signe electroniquement', icon: CheckCircle2, className: 'bg-success/15 text-success' },
  rejected:  { label: 'Refuse',             icon: AlertCircle,  className: 'bg-error/15 text-error' },
  failed:    { label: 'Echec d’envoi',   icon: AlertCircle,  className: 'bg-error/15 text-error' },
}

export function FosterContractsTab({ animalId, contracts, canManage }: Readonly<FosterContractsTabProps>) {
  const [showForm, setShowForm] = useState(false)
  const [editingContract, setEditingContract] = useState<FosterContractWithRelations | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)
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

  function handleSendForSignature(contract: FosterContractWithRelations) {
    if (!contract.foster?.email) {
      toast.error('La famille d’accueil n’a pas d’email enregistre')
      return
    }
    if (!window.confirm(`Envoyer le contrat ${contract.contract_number} pour signature electronique a ${contract.foster.name} (${contract.foster.email}) ?`)) return
    setActingId(contract.id)
    startTransition(async () => {
      const result = await sendContractForSignature(contract.id)
      setActingId(null)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Contrat envoye pour signature electronique')
        router.refresh()
      }
    })
  }

  function handleSyncSignature(contract: FosterContractWithRelations) {
    setActingId(contract.id)
    startTransition(async () => {
      const result = await syncContractSignatureStatus(contract.id)
      setActingId(null)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Statut a jour : ${result.data?.status}`)
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
                    {(() => {
                      const sigConfig = signatureStatusConfig[c.signature_status]
                      const SigIcon = sigConfig.icon
                      return (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${sigConfig.className}`}>
                          <SigIcon className="w-3 h-3" />
                          {sigConfig.label}
                        </span>
                      )
                    })()}
                    {c.signed_at_via_documenso && (
                      <span className="text-xs text-muted">
                        le {formatDateShort(c.signed_at_via_documenso)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {/* Voir le PDF original (template) */}
                  <a
                    href={`/api/pdf/foster-contract/${c.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                    title="Apercu du contrat (PDF non signe)"
                  >
                    <FileDown className="w-4 h-4" />
                  </a>

                  {/* Voir le PDF signe si dispo */}
                  {c.signed_pdf_url && (
                    <a
                      href={c.signed_pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg text-success hover:bg-success/10 transition-colors"
                      title="PDF signe (avec horodatage Documenso)"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </a>
                  )}

                  {canManage && (
                    <>
                      {/* Envoyer pour signature electronique */}
                      {c.signature_status === 'not_sent' && (
                        <button
                          type="button"
                          onClick={() => handleSendForSignature(c)}
                          disabled={isPending && actingId === c.id}
                          className="p-2 rounded-lg text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                          title="Envoyer pour signature electronique"
                        >
                          {isPending && actingId === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </button>
                      )}

                      {/* Sync statut depuis Documenso */}
                      {(c.signature_status === 'pending' || c.signature_status === 'viewed') && (
                        <button
                          type="button"
                          onClick={() => handleSyncSignature(c)}
                          disabled={isPending && actingId === c.id}
                          className="p-2 rounded-lg text-muted hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                          title="Mettre a jour le statut de signature depuis Documenso"
                        >
                          {isPending && actingId === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        </button>
                      )}

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
