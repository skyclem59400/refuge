'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Plus, Search, X } from 'lucide-react'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import {
  createAbandonmentContract,
  updateAbandonmentContract,
} from '@/lib/actions/abandonment-contracts'
import { createClientAction } from '@/lib/actions/clients'
import {
  getClientDisplayName,
  ABANDONMENT_MOTIF_LABELS,
  type AbandonmentContract,
  type AbandonmentMotif,
  type Client,
  type ClientKind,
} from '@/lib/types/database'

type CedantOption = Pick<Client, 'id' | 'kind' | 'name' | 'first_name' | 'email' | 'phone' | 'address' | 'postal_code' | 'city'>

interface AbandonmentContractFormProps {
  animalId: string
  establishmentId: string
  contract?: AbandonmentContract & { cedant?: CedantOption }
  onClose?: () => void
}

const MOTIFS: AbandonmentMotif[] = [
  'legal',
  'deces_proprietaire',
  'demenagement',
  'divorce',
  'allergies',
  'maladie_animal',
  'probleme_comportemental',
  'difficultes_financieres',
  'autre',
]

export function AbandonmentContractForm({
  animalId, establishmentId, contract, onClose,
}: Readonly<AbandonmentContractFormProps>) {
  const isEdit = !!contract
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [selectedCedant, setSelectedCedant] = useState<CedantOption | null>(contract?.cedant ?? null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const [signatureDate, setSignatureDate] = useState(contract?.signature_date || new Date().toISOString().split('T')[0])
  const [expectedHandoverDate, setExpectedHandoverDate] = useState(contract?.expected_handover_date || '')
  const [motif, setMotif] = useState<AbandonmentMotif>(contract?.motif || 'legal')
  const [motifDetails, setMotifDetails] = useState(contract?.motif_details || '')
  const [amount, setAmount] = useState(contract?.amount?.toString() || '')
  const [note, setNote] = useState(contract?.note || '')
  const [cedantIdCard, setCedantIdCard] = useState(contract?.cedant_id_card_number || '')
  const [cedantPassport, setCedantPassport] = useState(contract?.cedant_passport_number || '')
  const [signedAtLocation, setSignedAtLocation] = useState(contract?.signed_at_location || 'Estourmel')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!selectedCedant) {
      toast.error('Sélectionne ou crée le cédant (propriétaire qui abandonne).')
      return
    }
    if (motif === 'autre' && !motifDetails.trim()) {
      toast.error('Précise le motif quand tu choisis « Autre ».')
      return
    }

    const parsedAmount = amount ? parseFloat(amount) : 0
    if (amount && (isNaN(parsedAmount) || parsedAmount < 0)) {
      toast.error('Le montant doit être un nombre positif.')
      return
    }

    const payload = {
      animal_id: animalId,
      cedant_client_id: selectedCedant.id,
      signature_date: signatureDate,
      expected_handover_date: expectedHandoverDate || null,
      motif,
      motif_details: motif === 'autre' ? motifDetails.trim() : null,
      amount: parsedAmount,
      note: note.trim() || null,
      cedant_id_card_number: cedantIdCard.trim() || null,
      cedant_passport_number: cedantPassport.trim() || null,
      signed_at_location: signedAtLocation.trim() || null,
    }

    startTransition(async () => {
      const result = isEdit
        ? await updateAbandonmentContract(contract.id, payload)
        : await createAbandonmentContract(payload)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(isEdit ? 'Contrat mis à jour' : 'Contrat d\'abandon créé')
      router.refresh()
      onClose?.()
    })
  }

  const inputClass = 'w-full px-3 py-2 bg-surface-dark border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50'
  const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5'

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Cédant */}
      <div>
        <div className={labelClass}>Cédant (propriétaire qui abandonne) *</div>
        <CedantPicker
          establishmentId={establishmentId}
          selected={selectedCedant}
          onSelect={setSelectedCedant}
          onCreateClick={() => setShowCreateModal(true)}
        />
      </div>

      {/* Dates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="ab-sig-date" className={labelClass}>Date du contrat *</label>
          <input id="ab-sig-date" type="date" required value={signatureDate}
            onChange={(e) => setSignatureDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="ab-handover" className={labelClass}>Date de remise prévue</label>
          <input id="ab-handover" type="date" value={expectedHandoverDate}
            onChange={(e) => setExpectedHandoverDate(e.target.value)} className={inputClass} />
          <p className="text-[10px] text-muted/70 mt-1">Quand l&apos;animal arrivera physiquement</p>
        </div>
      </div>

      {/* Motif */}
      <div>
        <label htmlFor="ab-motif" className={labelClass}>Motif de l&apos;abandon *</label>
        <select id="ab-motif" value={motif} required
          onChange={(e) => setMotif(e.target.value as AbandonmentMotif)}
          className={inputClass}>
          {MOTIFS.map((m) => (
            <option key={m} value={m}>{ABANDONMENT_MOTIF_LABELS[m]}</option>
          ))}
        </select>
        {motif === 'autre' && (
          <input
            type="text"
            value={motifDetails}
            onChange={(e) => setMotifDetails(e.target.value)}
            placeholder="Précisez le motif"
            required
            className={`${inputClass} mt-2`}
          />
        )}
      </div>

      {/* Identifiants cédant */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="ab-idcard" className={labelClass}>N° carte d&apos;identité</label>
          <input id="ab-idcard" type="text" value={cedantIdCard}
            onChange={(e) => setCedantIdCard(e.target.value)}
            placeholder="Optionnel" className={inputClass} />
        </div>
        <div>
          <label htmlFor="ab-passport" className={labelClass}>N° passeport</label>
          <input id="ab-passport" type="text" value={cedantPassport}
            onChange={(e) => setCedantPassport(e.target.value)}
            placeholder="Optionnel" className={inputClass} />
        </div>
      </div>

      {/* Montant + lieu */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="ab-amount" className={labelClass}>Montant de l&apos;abandon (€)</label>
          <input id="ab-amount" type="number" min="0" step="0.01"
            value={amount} onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00" className={inputClass} />
        </div>
        <div>
          <label htmlFor="ab-location" className={labelClass}>Lieu de signature</label>
          <input id="ab-location" type="text" value={signedAtLocation}
            onChange={(e) => setSignedAtLocation(e.target.value)}
            placeholder="Estourmel" className={inputClass} />
        </div>
      </div>

      {/* Note */}
      <div>
        <label htmlFor="ab-note" className={labelClass}>Note</label>
        <textarea id="ab-note" value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="Note libre qui apparaîtra sur le contrat..."
          rows={3} className={`${inputClass} resize-y`} />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
        {onClose && (
          <button type="button" onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-surface-hover transition-colors">
            Annuler
          </button>
        )}
        <button type="submit" disabled={isPending}
          className="gradient-primary hover:opacity-90 transition-opacity text-white px-5 py-2 rounded-lg font-semibold text-sm disabled:opacity-50 inline-flex items-center gap-2">
          {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {isEdit ? 'Mettre à jour' : 'Créer le contrat'}
        </button>
      </div>

      {showCreateModal && (
        <CreateCedantModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(c) => {
            setSelectedCedant(c)
            setShowCreateModal(false)
          }}
        />
      )}
    </form>
  )
}

// ===========================================================================
// CedantPicker : autocomplete + bouton + (clone allégé de DonorPicker)
// ===========================================================================
function CedantPicker({
  establishmentId, selected, onSelect, onCreateClick,
}: Readonly<{
  establishmentId: string
  selected: CedantOption | null
  onSelect: (c: CedantOption | null) => void
  onCreateClick: () => void
}>) {
  const supabase = createSupabaseClient()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CedantOption[]>([])
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
      setResults((data as CedantOption[]) || [])
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
        <button type="button" onClick={() => onSelect(null)}
          className="text-muted hover:text-danger transition-colors p-1" title="Changer">
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
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsOpen(true)}
            placeholder="Rechercher dans le répertoire..."
            className="w-full pl-10 pr-3 py-2.5 bg-surface-dark border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        <button type="button" onClick={onCreateClick}
          className="px-3 py-2.5 rounded-lg gradient-primary hover:opacity-90 transition-opacity text-white text-sm font-semibold inline-flex items-center gap-1.5 shrink-0">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nouveau</span>
        </button>
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-12 mt-1 bg-surface border border-border rounded-lg shadow-xl z-20 max-h-72 overflow-y-auto">
          {results.map((c) => {
            const label = getClientDisplayName(c)
            return (
              <button key={c.id} type="button"
                onClick={() => { onSelect(c); setQuery(''); setIsOpen(false) }}
                className="w-full text-left px-4 py-2.5 hover:bg-surface-hover transition-colors flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {(label[0] || '?').toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{label}</p>
                  <p className="text-xs text-muted truncate">{[c.email, c.city].filter(Boolean).join(' · ') || '—'}</p>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ===========================================================================
// CreateCedantModal : création express d'un contact dans le répertoire
// ===========================================================================
function CreateCedantModal({
  onClose, onCreated,
}: Readonly<{
  onClose: () => void
  onCreated: (c: CedantOption) => void
}>) {
  const [kind, setKind] = useState<ClientKind>('person')
  const [name, setName] = useState('')
  const [firstName, setFirstName] = useState('')
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
      toast.error(isPerson ? 'Nom obligatoire' : 'Nom de l\'organisation obligatoire')
      return
    }
    if (isPerson && !firstName.trim()) {
      toast.error('Prénom obligatoire')
      return
    }
    startTransition(async () => {
      const result = await createClientAction({
        kind,
        name: name.trim(),
        first_name: isPerson ? firstName.trim() : null,
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
      toast.success('Cédant créé dans le répertoire')
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
          <h3 className="text-base font-semibold">Nouveau cédant</h3>
          <button type="button" onClick={onClose} className="text-muted hover:text-foreground p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="inline-flex rounded-lg border border-border p-1 bg-surface-dark">
            <button type="button" onClick={() => setKind('person')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${isPerson ? 'gradient-primary text-white font-semibold' : 'text-muted hover:text-foreground'}`}>
              Particulier
            </button>
            <button type="button" onClick={() => setKind('organization')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${!isPerson ? 'gradient-primary text-white font-semibold' : 'text-muted hover:text-foreground'}`}>
              Organisation
            </button>
          </div>

          {isPerson ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="cc-name" className={labelClass}>Nom *</label>
                <input id="cc-name" type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="DUPONT" className={inputClass} />
              </div>
              <div>
                <label htmlFor="cc-firstname" className={labelClass}>Prénom *</label>
                <input id="cc-firstname" type="text" required value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jean" className={inputClass} />
              </div>
            </div>
          ) : (
            <div>
              <label htmlFor="cc-orgname" className={labelClass}>Nom de l&apos;organisation *</label>
              <input id="cc-orgname" type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="..." className={inputClass} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="cc-email" className={labelClass}>Email</label>
              <input id="cc-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="cc-phone" className={labelClass}>Téléphone</label>
              <input id="cc-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div>
            <label htmlFor="cc-address" className={labelClass}>Adresse</label>
            <input id="cc-address" type="text" value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="cc-postal" className={labelClass}>Code postal</label>
              <input id="cc-postal" type="text" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="cc-city" className={labelClass}>Ville</label>
              <input id="cc-city" type="text" value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button type="button" onClick={onClose} className="px-3 py-2 rounded-lg border border-border text-sm hover:bg-surface-hover transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={isPending}
              className="gradient-primary hover:opacity-90 transition-opacity text-white px-4 py-2 rounded-lg font-semibold text-sm disabled:opacity-50 inline-flex items-center gap-2">
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Créer et sélectionner
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
