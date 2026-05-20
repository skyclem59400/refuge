'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Ban, UserX, Search, Loader2, X, Edit, Unlink, ShieldAlert } from 'lucide-react'
import { AddressAutocomplete, type BanSelection } from '@/components/ui/address-autocomplete'
import { DatePicker } from '@/components/ui/date-picker'
import {
  upsertJudicialOwner,
  detachJudicialOwner,
  searchClientsForBlacklistPicker,
  type NewBlacklistClientPayload,
} from '@/lib/actions/blacklist'

interface CurrentOwner {
  client_id: string
  name: string
  first_name: string | null
  blacklist_reason: string | null
  blacklist_source: string | null
}

interface Props {
  readonly animalId: string
  readonly animalName: string
  /** Lien actuel : si renseigné, on affiche le bloc compact. */
  readonly current: CurrentOwner | null
  readonly canEdit: boolean
}

export function JudicialOwnerPicker({ animalId, animalName, current, canEdit }: Props) {
  const [isModalOpen, setModalOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleDetach = () => {
    if (!confirm('Détacher le propriétaire de cet animal ? Le contact restera sur la liste noire SDA mais ne sera plus associé à cette fiche animal.')) {
      return
    }
    startTransition(async () => {
      const res = await detachJudicialOwner(animalId)
      if ('error' in res) {
        toast.error(res.error)
      } else {
        toast.success('Propriétaire détaché de l\'animal')
        router.refresh()
      }
    })
  }

  if (current) {
    return (
      <div className="rounded-lg border-2 border-error/30 bg-error/5 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-semibold text-text text-sm">
                {current.first_name ? `${current.name} ${current.first_name}` : current.name}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-error/15 text-error border border-error/30">
                <Ban className="w-3 h-3" />
                LISTE NOIRE
              </span>
            </div>
            {current.blacklist_reason && (
              <p className="text-xs text-muted line-clamp-2 mt-1">{current.blacklist_reason}</p>
            )}
          </div>
          {canEdit && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                disabled={isPending}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-surface border border-border hover:bg-surface-hover transition-colors disabled:opacity-50"
                title="Modifier"
              >
                <Edit className="w-3 h-3" /> Modifier
              </button>
              <button
                type="button"
                onClick={handleDetach}
                disabled={isPending}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-surface border border-border hover:bg-surface-hover transition-colors disabled:opacity-50"
                title="Détacher (le contact reste blacklisté)"
              >
                <Unlink className="w-3 h-3" /> Détacher
              </button>
            </div>
          )}
        </div>
        {isModalOpen && (
          <JudicialOwnerModal
            animalId={animalId}
            animalName={animalName}
            initialClientId={current.client_id}
            onClose={() => setModalOpen(false)}
            onSuccess={() => {
              setModalOpen(false)
              router.refresh()
            }}
          />
        )}
      </div>
    )
  }

  return (
    <div>
      {canEdit ? (
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-error/10 text-error border border-error/30 hover:bg-error/20 transition-colors"
        >
          <UserX className="w-4 h-4" />
          Renseigner le propriétaire mis en cause
        </button>
      ) : (
        <p className="text-xs text-muted italic">Aucun propriétaire renseigné</p>
      )}
      {isModalOpen && (
        <JudicialOwnerModal
          animalId={animalId}
          animalName={animalName}
          onClose={() => setModalOpen(false)}
          onSuccess={() => {
            setModalOpen(false)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

// ============================================================
// Modal en 2 steps
// ============================================================

interface ModalProps {
  readonly animalId: string
  readonly animalName: string
  readonly initialClientId?: string
  readonly onClose: () => void
  readonly onSuccess: () => void
}

type Step = 'search' | 'form'

interface SearchResult {
  id: string
  kind: 'person' | 'organization'
  name: string
  first_name: string | null
  email: string | null
  phone: string | null
  city: string | null
  is_blacklisted: boolean
}

function JudicialOwnerModal({ animalId, animalName, initialClientId, onClose, onSuccess }: ModalProps) {
  const [step, setStep] = useState<Step>(initialClientId ? 'form' : 'search')
  const [selectedClientId, setSelectedClientId] = useState<string | null>(initialClientId ?? null)
  const [isPending, startTransition] = useTransition()

  // Step 1 — search
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)

  // Step 2 — form
  const [kind, setKind] = useState<'person' | 'organization'>('person')
  const [lastName, setLastName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [birthPlace, setBirthPlace] = useState('')
  const [nationalId, setNationalId] = useState('')
  const [address, setAddress] = useState<BanSelection | null>(null)
  const [reason, setReason] = useState(`Procédure judiciaire — animal : ${animalName}`)

  // Search debounce
  useEffect(() => {
    if (step !== 'search') return
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await searchClientsForBlacklistPicker(query)
        if ('data' in res) setResults(res.data as SearchResult[])
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [query, step])

  const handleSubmitExisting = useCallback((clientId: string) => {
    startTransition(async () => {
      const res = await upsertJudicialOwner({
        animal_id: animalId,
        client_id: clientId,
        reason: reason.trim(),
      })
      if ('error' in res) {
        toast.error(res.error)
      } else {
        toast.success('Propriétaire mis en cause enregistré et inscrit sur la liste noire')
        onSuccess()
      }
    })
  }, [animalId, reason, onSuccess])

  const handleSubmitNew = useCallback(() => {
    if (!lastName.trim()) {
      toast.error('Le nom est obligatoire')
      return
    }
    if (!reason.trim() || reason.trim().length < 10) {
      toast.error('Le motif d\'inscription doit faire au moins 10 caractères')
      return
    }
    const payload: NewBlacklistClientPayload = {
      kind,
      name: lastName.trim(),
      first_name: firstName.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      address: address?.label ?? null,
      postal_code: address?.postcode ?? null,
      city: address?.city ?? null,
      birth_date: birthDate || null,
      birth_place: birthPlace.trim() || null,
      national_id: nationalId.trim() || null,
    }
    startTransition(async () => {
      const res = await upsertJudicialOwner({
        animal_id: animalId,
        new_client_data: payload,
        reason: reason.trim(),
      })
      if ('error' in res) {
        toast.error(res.error)
      } else {
        toast.success('Propriétaire enregistré et inscrit sur la liste noire SDA')
        onSuccess()
      }
    })
  }, [
    animalId, kind, lastName, firstName, email, phone, address, birthDate, birthPlace,
    nationalId, reason, onSuccess,
  ])

  const inputClass = 'w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50'
  const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5'

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-surface border border-border rounded-xl w-full max-w-2xl my-8 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-error" />
            {step === 'search' ? 'Sélectionner le propriétaire mis en cause' : 'Fiche propriétaire — Liste noire SDA'}
          </h3>
          <button type="button" onClick={onClose} className="text-muted hover:text-text">
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === 'search' && (
          <div className="p-5 space-y-4">
            <p className="text-xs text-muted">
              Recherchez le contact dans le répertoire. S&apos;il n&apos;existe pas, créez-en un nouveau.
              Il sera automatiquement inscrit sur la liste noire SDA.
            </p>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nom, prénom, email, téléphone..."
                className="w-full pl-9 pr-3 py-2 bg-surface-dark border border-border rounded-lg text-sm"
                autoFocus
              />
              {loading && <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted" />}
            </div>

            <div className="max-h-64 overflow-y-auto border border-border rounded-lg divide-y divide-border">
              {results.length === 0 ? (
                <p className="text-sm text-muted text-center p-4">
                  {query ? 'Aucun contact trouvé' : 'Tapez pour rechercher…'}
                </p>
              ) : (
                results.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSubmitExisting(c.id)}
                    disabled={isPending}
                    className="w-full text-left p-3 hover:bg-surface-hover transition-colors flex items-start gap-3 disabled:opacity-50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">
                          {c.first_name ? `${c.name} ${c.first_name}` : c.name}
                        </span>
                        {c.is_blacklisted && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-error/15 text-error border border-error/30">
                            <Ban className="w-2.5 h-2.5" />
                            DÉJÀ BLACKLISTÉ
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted truncate mt-0.5">
                        {[c.email, c.phone, c.city].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  setLastName(query.trim())
                  setStep('form')
                }}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-primary text-white hover:opacity-90 transition-opacity"
              >
                + Créer un nouveau contact
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 rounded-lg text-sm text-muted border border-border hover:bg-surface-dark transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {step === 'form' && (
          <div className="p-5 space-y-4">
            {!initialClientId && (
              <button
                type="button"
                onClick={() => setStep('search')}
                className="text-xs text-muted hover:text-text"
              >
                ← Retour à la recherche
              </button>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className={labelClass}>Type</label>
                <div className="flex gap-2">
                  {(['person', 'organization'] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setKind(k)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        kind === k ? 'bg-primary text-white border-primary' : 'bg-surface border-border hover:bg-surface-hover'
                      }`}
                    >
                      {k === 'person' ? 'Personne physique' : 'Personne morale / organisation'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="bl-lastname" className={labelClass}>{kind === 'person' ? 'Nom *' : 'Raison sociale *'}</label>
                <input
                  id="bl-lastname"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
              {kind === 'person' && (
                <div>
                  <label htmlFor="bl-firstname" className={labelClass}>Prénom</label>
                  <input
                    id="bl-firstname"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={inputClass}
                  />
                </div>
              )}

              <div>
                <label htmlFor="bl-email" className={labelClass}>Email</label>
                <input
                  id="bl-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="bl-phone" className={labelClass}>Téléphone</label>
                <input
                  id="bl-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={inputClass}
                />
              </div>

              {kind === 'person' && (
                <>
                  <div>
                    <label htmlFor="bl-birthdate" className={labelClass}>Date de naissance</label>
                    <DatePicker
                      id="bl-birthdate"
                      value={birthDate}
                      onChange={(v) => setBirthDate(v ?? '')}
                    />
                  </div>
                  <div>
                    <label htmlFor="bl-birthplace" className={labelClass}>Lieu de naissance</label>
                    <input
                      id="bl-birthplace"
                      type="text"
                      value={birthPlace}
                      onChange={(e) => setBirthPlace(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor="bl-nationalid" className={labelClass}>N° pièce d&apos;identité (optionnel)</label>
                    <input
                      id="bl-nationalid"
                      type="text"
                      value={nationalId}
                      onChange={(e) => setNationalId(e.target.value)}
                      placeholder="CNI / passeport..."
                      className={inputClass}
                    />
                  </div>
                </>
              )}

              <div className="md:col-span-2">
                <label className={labelClass}>Adresse</label>
                <AddressAutocomplete
                  value={address}
                  onChange={setAddress}
                  placeholder="Rechercher une adresse française..."
                />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="bl-reason" className={labelClass}>
                  Motif d&apos;inscription sur la liste noire * <span className="text-muted">(min. 10 caractères)</span>
                </label>
                <textarea
                  id="bl-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  required
                  className={`${inputClass} resize-y`}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm text-muted border border-border hover:bg-surface-dark transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleSubmitNew}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-error text-white hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                <Ban className="w-4 h-4" />
                {initialClientId ? 'Mettre à jour' : 'Inscrire sur la liste noire'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
