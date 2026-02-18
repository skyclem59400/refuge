'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createDocument, updateDocument } from '@/lib/actions/documents'
import { ClientSearch } from '@/components/clients/client-search'
import { formatCurrency } from '@/lib/utils'
import type { Client, Document, DocumentType, LineItem } from '@/lib/types/database'

const SERVICE_PRESETS = [
  { label: 'Mediation animale', description: 'Mediation animale' },
  { label: 'Visite', description: 'Visite' },
  { label: 'Anniversaire', description: "Organisation d'anniversaire" },
] as const

function getInitialLineItems(doc?: Document): LineItem[] {
  if (doc?.line_items && doc.line_items.length > 0) {
    return doc.line_items
  }
  if (!doc) return []
  // Legacy fallback: construct from old fields
  const items: LineItem[] = []
  if (doc.nb_adultes > 0) {
    items.push({
      description: 'Visite - Adultes',
      quantity: doc.nb_adultes,
      unit_price: doc.prix_adulte,
      total: doc.nb_adultes * doc.prix_adulte,
    })
  }
  if (doc.nb_enfants > 0) {
    items.push({
      description: 'Visite - Enfants',
      quantity: doc.nb_enfants,
      unit_price: doc.prix_enfant,
      total: doc.nb_enfants * doc.prix_enfant,
    })
  }
  return items
}

interface DocumentFormProps {
  document?: Document
  initialClient?: Client | null
  establishmentId: string
}

export function DocumentForm({ document: doc, initialClient, establishmentId }: DocumentFormProps) {
  const isEditing = !!doc
  const [type, setType] = useState<DocumentType>(doc?.type || 'devis')
  const [selectedClient, setSelectedClient] = useState<Client | null>(initialClient || null)
  const [lineItems, setLineItems] = useState<LineItem[]>(getInitialLineItems(doc))
  const [notes, setNotes] = useState(doc?.notes || '')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const total = lineItems.reduce((sum, item) => sum + item.total, 0)

  function addPreset(description: string) {
    setLineItems(prev => [...prev, {
      description,
      quantity: 1,
      unit_price: 0,
      total: 0,
    }])
  }

  function addCustomLine() {
    setLineItems(prev => [...prev, {
      description: '',
      quantity: 1,
      unit_price: 0,
      total: 0,
    }])
  }

  function updateLineItem(index: number, field: keyof LineItem, value: string | number) {
    setLineItems(prev => {
      const updated = [...prev]
      const item = { ...updated[index] }
      if (field === 'description') {
        item.description = value as string
      } else if (field === 'quantity') {
        item.quantity = typeof value === 'string' ? parseInt(value) || 0 : value
        item.total = item.quantity * item.unit_price
      } else if (field === 'unit_price') {
        item.unit_price = typeof value === 'string' ? parseFloat(value) || 0 : value
        item.total = item.quantity * item.unit_price
      }
      updated[index] = item
      return updated
    })
  }

  function removeLineItem(index: number) {
    setLineItems(prev => prev.filter((_, i) => i !== index))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!selectedClient) {
      toast.error('Veuillez selectionner un client')
      return
    }

    if (lineItems.length === 0) {
      toast.error('Ajoutez au moins une prestation')
      return
    }

    startTransition(async () => {
      const payload = {
        client_id: selectedClient.id,
        client_name: selectedClient.name,
        client_email: selectedClient.email,
        client_address: selectedClient.address,
        client_postal_code: selectedClient.postal_code,
        client_city: selectedClient.city,
        line_items: lineItems,
        total,
        notes: notes || null,
      }

      const result = isEditing
        ? await updateDocument(doc!.id, payload)
        : await createDocument({ ...payload, type })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(
          isEditing
            ? `Document ${doc!.numero} mis a jour`
            : `${type === 'facture' ? 'Facture' : 'Devis'} ${result.data!.numero} cree`
        )
        router.push('/documents')
      }
    })
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-surface rounded-xl border border-border p-6 space-y-5">
        {/* Type */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
            Type de document
          </label>
          {isEditing ? (
            <div className={`inline-block px-3 py-1.5 rounded-lg text-sm font-medium ${
              type === 'facture'
                ? 'bg-success/15 text-success border border-success/30'
                : 'bg-warning/15 text-warning border border-warning/30'
            }`}>
              {type === 'facture' ? 'Facture' : 'Devis'} — {doc!.numero}
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setType('devis')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all
                  ${type === 'devis'
                    ? 'bg-warning/15 text-warning border border-warning/30'
                    : 'bg-surface-dark text-muted border border-border hover:border-warning/30'}`}
              >
                Devis
              </button>
              <button
                type="button"
                onClick={() => setType('facture')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all
                  ${type === 'facture'
                    ? 'bg-success/15 text-success border border-success/30'
                    : 'bg-surface-dark text-muted border border-border hover:border-success/30'}`}
              >
                Facture
              </button>
            </div>
          )}
        </div>

        {/* Client */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
            Client
          </label>
          <ClientSearch selected={selectedClient} onSelect={setSelectedClient} establishmentId={establishmentId} />
        </div>

        {/* Prestations */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
            Prestations
          </label>

          {/* Preset buttons */}
          <div className="flex flex-wrap gap-2 mb-3">
            {SERVICE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => addPreset(preset.description)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary
                  border border-primary/20 hover:bg-primary/20 transition-colors"
              >
                + {preset.label}
              </button>
            ))}
            <button
              type="button"
              onClick={addCustomLine}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-dark text-muted
                border border-border hover:border-primary/30 transition-colors"
            >
              + Personnalise
            </button>
          </div>

          {/* Line items */}
          <div className="space-y-2">
            {lineItems.map((item, index) => (
              <div key={index} className="flex items-center gap-2 p-2 bg-surface-dark rounded-lg border border-border">
                <input
                  type="text"
                  value={item.description}
                  onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                  placeholder="Description"
                  className="flex-1 min-w-0 px-3 py-2 bg-transparent border-none text-sm
                    focus:outline-none placeholder:text-muted/50"
                />
                <input
                  type="number"
                  min="0"
                  value={item.quantity || ''}
                  onChange={(e) => updateLineItem(index, 'quantity', e.target.value)}
                  placeholder="Qte"
                  className="w-16 px-2 py-2 bg-surface border border-border rounded text-sm text-center
                    focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unit_price || ''}
                  onChange={(e) => updateLineItem(index, 'unit_price', e.target.value)}
                  placeholder="Prix"
                  className="w-20 px-2 py-2 bg-surface border border-border rounded text-sm text-right
                    focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                />
                <span className="w-20 text-sm font-semibold text-right tabular-nums shrink-0">
                  {formatCurrency(item.total)}
                </span>
                <button
                  type="button"
                  onClick={() => removeLineItem(index)}
                  className="p-1.5 text-muted hover:text-danger transition-colors shrink-0"
                  title="Supprimer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            ))}
            {lineItems.length === 0 && (
              <p className="text-sm text-muted/60 text-center py-4">
                Ajoutez une prestation avec les boutons ci-dessus
              </p>
            )}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes ou conditions..."
            rows={3}
            className="w-full px-4 py-2.5 bg-surface-dark border border-border rounded-lg text-sm resize-y
              focus:border-primary focus:ring-1 focus:ring-primary transition-colors
              placeholder:text-muted/50"
          />
        </div>

        {/* Total */}
        <div className="p-4 rounded-xl border-2 border-primary/30 bg-primary/5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">Total</span>
            <span className="text-2xl font-bold text-primary-light">{formatCurrency(total)}</span>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isPending || !selectedClient}
          className="w-full py-3 rounded-lg font-semibold text-white text-sm
            bg-primary hover:bg-primary-dark transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed
            shadow-lg shadow-primary/25"
        >
          {isPending
            ? (isEditing ? 'Enregistrement...' : 'Creation...')
            : (isEditing ? 'Enregistrer les modifications' : `Creer le ${type === 'facture' ? 'la facture' : 'devis'}`)}
        </button>
      </form>

      {/* Preview */}
      <div className="bg-surface rounded-xl border border-border p-6">
        <h3 className="font-semibold mb-4 text-muted text-xs uppercase tracking-wider">Apercu</h3>

        <div className="bg-white rounded-xl p-6 text-gray-800 text-sm">
          {/* Preview header */}
          <div className="mb-4 pb-3 border-b-2 border-indigo-500">
            <div className="flex justify-between items-end">
              <div>
                <h4 className="font-bold text-indigo-600 text-base">La Ferme O 4 Vents</h4>
                <p className="text-xs text-gray-500">Refuge pour animaux</p>
              </div>
              <span className={`px-3 py-1 rounded text-xs font-bold text-white ${
                type === 'facture' ? 'bg-green-500' : 'bg-amber-500'
              }`}>
                {type === 'facture' ? 'FACTURE' : 'DEVIS'}
              </span>
            </div>
          </div>

          {/* Client info */}
          {selectedClient && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="font-semibold text-sm">{selectedClient.name}</p>
              {selectedClient.email && <p className="text-xs text-gray-500">{selectedClient.email}</p>}
              {selectedClient.address && (
                <p className="text-xs text-gray-500">
                  {selectedClient.address}, {selectedClient.postal_code} {selectedClient.city}
                </p>
              )}
            </div>
          )}

          {/* Items */}
          <table className="w-full text-xs mb-4">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2">Description</th>
                <th className="text-right py-2">Qte</th>
                <th className="text-right py-2">P.U.</th>
                <th className="text-right py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-2">{item.description || 'Sans description'}</td>
                  <td className="text-right py-2">{item.quantity}</td>
                  <td className="text-right py-2">{item.unit_price.toFixed(2)} &euro;</td>
                  <td className="text-right py-2 font-semibold">{item.total.toFixed(2)} &euro;</td>
                </tr>
              ))}
              {lineItems.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-gray-400 text-xs">
                    Aucune prestation
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Total */}
          <div className="text-right p-3 bg-indigo-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">TVA non applicable - Art. 293 B du CGI</p>
            <p className="text-lg font-bold text-indigo-600">Total: {total.toFixed(2)} &euro;</p>
          </div>

          {notes && (
            <div className="mt-3 p-2 bg-amber-50 rounded text-xs text-amber-800">
              {notes}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
