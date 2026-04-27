'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Plus } from 'lucide-react'
import { createFosterContract, updateFosterContract } from '@/lib/actions/foster-contracts'
import { searchClientsByCategory, createClientAction } from '@/lib/actions/clients'
import type { FosterContract, FosterContractStatus } from '@/lib/types/database'

interface FosterFamilyOption {
  id: string
  name: string
  city: string | null
  phone: string | null
}

interface FosterContractFormProps {
  animalId: string
  contract?: FosterContract
  onClose?: () => void
}

export function FosterContractForm({ animalId, contract, onClose }: Readonly<FosterContractFormProps>) {
  const isEditing = !!contract
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [fosterClientId, setFosterClientId] = useState(contract?.foster_client_id || '')
  const [fosterDisplayName, setFosterDisplayName] = useState('')
  const [showFosterDropdown, setShowFosterDropdown] = useState(false)
  const [fosterOptions, setFosterOptions] = useState<FosterFamilyOption[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateFoster, setShowCreateFoster] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [startDate, setStartDate] = useState(contract?.start_date || new Date().toISOString().split('T')[0])
  const [expectedEndDate, setExpectedEndDate] = useState(contract?.expected_end_date || '')
  const [actualEndDate, setActualEndDate] = useState(contract?.actual_end_date || '')
  const [status, setStatus] = useState<FosterContractStatus>(contract?.status || 'draft')
  const [vetCovered, setVetCovered] = useState(contract?.vet_costs_covered_by_shelter ?? true)
  const [foodProvided, setFoodProvided] = useState(contract?.food_provided_by_shelter ?? false)
  const [insuranceRequired, setInsuranceRequired] = useState(contract?.insurance_required ?? false)
  const [householdConsent, setHouseholdConsent] = useState(contract?.household_consent ?? false)
  const [otherAnimals, setOtherAnimals] = useState(contract?.other_animals_at_home || '')
  const [specialConditions, setSpecialConditions] = useState(contract?.special_conditions || '')
  const [signedAtLocation, setSignedAtLocation] = useState(contract?.signed_at_location || '')
  const [signedAt, setSignedAt] = useState(contract?.signed_at || '')
  const [notes, setNotes] = useState(contract?.notes || '')

  // Load existing foster name on edit
  useEffect(() => {
    if (contract?.foster_client_id && !fosterDisplayName) {
      searchClientsByCategory('foster_family').then((res) => {
        if (res.data) {
          const found = res.data.find((c) => c.id === contract.foster_client_id)
          if (found) setFosterDisplayName(found.name)
        }
      })
    }
  }, [contract?.foster_client_id, fosterDisplayName])

  // Search debounce
  useEffect(() => {
    if (!showFosterDropdown) return
    const timer = setTimeout(async () => {
      const result = await searchClientsByCategory('foster_family', searchTerm)
      if (result.data) {
        setFosterOptions(result.data as FosterFamilyOption[])
      }
    }, 200)
    return () => clearTimeout(timer)
  }, [searchTerm, showFosterDropdown])

  // Outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowFosterDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function selectFoster(opt: FosterFamilyOption) {
    setFosterClientId(opt.id)
    setFosterDisplayName(opt.name)
    setSearchTerm(opt.name)
    setShowFosterDropdown(false)
  }

  async function handleFosterCreated(client: { id: string; name: string }) {
    setFosterClientId(client.id)
    setFosterDisplayName(client.name)
    setSearchTerm(client.name)
    setShowCreateFoster(false)
    setShowFosterDropdown(false)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!fosterClientId) {
      toast.error('Selectionnez une famille d’accueil')
      return
    }
    if (!startDate) {
      toast.error('La date de debut est obligatoire')
      return
    }

    startTransition(async () => {
      const baseData = {
        animal_id: animalId,
        foster_client_id: fosterClientId,
        start_date: startDate,
        expected_end_date: expectedEndDate || null,
        status,
        vet_costs_covered_by_shelter: vetCovered,
        food_provided_by_shelter: foodProvided,
        insurance_required: insuranceRequired,
        household_consent: householdConsent,
        other_animals_at_home: otherAnimals.trim() || null,
        special_conditions: specialConditions.trim() || null,
        signed_at_location: signedAtLocation.trim() || null,
        signed_at: signedAt || null,
        notes: notes.trim() || null,
      }

      if (isEditing && contract) {
        const result = await updateFosterContract(contract.id, {
          ...baseData,
          actual_end_date: actualEndDate || null,
        })
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success('Contrat FA mis a jour')
          router.refresh()
          onClose?.()
        }
      } else {
        const result = await createFosterContract(baseData)
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success('Contrat FA cree')
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
      {/* Foster family selection */}
      <div ref={dropdownRef} className="relative">
        <label htmlFor="foster-search" className={labelClass}>Famille d’accueil *</label>
        <input
          id="foster-search"
          type="text"
          value={searchTerm || fosterDisplayName}
          onChange={(e) => {
            setSearchTerm(e.target.value)
            setFosterDisplayName('')
            setFosterClientId('')
          }}
          onFocus={() => setShowFosterDropdown(true)}
          placeholder="Rechercher une famille d’accueil..."
          autoComplete="off"
          className={inputClass}
          required={!fosterClientId}
        />
        {showFosterDropdown && (
          <div className="absolute z-10 mt-1 w-full bg-surface border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {fosterOptions.length === 0 ? (
              <div className="p-3 text-xs text-muted text-center">
                <p className="mb-2">Aucune famille d’accueil trouvee.</p>
                <button type="button" onClick={() => setShowCreateFoster(true)} className="inline-flex items-center gap-1 text-primary hover:underline">
                  <Plus className="w-3 h-3" />
                  Creer une nouvelle FA
                </button>
              </div>
            ) : (
              <>
                <ul>
                  {fosterOptions.map((opt) => (
                    <li key={opt.id}>
                      <button type="button" onClick={() => selectFoster(opt)} className="w-full text-left px-3 py-2 text-sm hover:bg-surface-hover transition-colors">
                        <div className="font-medium">{opt.name}</div>
                        {(opt.city || opt.phone) && (
                          <div className="text-xs text-muted mt-0.5">{[opt.city, opt.phone].filter(Boolean).join(' · ')}</div>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-border p-2">
                  <button type="button" onClick={() => setShowCreateFoster(true)} className="w-full inline-flex items-center justify-center gap-1 px-2 py-1.5 text-xs text-primary hover:bg-primary/10 rounded transition-colors">
                    <Plus className="w-3 h-3" />
                    Nouvelle famille d’accueil
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Dates */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="fc-start-date" className={labelClass}>Date de debut *</label>
          <input id="fc-start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className={inputClass} />
        </div>
        <div>
          <label htmlFor="fc-expected-end" className={labelClass}>Fin previsionnelle</label>
          <input id="fc-expected-end" type="date" value={expectedEndDate} onChange={(e) => setExpectedEndDate(e.target.value)} className={inputClass} />
        </div>
        {isEditing && (
          <div>
            <label htmlFor="fc-actual-end" className={labelClass}>Fin reelle</label>
            <input id="fc-actual-end" type="date" value={actualEndDate} onChange={(e) => setActualEndDate(e.target.value)} className={inputClass} />
          </div>
        )}
      </div>

      {/* Status */}
      <div>
        <label htmlFor="fc-status" className={labelClass}>Statut</label>
        <select id="fc-status" value={status} onChange={(e) => setStatus(e.target.value as FosterContractStatus)} className={inputClass}>
          <option value="draft">Brouillon</option>
          <option value="active">Actif (signe)</option>
          <option value="ended">Termine</option>
          <option value="cancelled">Annule</option>
        </select>
      </div>

      {/* Conditions checkboxes */}
      <fieldset className="space-y-2">
        <legend className={labelClass}>Modalites particulieres</legend>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={vetCovered} onChange={(e) => setVetCovered(e.target.checked)} className="mt-0.5" />
          <span>Frais veterinaires pris en charge par le refuge</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={foodProvided} onChange={(e) => setFoodProvided(e.target.checked)} className="mt-0.5" />
          <span>Alimentation fournie par le refuge</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={insuranceRequired} onChange={(e) => setInsuranceRequired(e.target.checked)} className="mt-0.5" />
          <span>Assurance responsabilite civile a jour requise</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={householdConsent} onChange={(e) => setHouseholdConsent(e.target.checked)} className="mt-0.5" />
          <span>Accord de l’ensemble du foyer obtenu</span>
        </label>
      </fieldset>

      {/* Other animals + conditions */}
      <div>
        <label htmlFor="fc-other-animals" className={labelClass}>Autres animaux au foyer</label>
        <input id="fc-other-animals" type="text" value={otherAnimals} onChange={(e) => setOtherAnimals(e.target.value)} placeholder="2 chats, 1 chien..." className={inputClass} />
      </div>
      <div>
        <label htmlFor="fc-special" className={labelClass}>Conditions particulieres</label>
        <textarea id="fc-special" value={specialConditions} onChange={(e) => setSpecialConditions(e.target.value)} rows={2} className={`${inputClass} resize-y`} />
      </div>

      {/* Signature */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="fc-signed-location" className={labelClass}>Lieu de signature</label>
          <input id="fc-signed-location" type="text" value={signedAtLocation} onChange={(e) => setSignedAtLocation(e.target.value)} placeholder="Cambrai" className={inputClass} />
        </div>
        <div>
          <label htmlFor="fc-signed-at" className={labelClass}>Date de signature</label>
          <input id="fc-signed-at" type="date" value={signedAt} onChange={(e) => setSignedAt(e.target.value)} className={inputClass} />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="fc-notes" className={labelClass}>Notes internes</label>
        <textarea id="fc-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${inputClass} resize-y`} />
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        {onClose && (
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-surface-hover transition-colors">
            Annuler
          </button>
        )}
        <button type="submit" disabled={isPending} className="gradient-primary hover:opacity-90 transition-opacity text-white px-4 py-2 rounded-lg font-semibold text-sm disabled:opacity-50 inline-flex items-center gap-2">
          {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
          {isEditing ? 'Mettre a jour' : 'Creer le contrat'}
        </button>
      </div>

      {showCreateFoster && (
        <CreateFosterModal
          initialName={searchTerm}
          onClose={() => setShowCreateFoster(false)}
          onCreated={handleFosterCreated}
        />
      )}
    </form>
  )
}


function CreateFosterModal({
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
        type: 'foster_family',
      })
      if (result.error) {
        toast.error(result.error)
      } else if (result.data) {
        toast.success('Famille d’accueil creee')
        onCreated({ id: result.data.id, name: result.data.name })
      }
    })
  }

  const inputClass = 'w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50'
  const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-surface rounded-xl border border-border p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold mb-4">Nouvelle famille d’accueil</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="ff-name" className={labelClass}>Nom et prenom *</label>
            <input id="ff-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="ff-phone" className={labelClass}>Telephone</label>
              <input id="ff-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="ff-email" className={labelClass}>Email</label>
              <input id="ff-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div>
            <label htmlFor="ff-address" className={labelClass}>Adresse</label>
            <input id="ff-address" type="text" value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="ff-postal" className={labelClass}>CP</label>
              <input id="ff-postal" type="text" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="ff-city" className={labelClass}>Ville</label>
              <input id="ff-city" type="text" value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-2 rounded-lg border border-border text-sm hover:bg-surface-hover transition-colors">Annuler</button>
            <button type="submit" disabled={isPending} className="gradient-primary text-white px-3 py-2 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2">
              {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
              Creer
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
