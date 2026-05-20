'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Pencil,
  Trash2,
  FileDown,
  Heart,
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
  Euro,
  Info,
  RotateCcw,
} from 'lucide-react'
import { AdoptionContractForm } from '@/components/adoption-contracts/adoption-contract-form'
import { AdoptionReturnModal } from '@/components/adoption-contracts/adoption-return-modal'
import { deleteAdoptionContract } from '@/lib/actions/adoption-contracts'
import { sendAdoptionContractForSignature, syncAdoptionContractSignatureStatus } from '@/lib/actions/adoption-contract-signature'
import {
  sendAdoptionCancellationForSignature,
  syncAdoptionCancellationSignatureStatus,
} from '@/lib/actions/adoption-cancellation-signature'
import { formatDateShort } from '@/lib/utils'
import type { AdoptionContract, AdoptionContractStatus, SignatureStatus } from '@/lib/types/database'

interface AdoptionContractWithRelations extends AdoptionContract {
  adopter?: {
    id: string
    name: string
    email: string | null
    phone: string | null
    city: string | null
  }
}

interface AdoptionContractsTabProps {
  animalId: string
  contracts: AdoptionContractWithRelations[]
  canManage: boolean
}

const statusLabels: Record<string, string> = {
  draft: 'Brouillon',
  active: 'Actif',
  trial_returned: 'Retour periode d\'accueil',
  finalized: 'Finalise',
  cancelled: 'Annulé',
}

const statusStyles: Record<string, string> = {
  draft: 'bg-muted/15 text-muted',
  active: 'bg-success/15 text-success',
  trial_returned: 'bg-amber-500/15 text-amber-500',
  finalized: 'bg-success/15 text-success',
  cancelled: 'bg-warning/15 text-warning',
}

const signatureStatusConfig: Record<SignatureStatus, { label: string; icon: typeof Mail; className: string }> = {
  not_sent:  { label: 'Non envoyé',           icon: Mail,         className: 'bg-muted/15 text-muted' },
  pending:   { label: 'En attente signature', icon: Clock,        className: 'bg-warning/15 text-warning' },
  viewed:    { label: "Consulté par l'adoptant", icon: Eye,        className: 'bg-info/15 text-info' },
  signed:    { label: 'Signé électroniquement', icon: CheckCircle2, className: 'bg-success/15 text-success' },
  rejected:  { label: 'Refusé',               icon: AlertCircle,  className: 'bg-error/15 text-error' },
  failed:    { label: 'Échec d’envoi',        icon: AlertCircle,  className: 'bg-error/15 text-error' },
}

function formatEuros(amount: number | null | undefined): string {
  if (amount == null) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)
}

export function AdoptionContractsTab({ animalId, contracts, canManage }: Readonly<AdoptionContractsTabProps>) {
  const [showForm, setShowForm] = useState(false)
  const [editingContract, setEditingContract] = useState<AdoptionContractWithRelations | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)
  const [returningContract, setReturningContract] = useState<AdoptionContractWithRelations | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleEdit(contract: AdoptionContractWithRelations) {
    setEditingContract(contract)
    setShowForm(true)
  }

  function handleClose() {
    setShowForm(false)
    setEditingContract(null)
  }

  function handleDelete(contractId: string) {
    if (!window.confirm("Supprimer ce contrat d'adoption ? Cette action est irréversible.")) return
    setDeletingId(contractId)
    startTransition(async () => {
      const result = await deleteAdoptionContract(contractId)
      setDeletingId(null)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Contrat supprimé')
        router.refresh()
      }
    })
  }

  function handleSendForSignature(contract: AdoptionContractWithRelations) {
    if (!contract.adopter?.email) {
      toast.error("L'adoptant n'a pas d'email enregistré")
      return
    }
    if (!window.confirm(`Envoyer le contrat ${contract.contract_number} pour signature électronique à ${contract.adopter.name} (${contract.adopter.email}) ?`)) return
    setActingId(contract.id)
    startTransition(async () => {
      const result = await sendAdoptionContractForSignature(contract.id)
      setActingId(null)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Contrat envoyé pour signature électronique')
        router.refresh()
      }
    })
  }

  function handleSyncSignature(contract: AdoptionContractWithRelations) {
    setActingId(contract.id)
    startTransition(async () => {
      const result = await syncAdoptionContractSignatureStatus(contract.id)
      setActingId(null)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Statut à jour : ${result.data?.status}`)
        router.refresh()
      }
    })
  }

  function handleSendCancellation(contract: AdoptionContractWithRelations) {
    if (!contract.adopter?.email) {
      toast.error("L'adoptant n'a pas d'email enregistré")
      return
    }
    if (!window.confirm(`Envoyer l'avenant d'annulation à ${contract.adopter.name} (${contract.adopter.email}) pour signature électronique ?`)) return
    setActingId(contract.id)
    startTransition(async () => {
      const result = await sendAdoptionCancellationForSignature(contract.id)
      setActingId(null)
      if ('error' in result && result.error) {
        toast.error(result.error)
      } else {
        toast.success('Avenant envoyé pour signature électronique')
        router.refresh()
      }
    })
  }

  function handleSyncCancellation(contract: AdoptionContractWithRelations) {
    setActingId(contract.id)
    startTransition(async () => {
      const result = await syncAdoptionCancellationSignatureStatus(contract.id)
      setActingId(null)
      if ('error' in result && result.error) {
        toast.error(result.error)
      } else {
        toast.success('Statut avenant à jour')
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-4">
      {!showForm && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-info/10 border border-info/20 text-xs text-info">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            Pour créer un nouveau contrat d&apos;adoption, ouvrez l&apos;onglet <strong>Mouvements</strong> et
            enregistrez une adoption : le contrat est généré et envoyé pour signature en une seule étape.
          </p>
        </div>
      )}

      {showForm && canManage && editingContract && (
        <div className="bg-surface rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold mb-4">
            Modifier le contrat {editingContract.contract_number}
          </h3>
          <AdoptionContractForm
            animalId={animalId}
            contract={editingContract}
            onClose={handleClose}
          />
        </div>
      )}

      {contracts.length === 0 && !showForm ? (
        <div className="bg-surface rounded-xl border border-border p-8 text-center">
          <Heart className="w-8 h-8 text-muted/30 mx-auto mb-3" />
          <p className="text-sm text-muted">Aucun contrat d&apos;adoption enregistré.</p>
          <p className="text-xs text-muted mt-1">
            Les contrats apparaissent ici lorsqu&apos;une adoption est enregistrée depuis l&apos;onglet Mouvements.
          </p>
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
                  <a
                    href={`/api/pdf/adoption-contract/${c.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                    title="Aperçu du contrat (PDF non signé)"
                  >
                    <FileDown className="w-4 h-4" />
                  </a>

                  {c.signed_pdf_url && (
                    <a
                      href={c.signed_pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg text-success hover:bg-success/10 transition-colors"
                      title="PDF signé (avec horodatage Documenso)"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </a>
                  )}

                  {canManage && (
                    <>
                      {c.signature_status === 'not_sent' && (
                        <button
                          type="button"
                          onClick={() => handleSendForSignature(c)}
                          disabled={isPending && actingId === c.id}
                          className="p-2 rounded-lg text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                          title="Envoyer pour signature électronique"
                        >
                          {isPending && actingId === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </button>
                      )}

                      {(c.signature_status === 'pending' || c.signature_status === 'viewed') && (
                        <button
                          type="button"
                          onClick={() => handleSyncSignature(c)}
                          disabled={isPending && actingId === c.id}
                          className="p-2 rounded-lg text-muted hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                          title="Mettre à jour le statut de signature depuis Documenso"
                        >
                          {isPending && actingId === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        </button>
                      )}

                      {(c.status === 'active' || c.status === 'finalized') && (
                        <button
                          type="button"
                          onClick={() => setReturningContract(c)}
                          className="p-2 rounded-lg text-amber-500 hover:bg-amber-500/10 transition-colors"
                          title="Retour pendant periode d'accueil"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}

                      {c.status === 'trial_returned' && (
                        <>
                          <a
                            href={c.cancellation_signed_pdf_url || `/api/pdf/adoption-cancellation/${c.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg text-amber-500 hover:bg-amber-500/10 transition-colors"
                            title={c.cancellation_signed_pdf_url ? 'Avenant signé (PDF)' : 'Aperçu avenant (PDF non signé)'}
                          >
                            <FileDown className="w-4 h-4" />
                          </a>

                          {(c.cancellation_signature_status === null ||
                            c.cancellation_signature_status === 'not_sent' ||
                            c.cancellation_signature_status === 'failed') && (
                            <button
                              type="button"
                              onClick={() => handleSendCancellation(c)}
                              disabled={isPending && actingId === c.id}
                              className="p-2 rounded-lg text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                              title="Envoyer l'avenant d'annulation pour signature"
                            >
                              {isPending && actingId === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            </button>
                          )}

                          {(c.cancellation_signature_status === 'pending' ||
                            c.cancellation_signature_status === 'viewed') && (
                            <button
                              type="button"
                              onClick={() => handleSyncCancellation(c)}
                              disabled={isPending && actingId === c.id}
                              className="p-2 rounded-lg text-muted hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                              title="Mettre à jour le statut de l'avenant"
                            >
                              {isPending && actingId === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                            </button>
                          )}
                        </>
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div className="flex items-start gap-2 text-muted">
                  <User className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-text">{c.adopter?.name || '—'}</div>
                    {(c.adopter?.city || c.adopter?.phone) && (
                      <div className="text-xs">{[c.adopter?.city, c.adopter?.phone].filter(Boolean).join(' · ')}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-2 text-muted">
                  <Calendar className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <div>Adopté le {formatDateShort(c.adoption_date)}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2 text-muted">
                  <Euro className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-text">{formatEuros(c.adoption_fee)}</div>
                    <div className="text-xs">Frais d'adoption</div>
                  </div>
                </div>
              </div>

              {c.status === 'trial_returned' && c.returned_at && (
                <div className="mt-3 pt-3 border-t border-border text-xs text-muted space-y-1">
                  <div>
                    <span className="font-semibold text-amber-500">Retour pendant periode d&apos;accueil </span>
                    enregistre le {formatDateShort(c.returned_at)}
                    {c.refunded_amount != null && (
                      <> - rembourse : <span className="font-semibold text-text">{formatEuros(c.refunded_amount)}</span></>
                    )}
                  </div>
                  {c.return_reason && <div>Motif : {c.return_reason}</div>}
                  {c.cancellation_signature_status && c.cancellation_signature_status !== 'not_sent' && (() => {
                    const sigConfig = signatureStatusConfig[c.cancellation_signature_status]
                    if (!sigConfig) return null
                    const SigIcon = sigConfig.icon
                    return (
                      <div>
                        Avenant d&apos;annulation :{' '}
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${sigConfig.className}`}>
                          <SigIcon className="w-3 h-3" />
                          {sigConfig.label}
                        </span>
                      </div>
                    )
                  })()}
                </div>
              )}

              {(c.special_conditions || c.sterilization_required) && (
                <div className="mt-3 pt-3 border-t border-border space-y-1 text-xs text-muted">
                  {c.sterilization_required && c.sterilization_deadline && (
                    <div>
                      <span className="font-semibold text-text">Stérilisation : </span>
                      avant le {formatDateShort(c.sterilization_deadline)}
                      {c.sterilization_deposit ? ` (caution ${formatEuros(c.sterilization_deposit)})` : ''}
                    </div>
                  )}
                  {c.special_conditions && <div><span className="font-semibold text-text">Conditions : </span>{c.special_conditions}</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {returningContract && (
        <AdoptionReturnModal
          contractId={returningContract.id}
          contractNumber={returningContract.contract_number}
          animalName={(returningContract as { animal?: { name?: string } }).animal?.name ?? ''}
          adopterName={returningContract.adopter?.name ?? ''}
          onClose={() => setReturningContract(null)}
        />
      )}
    </div>
  )
}
