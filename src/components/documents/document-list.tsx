'use client'

import { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { deleteDocument, convertDevisToFacture, updateDocumentStatus, cancelFactureWithAvoir } from '@/lib/actions/documents'
import { StatusBadge, TypeBadge } from './status-badge'
import { formatCurrency, formatDateShort } from '@/lib/utils'
import type { Document, DocumentStatus, DocumentPaymentMethod } from '@/lib/types/database'

const PAYMENT_METHODS: { value: DocumentPaymentMethod; label: string }[] = [
  { value: 'cheque', label: 'Cheque' },
  { value: 'virement', label: 'Virement bancaire' },
  { value: 'especes', label: 'Especes' },
  { value: 'cb', label: 'Carte bancaire' },
  { value: 'prelevement', label: 'Prelevement' },
  { value: 'autre', label: 'Autre' },
]

function paymentMethodLabel(method: string | null): string | null {
  if (!method) return null
  return PAYMENT_METHODS.find(m => m.value === method)?.label ?? method
}

function isEditable(doc: Document): boolean {
  if (doc.type === 'devis' && doc.status !== 'converted') return true
  if (doc.type === 'facture' && doc.status === 'draft') return true
  return false
}

interface DocumentListProps {
  readonly initialData: Document[]
  readonly canEdit: boolean
  readonly establishmentId: string
}

export function DocumentList({ initialData, canEdit, establishmentId }: DocumentListProps) {
  const [documents, setDocuments] = useState<Document[]>(initialData)
  const [typeFilter, setTypeFilter] = useState('')

  useEffect(() => { setDocuments(initialData) }, [initialData])
  const [statusFilter, setStatusFilter] = useState('')
  const [isPending, startTransition] = useTransition()
  const supabase = createClient()

  // Payment dialog state
  const [paymentDialog, setPaymentDialog] = useState<{ docId: string; numero: string } | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<DocumentPaymentMethod>('cb')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])

  const applyFilters = async (type: string, status: string) => {
    let query = supabase
      .from('documents')
      .select('*')
      .eq('establishment_id', establishmentId)
      .order('created_at', { ascending: false })

    if (type) query = query.eq('type', type)
    if (status) {
      query = query.eq('status', status)
    } else {
      query = query.neq('status', 'converted')
    }

    const { data } = await query
    if (data) setDocuments(data as Document[])
  }

  const handleTypeChange = (value: string) => {
    setTypeFilter(value)
    applyFilters(value, statusFilter)
  }

  const handleStatusChange = (value: string) => {
    setStatusFilter(value)
    applyFilters(typeFilter, value)
  }

  const deleteDocumentAction = async (id: string, numero: string) => {
    const result = await deleteDocument(id)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(`Document ${numero} supprime`)
      setDocuments((prev) => prev.filter((d) => d.id !== id))
    }
  }

  const handleDelete = (id: string, numero: string) => {
    if (!confirm(`Supprimer le document ${numero} ?`)) return
    startTransition(() => deleteDocumentAction(id, numero))
  }

  const handleConvert = (id: string) => {
    if (!confirm('Convertir ce devis en facture ?')) return
    startTransition(async () => {
      const result = await convertDevisToFacture(id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Facture ${result.data!.numero} creee`)
        applyFilters(typeFilter, statusFilter)
      }
    })
  }

  const handleStatusUpdate = (id: string, status: DocumentStatus, numero?: string) => {
    if (status === 'paid' && numero) {
      setPaymentDialog({ docId: id, numero })
      setPaymentMethod('cb')
      setPaymentDate(new Date().toISOString().split('T')[0])
      return
    }
    startTransition(async () => {
      const result = await updateDocumentStatus(id, status)
      if ('error' in result && result.error) {
        toast.error(result.error)
      } else {
        if ('data' in result && result.data) {
          toast.success(`Facture annulee. Avoir ${result.data.numero} genere`)
        } else {
          toast.success('Statut mis a jour')
        }
        applyFilters(typeFilter, statusFilter)
      }
    })
  }

  const confirmPayment = () => {
    if (!paymentDialog) return
    startTransition(async () => {
      const result = await updateDocumentStatus(paymentDialog.docId, 'paid', {
        payment_method: paymentMethod,
        payment_date: paymentDate,
      })
      if ('error' in result && result.error) {
        toast.error(result.error)
      } else {
        toast.success(`${paymentDialog.numero} marquee comme payee (${paymentMethodLabel(paymentMethod)})`)
        applyFilters(typeFilter, statusFilter)
      }
      setPaymentDialog(null)
    })
  }

  const handleCancelWithAvoir = (id: string, numero: string) => {
    if (!confirm(`Annuler la facture ${numero} ? Un avoir sera automatiquement genere.`)) return
    startTransition(async () => {
      const result = await cancelFactureWithAvoir(id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Facture annulee. Avoir ${result.data!.numero} genere`)
        applyFilters(typeFilter, statusFilter)
      }
    })
  }

  const handleValidate = (id: string) => {
    if (!confirm('Valider cette facture ? Elle ne pourra plus etre modifiee.')) return
    handleStatusUpdate(id, 'validated')
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={typeFilter}
          onChange={(e) => handleTypeChange(e.target.value)}
          className="px-3 py-2 bg-surface-dark border border-border rounded-lg text-sm focus:border-primary"
        >
          <option value="">Tous les types</option>
          <option value="devis">Devis</option>
          <option value="facture">Factures</option>
          <option value="avoir">Avoirs</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="px-3 py-2 bg-surface-dark border border-border rounded-lg text-sm focus:border-primary"
        >
          <option value="">Tous les statuts</option>
          <option value="draft">Brouillon</option>
          <option value="validated">Validee</option>
          <option value="sent">Envoye</option>
          <option value="paid">Paye</option>
          <option value="cancelled">Annule</option>
          <option value="converted">Converti</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-hover/50">
              <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Type</th>
              <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Numero</th>
              <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Date</th>
              <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Client</th>
              <th className="text-right px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Total</th>
              <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Statut</th>
              <th className="text-right px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {documents.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted">
                  Aucun document trouve
                </td>
              </tr>
            ) : (
              documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-surface-hover/30 transition-colors">
                  <td className="px-4 py-3"><TypeBadge type={doc.type} /></td>
                  <td className="px-4 py-3 font-medium">{doc.numero}</td>
                  <td className="px-4 py-3 text-muted">{formatDateShort(doc.date)}</td>
                  <td className="px-4 py-3">{doc.client_name}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatCurrency(doc.total)}</td>
                  <td className="px-4 py-3">
                    {/* Read-only statuses or no edit permission */}
                    {(!canEdit || doc.status === 'converted' || doc.type === 'avoir' || doc.status === 'cancelled') && (
                      <StatusBadge status={doc.status} />
                    )}
                    {canEdit && doc.status !== 'converted' && doc.type !== 'avoir' && doc.status !== 'cancelled' && doc.type === 'facture' && (
                      <div className="flex items-center gap-1.5">
                        <select
                          value={doc.status}
                          onChange={(e) => handleStatusUpdate(doc.id, e.target.value as DocumentStatus, doc.numero)}
                          className="bg-transparent border-none text-xs cursor-pointer p-0"
                        >
                          <option value="draft" disabled={doc.status !== 'draft'}>Brouillon</option>
                          <option value="validated">Validee</option>
                          <option value="sent">Envoyee</option>
                          <option value="paid">Payee</option>
                          <option value="cancelled">Annulee</option>
                        </select>
                        {doc.status === 'paid' && doc.payment_method && (
                          <span className="text-[10px] text-muted bg-surface-dark px-1.5 py-0.5 rounded">
                            {paymentMethodLabel(doc.payment_method)}
                          </span>
                        )}
                      </div>
                    )}
                    {canEdit && doc.status !== 'converted' && doc.type !== 'avoir' && doc.status !== 'cancelled' && doc.type !== 'facture' && (
                      <select
                        value={doc.status}
                        onChange={(e) => handleStatusUpdate(doc.id, e.target.value as DocumentStatus)}
                        className="bg-transparent border-none text-xs cursor-pointer p-0"
                      >
                        <option value="draft">Brouillon</option>
                        <option value="sent">Envoye</option>
                        <option value="cancelled">Annule</option>
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* Edit */}
                      {canEdit && isEditable(doc) && (
                        <Link
                          href={`/documents/${doc.id}/edit`}
                          className="px-2 py-1 rounded text-xs font-medium bg-primary/15 text-primary hover:bg-primary/25 transition-colors"
                        >
                          Modifier
                        </Link>
                      )}

                      {/* PDF */}
                      <a
                        href={`/api/pdf/${doc.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 rounded text-xs font-medium bg-success/15 text-success hover:bg-success/25 transition-colors"
                      >
                        PDF
                      </a>

                      {/* Validate - only for draft factures */}
                      {canEdit && doc.type === 'facture' && doc.status === 'draft' && (
                        <button
                          onClick={() => handleValidate(doc.id)}
                          disabled={isPending}
                          className="px-2 py-1 rounded text-xs font-medium bg-primary/15 text-primary hover:bg-primary/25 transition-colors disabled:opacity-50"
                        >
                          Valider
                        </button>
                      )}

                      {/* Convert devis to facture */}
                      {canEdit && doc.type === 'devis' && !doc.converted_to_id && doc.status !== 'converted' && (
                        <button
                          onClick={() => handleConvert(doc.id)}
                          disabled={isPending}
                          className="px-2 py-1 rounded text-xs font-medium bg-warning/15 text-warning hover:bg-warning/25 transition-colors disabled:opacity-50"
                        >
                          &rarr; Facture
                        </button>
                      )}

                      {/* Delete - only for draft documents (not avoir) */}
                      {canEdit && doc.status === 'draft' && doc.type !== 'avoir' && (
                        <button
                          onClick={() => handleDelete(doc.id, doc.numero)}
                          disabled={isPending}
                          className="px-2 py-1 rounded text-xs font-medium bg-danger/15 text-danger hover:bg-danger/25 transition-colors disabled:opacity-50"
                        >
                          Suppr.
                        </button>
                      )}

                      {/* Cancel facture with avoir - for non-draft factures */}
                      {canEdit && doc.type === 'facture' && ['validated', 'sent', 'paid'].includes(doc.status) && !doc.cancelled_by_id && (
                        <button
                          onClick={() => handleCancelWithAvoir(doc.id, doc.numero)}
                          disabled={isPending}
                          className="px-2 py-1 rounded text-xs font-medium bg-danger/15 text-danger hover:bg-danger/25 transition-colors disabled:opacity-50"
                        >
                          Annuler
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Payment method dialog */}
      {paymentDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-surface rounded-xl border border-border p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-sm font-semibold mb-4">
              Paiement — {paymentDialog.numero}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                  Methode de paiement
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as DocumentPaymentMethod)}
                  className="w-full px-3 py-2 bg-surface-dark border border-border rounded-lg text-sm focus:border-primary"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                  Date de paiement
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-dark border border-border rounded-lg text-sm focus:border-primary"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setPaymentDialog(null)}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-surface-dark text-muted border border-border hover:bg-surface-hover transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={confirmPayment}
                disabled={isPending}
                className="flex-1 py-2 rounded-lg text-sm font-medium text-white bg-success hover:bg-success/90 transition-colors disabled:opacity-50"
              >
                {isPending ? 'Enregistrement...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
