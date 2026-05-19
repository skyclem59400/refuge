'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Loader2, X, Search } from 'lucide-react'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import { createDonation, updateDonation } from '@/lib/actions/donations'
import { createClientAction } from '@/lib/actions/clients'
import { DatePicker } from '@/components/ui/date-picker'
import {
  getClientDisplayName,
  type Client,
  type ClientKind,
  type Donation,
  type DonationPaymentMethod,
  type DonationNature,
} from '@/lib/types/database'

interface DonationFormProps {
  donation?: Donation
  establishmentId: string
}

const paymentMethods: { value: DonationPaymentMethod; label: string }[] = [
  { value: 'cheque', label: 'Cheque' },
  { value: 'virement', label: 'Virement bancaire' },
  { value: 'especes', label: 'Especes' },
  { value: 'cb', label: 'Carte bancaire' },
  { value: 'prelevement', label: 'Prelevement' },
  { value: 'autre', label: 'Autre' },
]

type DonorOption = Pick<Client, 'id' | 'kind' | 'name' | 'first_name' | 'email' | 'phone' | 'address' | 'postal_code' | 'city'>

export function DonationForm({ donation, establishmentId }: Readonly<DonationFormProps>) {
  const isEdit = !!donation
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Donor : sélection depuis le répertoire OU création inline
  const [selectedDonor, setSelectedDonor] = useState<DonorOption | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Champs spécifiques au don
  const [amount, setAmount] = useState(donation?.amount?.toString() || '')
  const [date, setDate] = useState(donation?.date || new Date().toISOString().split('T')[0])
  const [paymentMethod, setPaymentMethod] = useState<DonationPaymentMethod>(donation?.payment_method || 'cheque')
  const [nature, setNature] = useState<DonationNature>(donation?.nature || 'numeraire')
  const [notes, setNotes] = useState(donation?.notes || '')

  // En mode édition : on garde les champs donor_* éditables (corrections de typo)
  const [editDonorName, setEditDonorName] = useState(donation?.donor_name || '')
  const [editDonorEmail, setEditDonorEmail] = useState(donation?.donor_email || '')
  const [editDonorPhone, setEditDonorPhone] = useState(donation?.donor_phone || '')
  const [editDonorAddress, setEditDonorAddress] = useState(donation?.donor_address || '')
  const [editDonorPostalCode, setEditDonorPostalCode] = useState(donation?.donor_postal_code || '')
  const [editDonorCity, setEditDonorCity] = useState(donation?.donor_city || '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('Le montant doit être supérieur à 0')
      return
    }

    if (isEdit) {
      // Mode édition : signature historique (snapshot manuel)
      if (!editDonorName.trim()) {
        toast.error('Le nom du donateur est obligatoire')
        return
      }
      startTransition(async () => {
        const result = await updateDonation(donation.id, {
          donor_name: editDonorName.trim(),
          donor_email: editDonorEmail.trim() || null,
          donor_phone: editDonorPhone.trim() || null,
          donor_address: editDonorAddress.trim() || null,
          donor_postal_code: editDonorPostalCode.trim() || null,
          donor_city: editDonorCity.trim() || null,
          amount: parsedAmount,
          date,
          payment_method: paymentMethod,
          nature,
          notes: notes.trim() || null,
        })
        if (result.error) toast.error(result.error)
        else {
          toast.success('Don modifié')
          router.push('/donations')
          router.refresh()
        }
      })
      return
    }

    // Mode création : on exige un client sélectionné
    if (!selectedDonor) {
      toast.error('Sélectionne un donateur depuis le répertoire ou crée-en un nouveau.')
      return
    }

    startTransition(async () => {
      const result = await createDonation({
        client_id: selectedDonor.id,
        amount: parsedAmount,
        date,
        payment_method: paymentMethod,
        nature,
        notes: notes.trim() || null,
      })
      if (result.error) toast.error(result.error)
      else {
        toast.success('Don enregistré')
        router.push('/donations')
        router.refresh()
      }
    })
  }

  const inputClass = 'w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50'
  const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5'

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Donor section */}
      <div className="bg-surface rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted mb-4">
          Donateur
        </h3>

        {isEdit ? (
          <EditDonorFields
            name={editDonorName} setName={setEditDonorName}
            email={editDonorEmail} setEmail={setEditDonorEmail}
            phone={editDonorPhone} setPhone={setEditDonorPhone}
            address={editDonorAddress} setAddress={setEditDonorAddress}
            postalCode={editDonorPostalCode} setPostalCode={setEditDonorPostalCode}
            city={editDonorCity} setCity={setEditDonorCity}
            inputClass={inputClass} labelClass={labelClass}
          />
        ) : (
          <DonorPicker
            establishmentId={establishmentId}
            selected={selectedDonor}
            onSelect={setSelectedDonor}
            onCreateClick={() => setShowCreateModal(true)}
          />
        )}
      </div>

      {/* Donation details section */}
      <div className="bg-surface rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted mb-4">
          Détails du don
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="donation-amount" className={labelClass}>Montant (EUR) *</label>
            <input
              id="donation-amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              placeholder="0.00"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="donation-date" className={labelClass}>Date du don *</label>
            <DatePicker
              id="donation-date"
              value={date}
              onChange={(v) => setDate(v ?? '')}
              required
              ariaLabel="Date du don"
            />
          </div>

          <div>
            <label htmlFor="donation-payment-method" className={labelClass}>Mode de paiement</label>
            <select
              id="donation-payment-method"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as DonationPaymentMethod)}
              className={inputClass}
            >
              {paymentMethods.map((pm) => (
                <option key={pm.value} value={pm.value}>{pm.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="donation-nature" className={labelClass}>Nature du don</label>
            <select
              id="donation-nature"
              value={nature}
              onChange={(e) => setNature(e.target.value as DonationNature)}
              className={inputClass}
            >
              <option value="numeraire">Numeraire (argent)</option>
              <option value="nature">En nature</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="donation-notes" className={labelClass}>Notes</label>
            <textarea
              id="donation-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes complementaires..."
              rows={3}
              className={`${inputClass} resize-y`}
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-surface-hover transition-colors"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="gradient-primary hover:opacity-90 transition-opacity text-white px-6 py-2 rounded-lg font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending && 'Enregistrement...'}
          {!isPending && isEdit && 'Modifier le don'}
          {!isPending && !isEdit && 'Enregistrer le don'}
        </button>
      </div>

      {showCreateModal && (
        <CreateDonorModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(client) => {
            setSelectedDonor(client)
            setShowCreateModal(false)
          }}
        />
      )}
    </form>
  )
}

// ===========================================================================
// DonorPicker : recherche autocomplete + bouton "+ Nouveau donateur"
// ===========================================================================
function DonorPicker({
  establishmentId,
  selected,
  onSelect,
  onCreateClick,
}: Readonly<{
  establishmentId: string
  selected: DonorOption | null
  onSelect: (client: DonorOption | null) => void
  onCreateClick: () => void
}>) {
  const supabase = createSupabaseClient()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<DonorOption[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const handle = setTimeout(async () => {
      const term = query.trim()
      let q = supabase
        .from('clients')
        .select('id, kind, name, first_name, email, phone, address, postal_code, city')
        .eq('establishment_id', establishmentId)
        .order('name', { ascending: true })
        .limit(20)
      if (term.length > 0) {
        const p = `%${term}%`
        q = q.or(`name.ilike.${p},first_name.ilike.${p},email.ilike.${p},city.ilike.${p}`)
      }
      const { data } = await q
      setResults((data as DonorOption[]) || [])
    }, 150)
    return () => clearTimeout(handle)
  }, [query, isOpen, establishmentId, supabase])

  if (selected) {
    const label = getClientDisplayName(selected)
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
        <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-sm font-bold text-white shrink-0">
          {(label[0] || '?').toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{label}</p>
          <p className="text-xs text-muted truncate">
            {[selected.email, [selected.postal_code, selected.city].filter(Boolean).join(' ')].filter(Boolean).join(' · ') || 'Aucune coordonnée'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="text-muted hover:text-danger transition-colors p-1"
          title="Changer de donateur"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted/60 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsOpen(true)}
            placeholder="Rechercher un contact dans le répertoire..."
            className="w-full pl-10 pr-3 py-2.5 bg-surface-dark border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <button
          type="button"
          onClick={onCreateClick}
          className="px-3 py-2.5 rounded-lg gradient-primary hover:opacity-90 transition-opacity text-white text-sm font-semibold inline-flex items-center gap-1.5 shrink-0"
          title="Créer un nouveau donateur"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nouveau</span>
        </button>
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-12 mt-1 bg-surface border border-border rounded-lg shadow-xl z-20 max-h-72 overflow-y-auto">
          {results.map((c) => {
            const label = getClientDisplayName(c)
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onSelect(c)
                  setQuery('')
                  setIsOpen(false)
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-surface-hover transition-colors flex items-center gap-3"
              >
                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {(label[0] || '?').toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{label}</p>
                  <p className="text-xs text-muted truncate">
                    {[c.email, c.city].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {isOpen && results.length === 0 && query.trim().length > 0 && (
        <div className="absolute top-full left-0 right-12 mt-1 bg-surface border border-border rounded-lg shadow-xl z-20 p-4 text-center">
          <p className="text-sm text-muted mb-2">Aucun contact trouvé pour « {query.trim()} »</p>
          <button
            type="button"
            onClick={onCreateClick}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 text-primary text-sm font-medium hover:bg-primary/25 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Créer « {query.trim()} »
          </button>
        </div>
      )}
    </div>
  )
}

// ===========================================================================
// CreateDonorModal : mini-formulaire complet (toggle person/org)
// ===========================================================================
function CreateDonorModal({
  onClose,
  onCreated,
}: Readonly<{
  onClose: () => void
  onCreated: (client: DonorOption) => void
}>) {
  const [kind, setKind] = useState<ClientKind>('person')
  const [name, setName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [city, setCity] = useState('')
  const [isPending, startTransition] = useTransition()

  const isPerson = kind === 'person'

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error(isPerson ? 'Le nom est obligatoire' : 'Le nom de l\'organisation est obligatoire')
      return
    }
    if (isPerson && !firstName.trim()) {
      toast.error('Le prénom est obligatoire')
      return
    }

    startTransition(async () => {
      const result = await createClientAction({
        kind,
        name: name.trim(),
        first_name: isPerson ? firstName.trim() : null,
        contact_person: !isPerson && contactPerson.trim() ? contactPerson.trim() : null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        postal_code: postalCode.trim() || null,
        city: city.trim() || null,
        type: 'client',
      })
      if (result.error || !result.data) {
        toast.error(result.error || 'Création impossible')
        return
      }
      toast.success('Donateur créé dans le répertoire')
      const c = result.data as Client
      onCreated({
        id: c.id, kind: c.kind, name: c.name, first_name: c.first_name,
        email: c.email, phone: c.phone, address: c.address,
        postal_code: c.postal_code, city: c.city,
      })
    })
  }

  const inputClass = 'w-full px-3 py-2 bg-surface-dark border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50'
  const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-surface rounded-xl border border-border p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold">Nouveau donateur</h3>
          <button type="button" onClick={onClose} className="text-muted hover:text-foreground p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Toggle particulier / organisation */}
          <div className="inline-flex rounded-lg border border-border p-1 bg-surface-dark">
            <button
              type="button"
              onClick={() => setKind('person')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${isPerson ? 'gradient-primary text-white font-semibold' : 'text-muted hover:text-foreground'}`}
            >
              Particulier
            </button>
            <button
              type="button"
              onClick={() => setKind('organization')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${!isPerson ? 'gradient-primary text-white font-semibold' : 'text-muted hover:text-foreground'}`}
            >
              Organisation
            </button>
          </div>

          {isPerson ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="cd-name" className={labelClass}>Nom *</label>
                <input id="cd-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="DUPONT" required className={inputClass} />
              </div>
              <div>
                <label htmlFor="cd-firstname" className={labelClass}>Prénom *</label>
                <input id="cd-firstname" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jean" required className={inputClass} />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label htmlFor="cd-orgname" className={labelClass}>Nom de l'organisation *</label>
                <input id="cd-orgname" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Mairie de Cambrai" required className={inputClass} />
              </div>
              <div>
                <label htmlFor="cd-contact" className={labelClass}>Personne référente</label>
                <input id="cd-contact" type="text" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="Marjorie Gosselet" className={inputClass} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="cd-email" className={labelClass}>Email</label>
              <input id="cd-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemple.fr" className={inputClass} />
            </div>
            <div>
              <label htmlFor="cd-phone" className={labelClass}>Téléphone</label>
              <input id="cd-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06 12 34 56 78" className={inputClass} />
            </div>
          </div>

          <div>
            <label htmlFor="cd-address" className={labelClass}>Adresse</label>
            <input id="cd-address" type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="20 rue de la Paix" className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="cd-postal" className={labelClass}>Code postal</label>
              <input id="cd-postal" type="text" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="59400" className={inputClass} />
            </div>
            <div>
              <label htmlFor="cd-city" className={labelClass}>Ville</label>
              <input id="cd-city" type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cambrai" className={inputClass} />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button type="button" onClick={onClose} className="px-3 py-2 rounded-lg border border-border text-sm hover:bg-surface-hover transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={isPending} className="gradient-primary hover:opacity-90 transition-opacity text-white px-4 py-2 rounded-lg font-semibold text-sm disabled:opacity-50 inline-flex items-center gap-2">
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Créer et sélectionner
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ===========================================================================
// EditDonorFields : édition manuelle des snapshots en mode édition d'un don existant
// ===========================================================================
function EditDonorFields(props: Readonly<{
  name: string; setName: (v: string) => void
  email: string; setEmail: (v: string) => void
  phone: string; setPhone: (v: string) => void
  address: string; setAddress: (v: string) => void
  postalCode: string; setPostalCode: (v: string) => void
  city: string; setCity: (v: string) => void
  inputClass: string
  labelClass: string
}>) {
  return (
    <>
      <p className="text-xs text-muted mb-3">
        Les coordonnées du donateur sont figées sur le reçu fiscal au moment du don.
        Modifie-les ici uniquement pour corriger une faute de frappe ; pour changer durablement
        les coordonnées du contact, va sur sa fiche dans le répertoire.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label htmlFor="donation-donor-name" className={props.labelClass}>Nom du donateur *</label>
          <input
            id="donation-donor-name"
            type="text"
            value={props.name}
            onChange={(e) => props.setName(e.target.value)}
            required
            placeholder="Nom complet ou raison sociale"
            className={props.inputClass}
          />
        </div>
        <div>
          <label htmlFor="donation-donor-email" className={props.labelClass}>Email</label>
          <input id="donation-donor-email" type="email" value={props.email} onChange={(e) => props.setEmail(e.target.value)} placeholder="email@exemple.fr" className={props.inputClass} />
        </div>
        <div>
          <label htmlFor="donation-donor-phone" className={props.labelClass}>Téléphone</label>
          <input id="donation-donor-phone" type="tel" value={props.phone} onChange={(e) => props.setPhone(e.target.value)} placeholder="06 12 34 56 78" className={props.inputClass} />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="donation-donor-address" className={props.labelClass}>Adresse</label>
          <input id="donation-donor-address" type="text" value={props.address} onChange={(e) => props.setAddress(e.target.value)} placeholder="Rue, numéro..." className={props.inputClass} />
        </div>
        <div>
          <label htmlFor="donation-donor-postal-code" className={props.labelClass}>Code postal</label>
          <input id="donation-donor-postal-code" type="text" value={props.postalCode} onChange={(e) => props.setPostalCode(e.target.value)} placeholder="59000" className={props.inputClass} />
        </div>
        <div>
          <label htmlFor="donation-donor-city" className={props.labelClass}>Ville</label>
          <input id="donation-donor-city" type="text" value={props.city} onChange={(e) => props.setCity(e.target.value)} placeholder="Lille" className={props.inputClass} />
        </div>
      </div>
    </>
  )
}
