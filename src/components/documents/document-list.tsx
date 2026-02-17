'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { deleteDocument, convertDevisToFacture, updateDocumentStatus } from '@/lib/actions/documents'
import { StatusBadge, TypeBadge } from './status-badge'
import { formatCurrency, formatDateShort } from '@/lib/utils'
import type { Document, DocumentStatus } from '@/lib/types/database'

export function DocumentList({ initialData }: { initialData: Document[] }) {
  const [documents, setDocuments] = useState<Document[]>(initialData)
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [isPending, startTransition] = useTransition()
  const supabase = createClient()

  async function applyFilters(type: string, status: string) {
    let query = supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false })

    if (type) query = query.eq('type', type)
    if (status) query = query.eq('status', status)

    const { data } = await query
    if (data) setDocuments(data as Document[])
  }

  function handleTypeChange(value: string) {
    setTypeFilter(value)
    applyFilters(value, statusFilter)
  }

  function handleStatusChange(value: string) {
    setStatusFilter(value)
    applyFilters(typeFilter, value)
  }

  function handleDelete(id: string, numero: string) {
    if (!confirm(`Supprimer le document ${numero} ?`)) return
    startTransition(async () => {
      const result = await deleteDocument(id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Document ${numero} supprime`)
        setDocuments((prev) => prev.filter((d) => d.id !== id))
      }
    })
  }

  function handleConvert(id: string) {
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

  function handleStatusUpdate(id: string, status: DocumentStatus) {
    startTransition(async () => {
      const result = await updateDocumentStatus(id, status)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Statut mis a jour')
        applyFilters(typeFilter, statusFilter)
      }
    })
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
        </select>

        <select
          value={statusFilter}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="px-3 py-2 bg-surface-dark border border-border rounded-lg text-sm focus:border-primary"
        >
          <option value="">Tous les statuts</option>
          <option value="draft">Brouillon</option>
          <option value="sent">Envoye</option>
          <option value="paid">Paye</option>
          <option value="cancelled">Annule</option>
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
                    <select
                      value={doc.status}
                      onChange={(e) => handleStatusUpdate(doc.id, e.target.value as DocumentStatus)}
                      className="bg-transparent border-none text-xs cursor-pointer p-0"
                    >
                      <option value="draft">Brouillon</option>
                      <option value="sent">Envoye</option>
                      <option value="paid">Paye</option>
                      <option value="cancelled">Annule</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* PDF */}
                      <a
                        href={`/api/pdf/${doc.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 rounded text-xs font-medium bg-success/15 text-success hover:bg-success/25 transition-colors"
                      >
                        PDF
                      </a>

                      {/* Convert */}
                      {doc.type === 'devis' && !doc.converted_to_id && (
                        <button
                          onClick={() => handleConvert(doc.id)}
                          disabled={isPending}
                          className="px-2 py-1 rounded text-xs font-medium bg-warning/15 text-warning hover:bg-warning/25 transition-colors disabled:opacity-50"
                        >
                          → Facture
                        </button>
                      )}

                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(doc.id, doc.numero)}
                        disabled={isPending}
                        className="px-2 py-1 rounded text-xs font-medium bg-danger/15 text-danger hover:bg-danger/25 transition-colors disabled:opacity-50"
                      >
                        Suppr.
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
