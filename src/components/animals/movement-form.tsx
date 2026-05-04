'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { recordMovement } from '@/lib/actions/animals'
import { searchAllClients, createClientAction, updateClientAction } from '@/lib/actions/clients'
import { DatePicker } from '@/components/ui/date-picker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { AnimalStatus, MovementType, IcadStatus, ContactCategory } from '@/lib/types/database'

// Map each movement type to the kind of contact we should pick from the directory.
// `null` means no client picker (intra-shelter transfers, deaths, fourriere entry, etc.).
const clientCategoryByType: Partial<Record<MovementType, ContactCategory | null>> = {
  adoption: 'client',
  foster_placement: 'foster_family',
  return_to_owner: 'client',
}

interface ClientOption {
  id: string
  name: string
  email: string | null
  phone: string | null
  city: string | null
  type: ContactCategory | null
}

const categoryLabels: Record<ContactCategory, string> = {
  client: 'Client',
  member: 'Adhérent',
  volunteer: 'Bénévole',
  board_member: 'CA',
  foster_family: 'Famille d’accueil',
  veterinarian: 'Vétérinaire',
}

interface MovementFormProps {
  animalId: string
  currentStatus: AnimalStatus
  onClose?: () => void
}

const movementsByStatus: Record<string, { value: MovementType; label: string }[]> = {
  pound: [
    { value: 'shelter_transfer', label: 'Transfert en refuge' },
    { value: 'foster_placement', label: 'Placement en famille d’accueil' },
    { value: 'return_to_owner', label: 'Restitution au proprietaire' },
    { value: 'transfer_out', label: 'Transfert vers autre refuge' },
    { value: 'death', label: 'Deces' },
    { value: 'euthanasia', label: 'Euthanasie' },
  ],
  shelter: [
    { value: 'adoption', label: 'Adoption' },
    { value: 'foster_placement', label: 'Placement en famille d’accueil' },
    { value: 'return_to_owner', label: 'Restitution au proprietaire' },
    { value: 'transfer_out', label: 'Transfert vers autre refuge' },
    { value: 'death', label: 'Deces' },
    { value: 'euthanasia', label: 'Euthanasie' },
  ],
  foster_family: [
    { value: 'shelter_transfer', label: 'Retour au refuge' },
    { value: 'adoption', label: 'Adoption' },
    { value: 'return_to_owner', label: 'Restitution au proprietaire' },
    { value: 'transfer_out', label: 'Transfert vers autre refuge' },
    { value: 'death', label: 'Deces' },
    { value: 'euthanasia', label: 'Euthanasie' },
  ],
  boarding: [
    { value: 'shelter_transfer', label: 'Retour au refuge' },
    { value: 'return_to_owner', label: 'Restitution au proprietaire' },
    { value: 'death', label: 'Deces' },
  ],
  adopted: [
    { value: 'shelter_transfer', label: 'Retour au refuge (retour adoption)' },
    { value: 'death', label: 'Deces' },
  ],
  returned: [
    { value: 'shelter_transfer', label: 'Placement en refuge' },
    { value: 'death', label: 'Deces' },
  ],
  transferred: [
    { value: 'shelter_transfer', label: 'Retour au refuge' },
    { value: 'death', label: 'Deces' },
  ],
}

const movementSuccessMessages: Record<MovementType, string> = {
  pound_entry: 'Entree en fourriere enregistree',
  shelter_transfer: 'Transfert en refuge enregistre',
  foster_placement: 'Placement en famille d’accueil enregistre',
  adoption: 'Adoption enregistree',
  return_to_owner: 'Restitution au proprietaire enregistree',
  transfer_out: 'Transfert enregistre',
  death: 'Deces enregistre',
  euthanasia: 'Euthanasie enregistree',
  reservation: 'Réservation enregistrée',
  reservation_cancelled: 'Réservation annulée',
}

export function MovementForm({ animalId, currentStatus, onClose }: Readonly<MovementFormProps>) {
  const availableMovements = movementsByStatus[currentStatus] || []

  const [type, setType] = useState<MovementType | ''>('')
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [personName, setPersonName] = useState('')
  const [personContact, setPersonContact] = useState('')
  const [destination, setDestination] = useState('')
  const [icadStatus, setIcadStatus] = useState<IcadStatus>('pending')
  const [notes, setNotes] = useState('')

  // Client picker state (only used when clientCategoryByType[type] is set)
  const [relatedClientId, setRelatedClientId] = useState<string | null>(null)
  const [clientSearch, setClientSearch] = useState('')
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([])
  const [isCreatingClient, startCreatingClient] = useTransition()
  const clientPickerRef = useRef<HTMLDivElement>(null)

  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const isDeathOrEuthanasia = type === 'death' || type === 'euthanasia'
  const isTransferOut = type === 'transfer_out'
  const clientCategory: ContactCategory | null | undefined = type ? clientCategoryByType[type] : undefined
  const showClientPicker = !!clientCategory

  // Reset client selection when switching to a movement type that does not need it
  useEffect(() => {
    if (!showClientPicker) {
      setRelatedClientId(null)
      setClientSearch('')
      setShowClientDropdown(false)
    }
  }, [showClientPicker])

  // Debounced search across ALL contacts (the picker will convert categories on the fly).
  useEffect(() => {
    if (!showClientPicker || !clientCategory) return
    const timer = setTimeout(async () => {
      const result = await searchAllClients(clientSearch)
      if (result.data) {
        const options = result.data as ClientOption[]
        // Sort: contacts already in the target category first
        options.sort((a, b) => {
          const aMatch = a.type === clientCategory ? 0 : 1
          const bMatch = b.type === clientCategory ? 0 : 1
          if (aMatch !== bMatch) return aMatch - bMatch
          return a.name.localeCompare(b.name)
        })
        setClientOptions(options)
      }
    }, 200)
    return () => clearTimeout(timer)
  }, [clientSearch, showClientPicker, clientCategory])

  // Outside click closes dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (clientPickerRef.current && !clientPickerRef.current.contains(e.target as Node)) {
        setShowClientDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function selectClient(opt: ClientOption) {
    // If the contact has a different category, promote it on the fly.
    if (clientCategory && opt.type !== clientCategory) {
      startCreatingClient(async () => {
        const result = await updateClientAction(opt.id, { type: clientCategory })
        if (result.error) {
          toast.error(`Impossible de convertir le contact : ${result.error}`)
          return
        }
        toast.success(`${opt.name} transformé en ${categoryLabels[clientCategory].toLowerCase()}`)
        setRelatedClientId(opt.id)
        setClientSearch(opt.name)
        setPersonName(opt.name)
        setPersonContact(opt.email || opt.phone || '')
        setShowClientDropdown(false)
      })
      return
    }
    setRelatedClientId(opt.id)
    setClientSearch(opt.name)
    setPersonName(opt.name)
    setPersonContact(opt.email || opt.phone || '')
    setShowClientDropdown(false)
  }

  function clearClient() {
    setRelatedClientId(null)
    setClientSearch('')
    setPersonName('')
    setPersonContact('')
  }

  function handleQuickCreateClient() {
    const trimmed = clientSearch.trim()
    if (!trimmed || !clientCategory) {
      toast.error('Saisissez un nom avant de créer le contact')
      return
    }
    startCreatingClient(async () => {
      const result = await createClientAction({ name: trimmed, type: clientCategory })
      if (result.error || !result.data) {
        toast.error(result.error || 'Création impossible')
        return
      }
      const created = result.data as ClientOption
      selectClient(created)
      toast.success('Contact créé et sélectionné')
    })
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!type) {
      toast.error('Le type de mouvement est obligatoire')
      return
    }

    if (!date) {
      toast.error('La date est obligatoire')
      return
    }

    if (showClientPicker && !relatedClientId && !personName.trim()) {
      toast.error('Sélectionnez un contact ou saisissez un nom')
      return
    }

    startTransition(async () => {
      const result = await recordMovement(animalId, {
        type,
        date,
        notes: notes || null,
        person_name: personName || null,
        person_contact: personContact || null,
        destination: isTransferOut ? (destination || null) : null,
        icad_status: icadStatus,
        related_client_id: relatedClientId,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(movementSuccessMessages[type] || 'Mouvement enregistre')
        onClose?.()
        router.refresh()
      }
    })
  }

  const inputClass = 'w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50'
  const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Type + Date */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="movement-type" className={labelClass}>Type de mouvement *</label>
          <Select value={type} onValueChange={(v) => setType(v as MovementType)}>
            <SelectTrigger id="movement-type">
              <SelectValue placeholder="Sélectionnez un type" />
            </SelectTrigger>
            <SelectContent>
              {availableMovements.map(({ value, label }) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label htmlFor="movement-date" className={labelClass}>Date *</label>
          <DatePicker
            id="movement-date"
            value={date}
            onChange={(v) => setDate(v ?? '')}
            required
            clearable={false}
          />
        </div>
      </div>

      {/* Warning for death/euthanasia */}
      {isDeathOrEuthanasia && (
        <div className="flex items-start gap-3 rounded-lg border border-orange-300 bg-orange-50 p-3 dark:border-orange-500/30 dark:bg-orange-500/10">
          <svg className="mt-0.5 h-5 w-5 shrink-0 text-orange-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <p className="text-sm text-orange-700 dark:text-orange-300">
            Attention : cette action est definitive et marquera l&apos;animal comme {type === 'death' ? 'Decede' : 'Euthanasie'}.
          </p>
        </div>
      )}

      {/* Client picker (adoption / foster placement / return to owner) */}
      {showClientPicker ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div ref={clientPickerRef} className="relative">
            <label htmlFor="movement-client-search" className={labelClass}>
              {clientCategory === 'foster_family' ? 'Famille d’accueil *' : 'Adoptant / Propriétaire *'}
            </label>
            <input
              id="movement-client-search"
              type="text"
              value={clientSearch}
              onChange={(e) => {
                setClientSearch(e.target.value)
                if (relatedClientId) {
                  // user is editing after a selection -> drop the link
                  setRelatedClientId(null)
                }
                setShowClientDropdown(true)
              }}
              onFocus={() => setShowClientDropdown(true)}
              placeholder={clientCategory === 'foster_family' ? 'Rechercher une famille d’accueil...' : 'Rechercher un contact...'}
              className={inputClass}
              autoComplete="off"
            />
            {relatedClientId && (
              <button
                type="button"
                onClick={clearClient}
                className="absolute right-2 top-[34px] text-xs text-muted hover:text-text"
              >
                ✕
              </button>
            )}
            {showClientDropdown && (
              <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-border bg-surface shadow-lg">
                {clientOptions.length > 0 ? (
                  clientOptions.map((opt) => {
                    const needsConversion = !!clientCategory && opt.type !== clientCategory
                    const currentLabel = opt.type ? categoryLabels[opt.type] : 'Sans catégorie'
                    return (
                      <button
                        type="button"
                        key={opt.id}
                        onClick={() => selectClient(opt)}
                        disabled={isCreatingClient}
                        className="block w-full text-left px-3 py-2 hover:bg-surface-hover text-sm disabled:opacity-50"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{opt.name}</span>
                          <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${needsConversion ? 'bg-amber-500/15 text-amber-600' : 'bg-primary/15 text-primary'}`}>
                            {currentLabel}
                          </span>
                        </div>
                        <div className="text-xs text-muted mt-0.5">
                          {[opt.city, opt.email || opt.phone].filter(Boolean).join(' · ') || '—'}
                        </div>
                        {needsConversion && clientCategory && (
                          <div className="text-[10px] text-amber-600 mt-0.5">→ sera converti en {categoryLabels[clientCategory].toLowerCase()} au clic</div>
                        )}
                      </button>
                    )
                  })
                ) : (
                  <div className="px-3 py-2 text-sm text-muted">Aucun contact trouvé</div>
                )}
                {clientSearch.trim() && (
                  <button
                    type="button"
                    onClick={handleQuickCreateClient}
                    disabled={isCreatingClient}
                    className="flex items-center gap-2 w-full text-left px-3 py-2 border-t border-border bg-surface-dark hover:bg-surface-hover text-sm font-medium text-primary disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    {isCreatingClient ? 'Création...' : `Créer "${clientSearch.trim()}" comme nouveau contact`}
                  </button>
                )}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="movement-person-contact" className={labelClass}>Contact</label>
            <input
              id="movement-person-contact"
              type="text"
              value={personContact}
              onChange={(e) => setPersonContact(e.target.value)}
              placeholder="Téléphone ou email"
              className={inputClass}
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="movement-person-name" className={labelClass}>Personne liée</label>
            <input
              id="movement-person-name"
              type="text"
              value={personName}
              onChange={(e) => setPersonName(e.target.value)}
              placeholder="Nom de la personne"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="movement-person-contact" className={labelClass}>Contact</label>
            <input
              id="movement-person-contact"
              type="text"
              value={personContact}
              onChange={(e) => setPersonContact(e.target.value)}
              placeholder="Téléphone ou email"
              className={inputClass}
            />
          </div>
        </div>
      )}

      {/* Destination (only for transfer_out) */}
      {isTransferOut && (
        <div>
          <label htmlFor="movement-destination" className={labelClass}>Destination</label>
          <input
            id="movement-destination"
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Nom du refuge ou adresse de destination"
            className={inputClass}
          />
        </div>
      )}

      {/* I-CAD status */}
      <div>
        <label htmlFor="movement-icad-status" className={labelClass}>Déclaration I-CAD</label>
        <Select value={icadStatus} onValueChange={(v) => setIcadStatus(v as IcadStatus)}>
          <SelectTrigger id="movement-icad-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">En attente</SelectItem>
            <SelectItem value="declared">Déclarée</SelectItem>
            <SelectItem value="not_required">Non requise</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="movement-notes" className={labelClass}>Notes</label>
        <textarea
          id="movement-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes complementaires..."
          rows={3}
          className={`${inputClass} resize-y`}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-surface-hover transition-colors"
          >
            Annuler
          </button>
        )}
        <button
          type="submit"
          disabled={isPending || !type}
          className="gradient-primary hover:opacity-90 transition-opacity text-white px-4 py-2 rounded-lg font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? 'Enregistrement...' : 'Enregistrer le mouvement'}
        </button>
      </div>
    </form>
  )
}
