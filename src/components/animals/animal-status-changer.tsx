'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowRightLeft, Loader2, X, AlertTriangle } from 'lucide-react'
import { recordMovement } from '@/lib/actions/animals'
import { ClientSearch } from '@/components/clients/client-search'
import type { AnimalStatus, MovementType, IcadStatus, Client } from '@/lib/types/database'

interface AnimalStatusChangerProps {
  animalId: string
  animalName: string
  currentStatus: AnimalStatus
  establishmentId: string
}

const movementsByStatus: Record<string, { value: MovementType; label: string; danger?: boolean }[]> = {
  pound: [
    { value: 'shelter_transfer', label: 'Transfert en refuge' },
    { value: 'foster_placement', label: 'Placement en famille d’accueil' },
    { value: 'reservation', label: 'Réservation' },
    { value: 'adoption', label: 'Adoption (directe)' },
    { value: 'return_to_owner', label: 'Restitution au proprietaire' },
    { value: 'transfer_out', label: 'Transfert vers autre refuge' },
    { value: 'death', label: 'Deces', danger: true },
    { value: 'euthanasia', label: 'Euthanasie', danger: true },
  ],
  shelter: [
    { value: 'foster_placement', label: 'Placement en famille d’accueil' },
    { value: 'reservation', label: 'Réservation' },
    { value: 'adoption', label: 'Adoption' },
    { value: 'return_to_owner', label: 'Restitution au proprietaire' },
    { value: 'transfer_out', label: 'Transfert vers autre refuge' },
    { value: 'death', label: 'Deces', danger: true },
    { value: 'euthanasia', label: 'Euthanasie', danger: true },
  ],
  foster_family: [
    { value: 'shelter_transfer', label: 'Retour au refuge' },
    { value: 'reservation', label: 'Réservation' },
    { value: 'adoption', label: 'Adoption' },
    { value: 'return_to_owner', label: 'Restitution au proprietaire' },
    { value: 'transfer_out', label: 'Transfert vers autre refuge' },
    { value: 'death', label: 'Deces', danger: true },
    { value: 'euthanasia', label: 'Euthanasie', danger: true },
  ],
  boarding: [
    { value: 'shelter_transfer', label: 'Retour au refuge' },
    { value: 'foster_placement', label: 'Placement en famille d’accueil' },
    { value: 'return_to_owner', label: 'Restitution au proprietaire' },
    { value: 'death', label: 'Deces', danger: true },
  ],
  adopted: [
    { value: 'shelter_transfer', label: 'Retour au refuge (retour adoption)' },
    { value: 'death', label: 'Deces', danger: true },
  ],
  returned: [
    { value: 'shelter_transfer', label: 'Placement en refuge' },
    { value: 'death', label: 'Deces', danger: true },
  ],
  transferred: [
    { value: 'shelter_transfer', label: 'Retour au refuge' },
    { value: 'death', label: 'Deces', danger: true },
  ],
}

const statusLabels: Record<string, string> = {
  pound: 'Fourriere',
  shelter: 'Refuge',
  foster_family: 'Famille d\'accueil',
  boarding: 'Pension',
  adopted: 'Adopte',
  returned: 'Restitue',
  transferred: 'Transfere',
  deceased: 'Decede',
  euthanized: 'Euthanasie',
}

export function AnimalStatusChanger({ animalId, animalName, currentStatus, establishmentId }: Readonly<AnimalStatusChangerProps>) {
  const [isOpen, setIsOpen] = useState(false)
  const [type, setType] = useState<MovementType | ''>('')
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [personName, setPersonName] = useState('')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [destination, setDestination] = useState('')
  const [icadStatus, setIcadStatus] = useState<IcadStatus>('pending')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const availableMovements = movementsByStatus[currentStatus] || []
  const selectedMovement = availableMovements.find((m) => m.value === type)
  const isDanger = selectedMovement?.danger ?? false
  const isAdoption = type === 'adoption'
  const isFosterPlacement = type === 'foster_placement'
  const isTransferOut = type === 'transfer_out'
  const needsPerson = type === 'return_to_owner' || type === 'transfer_out'
  const needsClient = isAdoption || isFosterPlacement
  const clientCategory = isFosterPlacement ? 'foster_family' : 'client'

  // No transitions available for terminal states
  if (currentStatus === 'deceased' || currentStatus === 'euthanized' || availableMovements.length === 0) {
    return null
  }

  function resetForm() {
    setType('')
    setDate(new Date().toISOString().split('T')[0])
    setNotes('')
    setPersonName('')
    setSelectedClient(null)
    setDestination('')
    setIcadStatus('pending')
  }

  function handleClose() {
    setIsOpen(false)
    resetForm()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!type) return

    if (needsClient && !selectedClient) {
      toast.error(isFosterPlacement
        ? 'Veuillez sélectionner une famille d’accueil'
        : 'Veuillez sélectionner un adoptant dans le repertoire')
      return
    }

    const linkedName = needsClient && selectedClient ? selectedClient.name : null
    const linkedContact = needsClient && selectedClient
      ? [selectedClient.phone, selectedClient.email].filter(Boolean).join(' / ') || null
      : null

    startTransition(async () => {
      const result = await recordMovement(animalId, {
        type,
        date,
        notes: notes || null,
        person_name: needsClient ? linkedName : (personName || null),
        person_contact: needsClient ? linkedContact : null,
        destination: isTransferOut ? (destination || null) : null,
        icad_status: icadStatus,
        related_client_id: needsClient && selectedClient ? selectedClient.id : null,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        const label = selectedMovement?.label || 'Mouvement'
        toast.success(`${label} enregistre pour ${animalName}`)
        handleClose()
        router.refresh()
      }
    })
  }

  const inputClass = 'w-full px-3 py-2 bg-surface-dark border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50'

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
          bg-surface border border-border text-muted hover:text-text hover:border-primary/50 transition-colors"
      >
        <ArrowRightLeft className="w-3.5 h-3.5" />
        Changer le statut
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-xl border border-border w-full max-w-md max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div>
                <h3 className="text-lg font-bold">Changer le statut</h3>
                <p className="text-xs text-muted mt-0.5">
                  {animalName} — actuellement : {statusLabels[currentStatus] || currentStatus}
                </p>
              </div>
              <button type="button" onClick={handleClose} className="p-1 rounded-lg hover:bg-surface-hover transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {/* Quick action buttons */}
              <div>
                <span className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">
                  Nouveau statut
                </span>
                <div className="flex flex-wrap gap-2">
                  {availableMovements.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setType(m.value)}
                      className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                        type === m.value
                          ? m.danger
                            ? 'bg-red-500/10 border-red-500/30 text-red-500'
                            : 'bg-primary/10 border-primary/30 text-primary'
                          : m.danger
                            ? 'bg-surface-dark border-border text-red-400/70 hover:border-red-500/30'
                            : 'bg-surface-dark border-border text-muted hover:border-border/50'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Warning for death/euthanasia */}
              {isDanger && (
                <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                  <p className="text-sm text-red-400">
                    Attention : cette action est definitive et marquera {animalName} comme{' '}
                    <strong>{type === 'death' ? 'Decede' : 'Euthanasie'}</strong>.
                  </p>
                </div>
              )}

              {/* Date */}
              {type && (
                <>
                  <div>
                    <label htmlFor="status-date" className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                      Date *
                    </label>
                    <input
                      id="status-date"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                      className={inputClass}
                    />
                  </div>

                  {/* Client search for adoption / foster placement */}
                  {needsClient && (
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                        {isFosterPlacement ? 'Famille d’accueil (répertoire) *' : 'Adoptant (répertoire) *'}
                      </label>
                      <ClientSearch
                        onSelect={setSelectedClient}
                        selected={selectedClient}
                        establishmentId={establishmentId}
                        category={clientCategory}
                        placeholder={isFosterPlacement ? 'Rechercher une famille d’accueil...' : 'Rechercher un adoptant...'}
                      />
                    </div>
                  )}

                  {/* Person (for return, transfer) */}
                  {needsPerson && (
                    <div>
                      <label htmlFor="status-person" className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                        {type === 'return_to_owner' ? 'Proprietaire' : 'Refuge destinataire'}
                      </label>
                      <input
                        id="status-person"
                        type="text"
                        value={personName}
                        onChange={(e) => setPersonName(e.target.value)}
                        placeholder={type === 'transfer_out' ? 'Nom du refuge' : 'Nom de la personne'}
                        className={inputClass}
                      />
                    </div>
                  )}

                  {/* Destination (transfer) */}
                  {isTransferOut && (
                    <div>
                      <label htmlFor="status-destination" className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                        Adresse de destination
                      </label>
                      <input
                        id="status-destination"
                        type="text"
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                        placeholder="Adresse du refuge"
                        className={inputClass}
                      />
                    </div>
                  )}

                  {/* I-CAD */}
                  <div>
                    <label htmlFor="status-icad" className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                      Declaration I-CAD
                    </label>
                    <select
                      id="status-icad"
                      value={icadStatus}
                      onChange={(e) => setIcadStatus(e.target.value as IcadStatus)}
                      className={inputClass}
                    >
                      <option value="pending">En attente</option>
                      <option value="declared">Declaree</option>
                      <option value="not_required">Non requise</option>
                    </select>
                  </div>

                  {/* Notes / Comment */}
                  <div>
                    <label htmlFor="status-notes" className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                      {isDanger ? 'Commentaire' : 'Notes'}
                    </label>
                    <textarea
                      id="status-notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={isDanger ? 'Circonstances, cause...' : 'Notes complementaires...'}
                      rows={3}
                      className={`${inputClass} resize-y`}
                    />
                  </div>
                </>
              )}

              {/* Actions */}
              {type && (
                <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={isPending}
                    className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-surface-hover transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isPending || !type || (needsClient && !selectedClient)}
                    className={`px-4 py-2 rounded-lg font-semibold text-sm text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
                      isDanger
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'gradient-primary hover:opacity-90'
                    }`}
                  >
                    {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isPending ? 'Enregistrement...' : 'Confirmer'}
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  )
}
