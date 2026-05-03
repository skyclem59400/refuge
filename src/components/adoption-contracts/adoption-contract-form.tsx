'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Plus } from 'lucide-react'
import { createAdoptionContract, updateAdoptionContract } from '@/lib/actions/adoption-contracts'
import { searchClientsByCategory, createClientAction } from '@/lib/actions/clients'
import type { AdoptionContract, AdoptionContractStatus } from '@/lib/types/database'

interface AdopterOption {
  id: string
  name: string
  city: string | null
  phone: string | null
}

interface AdoptionContractFormProps {
  animalId: string
  contract?: AdoptionContract
  onClose?: () => void
}

export function AdoptionContractForm({ animalId, contract, onClose }: Readonly<AdoptionContractFormProps>) {
  const isEditing = !!contract
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [adopterClientId, setAdopterClientId] = useState(contract?.adopter_client_id || '')
  const [adopterDisplayName, setAdopterDisplayName] = useState('')
  const [showAdopterDropdown, setShowAdopterDropdown] = useState(false)
  const [adopterOptions, setAdopterOptions] = useState<AdopterOption[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateAdopter, setShowCreateAdopter] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [adoptionDate, setAdoptionDate] = useState(contract?.adoption_date || new Date().toISOString().split('T')[0])
  const [adoptionFee, setAdoptionFee] = useState<string>(
    contract?.adoption_fee != null ? String(contract.adoption_fee) : ''
  )
  const [status, setStatus] = useState<AdoptionContractStatus>(contract?.status || 'draft')
  const [sterilizationRequired, setSterilizationRequired] = useState(contract?.sterilization_required ?? true)
  const [sterilizationDeadline, setSterilizationDeadline] = useState(contract?.sterilization_deadline || '')
  const [sterilizationDeposit, setSterilizationDeposit] = useState<string>(
    contract?.sterilization_deposit != null ? String(contract.sterilization_deposit) : ''
  )
  const [visitRightClause, setVisitRightClause] = useState(contract?.visit_right_clause ?? true)
  const [nonResaleClause, setNonResaleClause] = useState(contract?.non_resale_clause ?? true)
  const [shelterReturnClause, setShelterReturnClause] = useState(contract?.shelter_return_clause ?? true)
  const [householdAcknowledgment, setHouseholdAcknowledgment] = useState(contract?.household_acknowledgment ?? false)
  const [specialConditions, setSpecialConditions] = useState(contract?.special_conditions || '')
  const [signedAtLocation, setSignedAtLocation] = useState(contract?.signed_at_location || '')
  const [signedAt, setSignedAt] = useState(contract?.signed_at || '')
  const [notes, setNotes] = useState(contract?.notes || '')

  useEffect(() => {
    if (contract?.adopter_client_id && !adopterDisplayName) {
      searchClientsByCategory('client').then((res) => {
        if (res.data) {
          const found = res.data.find((c) => c.id === contract.adopter_client_id)
          if (found) setAdopterDisplayName(found.name)
        }
      })
    }
  }, [contract?.adopter_client_id, adopterDisplayName])

  useEffect(() => {
    if (!showAdopterDropdown) return
    const timer = setTimeout(async () => {
      const result = await searchClientsByCategory('client', searchTerm)
      if (result.data) setAdopterOptions(result.data as AdopterOption[])
    }, 200)
    return () => clearTimeout(timer)
  }, [searchTerm, showAdopterDropdown])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowAdopterDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function selectAdopter(opt: AdopterOption) {
    setAdopterClientId(opt.id)
    setAdopterDisplayName(opt.name)
    setSearchTerm(opt.name)
    setShowAdopterDropdown(false)
  }

  async function handleAdopterCreated(client: { id: string; name: string }) {
    setAdopterClientId(client.id)
    setAdopterDisplayName(client.name)
    setSearchTerm(client.name)
    setShowCreateAdopter(false)
    setShowAdopterDropdown(false)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!adopterClientId) {
      toast.error("Sélectionnez un adoptant")
      return
    }
    if (!adoptionDate) {
      toast.error("La date d'adoption est obligatoire")
      return
    }

    startTransition(async () => {
      const baseData = {
        animal_id: animalId,
        adopter_client_id: adopterClientId,
        adoption_date: adoptionDate,
        adoption_fee: adoptionFee.trim() ? Number(adoptionFee) : 0,
        status,
        sterilization_required: sterilizationRequired,
        sterilization_deadline: sterilizationRequired && sterilizationDeadline ? sterilizationDeadline : null,
        sterilization_deposit: sterilizationRequired && sterilizationDeposit.trim() ? Number(sterilizationDeposit) : null,
        visit_right_clause: visitRightClause,
        non_resale_clause: nonResaleClause,
        shelter_return_clause: shelterReturnClause,
        household_acknowledgment: householdAcknowledgment,
        special_conditions: specialConditions.trim() || null,
        signed_at_location: signedAtLocation.trim() || null,
        signed_at: signedAt || null,
        notes: notes.trim() || null,
      }

      if (isEditing && contract) {
        const result = await updateAdoptionContract(contract.id, baseData)
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success("Contrat d'adoption mis à jour")
          router.refresh()
          onClose?.()
        }
      } else {
        const result = await createAdoptionContract(baseData)
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success("Contrat d'adoption créé")
          router.refresh()
          onClose?.()
        }
      }
    })
  }

  const inputClass = 'w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50'
  const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Adopter selection */}
      <div ref={dropdownRef} className="relative">
        <label htmlFor="adopter-search" className={labelClass}>Adoptant *</label>
        <input
          id="adopter-search"
          type="text"
          value={searchTerm || adopterDisplayName}
          onChange={(e) => {
            setSearchTerm(e.target.value)
            setAdopterDisplayName('')
            setAdopterClientId('')
          }}
          onFocus={() => setShowAdopterDropdown(true)}
          placeholder="Rechercher un adoptant..."
          autoComplete="off"
          className={inputClass}
          required={!adopterClientId}
        />
        {showAdopterDropdown && (
          <div className="absolute z-10 mt-1 w-full bg-surface border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {adopterOptions.length === 0 ? (
              <div className="p-3 text-xs text-muted text-center">
                <p className="mb-2">Aucun adoptant trouvé.</p>
                <button type="button" onClick={() => setShowCreateAdopter(true)} className="inline-flex items-center gap-1 text-primary hover:underline">
                  <Plus className="w-3 h-3" />
                  Créer un nouveau contact
                </button>
              </div>
            ) : (
              <>
                <ul>
                  {adopterOptions.map((opt) => (
                    <li key={opt.id}>
                      <button type="button" onClick={() => selectAdopter(opt)} className="w-full text-left px-3 py-2 text-sm hover:bg-surface-hover transition-colors">
                        <div className="font-medium">{opt.name}</div>
                        {(opt.city || opt.phone) && (
                          <div className="text-xs text-muted mt-0.5">{[opt.city, opt.phone].filter(Boolean).join(' · ')}</div>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-border p-2">
                  <button type="button" onClick={() => setShowCreateAdopter(true)} className="w-full inline-flex items-center justify-center gap-1 px-2 py-1.5 text-xs text-primary hover:bg-primary/10 rounded transition-colors">
                    <Plus className="w-3 h-3" />
                    Nouveau contact
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Date + frais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="ac-date" className={labelClass}>Date d'adoption *</label>
          <input id="ac-date" type="date" value={adoptionDate} onChange={(e) => setAdoptionDate(e.target.value)} required className={inputClass} />
        </div>
        <div>
          <label htmlFor="ac-fee" className={labelClass}>Frais d'adoption (€)</label>
          <input id="ac-fee" type="number" step="0.01" min="0" value={adoptionFee} onChange={(e) => setAdoptionFee(e.target.value)} placeholder="0.00" className={inputClass} />
        </div>
        <div>
          <label htmlFor="ac-status" className={labelClass}>Statut</label>
          <select id="ac-status" value={status} onChange={(e) => setStatus(e.target.value as AdoptionContractStatus)} className={inputClass}>
            <option value="draft">Brouillon</option>
            <option value="active">Actif (signé)</option>
            <option value="cancelled">Annulé</option>
          </select>
        </div>
      </div>

      {/* Clauses */}
      <fieldset className="space-y-2">
        <legend className={labelClass}>Clauses du contrat</legend>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={sterilizationRequired} onChange={(e) => setSterilizationRequired(e.target.checked)} className="mt-0.5" />
          <span>Stérilisation obligatoire si l'animal n'est pas déjà stérilisé</span>
        </label>
        {sterilizationRequired && (
          <div className="ml-6 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label htmlFor="ac-ster-deadline" className={labelClass}>Échéance stérilisation</label>
              <input id="ac-ster-deadline" type="date" value={sterilizationDeadline} onChange={(e) => setSterilizationDeadline(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="ac-ster-deposit" className={labelClass}>Caution (€)</label>
              <input id="ac-ster-deposit" type="number" step="0.01" min="0" value={sterilizationDeposit} onChange={(e) => setSterilizationDeposit(e.target.value)} placeholder="50.00" className={inputClass} />
            </div>
          </div>
        )}
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={nonResaleClause} onChange={(e) => setNonResaleClause(e.target.checked)} className="mt-0.5" />
          <span>Clause de non-cession (l'animal ne peut être revendu/cédé sans accord)</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={shelterReturnClause} onChange={(e) => setShelterReturnClause(e.target.checked)} className="mt-0.5" />
          <span>Clause de reprise par le refuge en cas de défaillance</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={visitRightClause} onChange={(e) => setVisitRightClause(e.target.checked)} className="mt-0.5" />
          <span>Droit de visite et de suivi (1ère année)</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={householdAcknowledgment} onChange={(e) => setHouseholdAcknowledgment(e.target.checked)} className="mt-0.5" />
          <span>L'adoptant atteste l'accord du foyer entier</span>
        </label>
      </fieldset>

      {/* Free fields */}
      <div>
        <label htmlFor="ac-special" className={labelClass}>Conditions particulières</label>
        <textarea id="ac-special" value={specialConditions} onChange={(e) => setSpecialConditions(e.target.value)} rows={2} className={`${inputClass} resize-y`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="ac-signed-location" className={labelClass}>Lieu de signature</label>
          <input id="ac-signed-location" type="text" value={signedAtLocation} onChange={(e) => setSignedAtLocation(e.target.value)} placeholder="Cambrai" className={inputClass} />
        </div>
        <div>
          <label htmlFor="ac-signed-at" className={labelClass}>Date de signature</label>
          <input id="ac-signed-at" type="date" value={signedAt} onChange={(e) => setSignedAt(e.target.value)} className={inputClass} />
        </div>
      </div>

      <div>
        <label htmlFor="ac-notes" className={labelClass}>Notes internes</label>
        <textarea id="ac-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${inputClass} resize-y`} />
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        {onClose && (
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-surface-hover transition-colors">
            Annuler
          </button>
        )}
        <button type="submit" disabled={isPending} className="gradient-primary hover:opacity-90 transition-opacity text-white px-4 py-2 rounded-lg font-semibold text-sm disabled:opacity-50 inline-flex items-center gap-2">
          {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
          {isEditing ? 'Mettre à jour' : 'Créer le contrat'}
        </button>
      </div>

      {showCreateAdopter && (
        <CreateAdopterModal
          initialName={searchTerm}
          onClose={() => setShowCreateAdopter(false)}
          onCreated={handleAdopterCreated}
        />
      )}
    </form>
  )
}


function CreateAdopterModal({
  initialName,
  onClose,
  onCreated,
}: Readonly<{
  initialName: string
  onClose: () => void
  onCreated: (client: { id: string; name: string }) => void
}>) {
  const [name, setName] = useState(initialName)
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [city, setCity] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Le nom est obligatoire')
      return
    }
    startTransition(async () => {
      const result = await createClientAction({
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        postal_code: postalCode.trim() || null,
        city: city.trim() || null,
        type: 'client',
      })
      if (result.error) {
        toast.error(result.error)
      } else if (result.data) {
        toast.success('Adoptant créé')
        onCreated({ id: result.data.id, name: result.data.name })
      }
    })
  }

  const inputClass = 'w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50'
  const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-surface rounded-xl border border-border p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold mb-4">Nouvel adoptant</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="ad-name" className={labelClass}>Nom et prénom *</label>
            <input id="ad-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="ad-phone" className={labelClass}>Téléphone</label>
              <input id="ad-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="ad-email" className={labelClass}>Email</label>
              <input id="ad-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div>
            <label htmlFor="ad-address" className={labelClass}>Adresse</label>
            <input id="ad-address" type="text" value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="ad-postal" className={labelClass}>CP</label>
              <input id="ad-postal" type="text" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="ad-city" className={labelClass}>Ville</label>
              <input id="ad-city" type="text" value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-2 rounded-lg border border-border text-sm hover:bg-surface-hover transition-colors">Annuler</button>
            <button type="submit" disabled={isPending} className="gradient-primary text-white px-3 py-2 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2">
              {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
              Créer
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
