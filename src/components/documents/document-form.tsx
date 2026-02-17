'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createDocument } from '@/lib/actions/documents'
import { ClientSearch } from '@/components/clients/client-search'
import { formatCurrency } from '@/lib/utils'
import type { Client, DocumentType } from '@/lib/types/database'

export function DocumentForm() {
  const [type, setType] = useState<DocumentType>('devis')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [nbAdultes, setNbAdultes] = useState(0)
  const [prixAdulte, setPrixAdulte] = useState(0)
  const [nbEnfants, setNbEnfants] = useState(0)
  const [prixEnfant, setPrixEnfant] = useState(0)
  const [notes, setNotes] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const totalAdultes = nbAdultes * prixAdulte
  const totalEnfants = nbEnfants * prixEnfant
  const total = totalAdultes + totalEnfants

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!selectedClient) {
      toast.error('Veuillez selectionner un client')
      return
    }

    startTransition(async () => {
      const result = await createDocument({
        type,
        client_id: selectedClient.id,
        client_name: selectedClient.name,
        client_email: selectedClient.email,
        client_address: selectedClient.address,
        client_postal_code: selectedClient.postal_code,
        client_city: selectedClient.city,
        nb_adultes: nbAdultes,
        prix_adulte: prixAdulte,
        nb_enfants: nbEnfants,
        prix_enfant: prixEnfant,
        total,
        notes: notes || null,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`${type === 'facture' ? 'Facture' : 'Devis'} ${result.data!.numero} cree`)
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
        </div>

        {/* Client */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
            Client
          </label>
          <ClientSearch selected={selectedClient} onSelect={setSelectedClient} />
        </div>

        {/* Adultes */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
            Adultes
          </label>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              min="0"
              value={nbAdultes || ''}
              onChange={(e) => setNbAdultes(parseInt(e.target.value) || 0)}
              placeholder="Nombre"
              className="px-4 py-2.5 bg-surface-dark border border-border rounded-lg text-sm
                focus:border-primary focus:ring-1 focus:ring-primary transition-colors
                placeholder:text-muted/50"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={prixAdulte || ''}
              onChange={(e) => setPrixAdulte(parseFloat(e.target.value) || 0)}
              placeholder="Prix unitaire"
              className="px-4 py-2.5 bg-surface-dark border border-border rounded-lg text-sm
                focus:border-primary focus:ring-1 focus:ring-primary transition-colors
                placeholder:text-muted/50"
            />
          </div>
        </div>

        {/* Enfants */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
            Enfants
          </label>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              min="0"
              value={nbEnfants || ''}
              onChange={(e) => setNbEnfants(parseInt(e.target.value) || 0)}
              placeholder="Nombre"
              className="px-4 py-2.5 bg-surface-dark border border-border rounded-lg text-sm
                focus:border-primary focus:ring-1 focus:ring-primary transition-colors
                placeholder:text-muted/50"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={prixEnfant || ''}
              onChange={(e) => setPrixEnfant(parseFloat(e.target.value) || 0)}
              placeholder="Prix unitaire"
              className="px-4 py-2.5 bg-surface-dark border border-border rounded-lg text-sm
                focus:border-primary focus:ring-1 focus:ring-primary transition-colors
                placeholder:text-muted/50"
            />
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
            <span className="text-2xl font-bold gradient-text">{formatCurrency(total)}</span>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isPending || !selectedClient}
          className="w-full py-3 rounded-lg font-semibold text-white text-sm
            gradient-primary hover:opacity-90 transition-opacity
            disabled:opacity-50 disabled:cursor-not-allowed
            shadow-lg shadow-primary/25"
        >
          {isPending ? 'Creation...' : `Creer le ${type === 'facture' ? 'la facture' : 'devis'}`}
        </button>
      </form>

      {/* Preview */}
      <div className="bg-surface rounded-xl border border-border p-6">
        <h3 className="font-semibold mb-4 text-muted text-xs uppercase tracking-wider">Apercu</h3>

        <div className="bg-white rounded-xl p-6 text-gray-800 text-sm">
          {/* Preview header */}
          <div className="text-center mb-6 pb-4 border-b-2 border-indigo-500/20">
            <p className="text-3xl mb-1">🏡</p>
            <h4 className="font-bold text-indigo-600">La Ferme O 4 Vents</h4>
            <p className="text-xs text-gray-500">Refuge pour animaux</p>
            <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold text-white ${
              type === 'facture' ? 'bg-green-500' : 'bg-amber-500'
            }`}>
              {type === 'facture' ? 'FACTURE' : 'DEVIS'}
            </span>
          </div>

          {/* Client info */}
          {selectedClient && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="font-semibold">{selectedClient.name}</p>
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
              {nbAdultes > 0 && (
                <tr className="border-b border-gray-100">
                  <td className="py-2">Visite - Adultes</td>
                  <td className="text-right py-2">{nbAdultes}</td>
                  <td className="text-right py-2">{prixAdulte.toFixed(2)} &euro;</td>
                  <td className="text-right py-2 font-semibold">{totalAdultes.toFixed(2)} &euro;</td>
                </tr>
              )}
              {nbEnfants > 0 && (
                <tr className="border-b border-gray-100">
                  <td className="py-2">Visite - Enfants</td>
                  <td className="text-right py-2">{nbEnfants}</td>
                  <td className="text-right py-2">{prixEnfant.toFixed(2)} &euro;</td>
                  <td className="text-right py-2 font-semibold">{totalEnfants.toFixed(2)} &euro;</td>
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
