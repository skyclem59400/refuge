'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, X, Loader2, Search, Ban } from 'lucide-react'
import { AddressAutocomplete, type BanSelection } from '@/components/ui/address-autocomplete'
import { DatePicker } from '@/components/ui/date-picker'
import {
  addManualBlacklist,
  searchClientsForBlacklistPicker,
  type NewBlacklistClientPayload,
} from '@/lib/actions/blacklist'
import { BLACKLIST_SOURCE_LABELS, type BlacklistSource } from '@/lib/types/database'

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

export function BlacklistAddButton() {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white text-sm bg-error hover:opacity-90 transition-opacity shadow-lg shadow-error/25"
      >
        <Plus className="w-4 h-4" />
        Ajouter manuellement
      </button>
      {isOpen && <AddModal onClose={() => setIsOpen(false)} />}
    </>
  )
}

type Step = 'search' | 'form'

function AddModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>('search')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  // Step 1
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)

  // Step 2
  const [kind, setKind] = useState<'person' | 'organization'>('person')
  const [lastName, setLastName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [birthPlace, setBirthPlace] = useState('')
  const [nationalId, setNationalId] = useState('')
  const [address, setAddress] = useState<BanSelection | null>(null)
  const [reason, setReason] = useState('')
  const [source, setSource] = useState<BlacklistSource>('manual')

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

  const handleAddExisting = useCallback((clientId: string) => {
    setStep('form')
    // Pré-rempli dans le form pour lui demander un motif
    const target = results.find((r) => r.id === clientId)
    if (target) {
      setLastName(target.name)
      setFirstName(target.first_name ?? '')
      setEmail(target.email ?? '')
      setPhone(target.phone ?? '')
      // On garde référence via state local pour soumettre via client_id
      setExistingId(clientId)
    }
  }, [results])

  const [existingId, setExistingId] = useState<string | null>(null)

  const handleSubmit = useCallback(() => {
    if (reason.trim().length < 10) {
      toast.error('Le motif doit faire au moins 10 caractères')
      return
    }
    startTransition(async () => {
      const res = await addManualBlacklist(
        existingId
          ? { client_id: existingId, reason: reason.trim(), source }
          : {
              new_client_data: {
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
              } satisfies NewBlacklistClientPayload,
              reason: reason.trim(),
              source,
            },
      )
      if ('error' in res) {
        toast.error(res.error)
      } else {
        toast.success('Contact inscrit sur la liste noire')
        onClose()
        router.refresh()
      }
    })
  }, [
    existingId, kind, lastName, firstName, email, phone, address, birthDate, birthPlace,
    nationalId, reason, source, onClose, router,
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
            <Ban className="w-5 h-5 text-error" />
            {step === 'search' ? 'Inscrire un contact — recherche' : 'Inscrire un contact — détails'}
          </h3>
          <button type="button" onClick={onClose} className="text-muted hover:text-text">
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === 'search' && (
          <div className="p-5 space-y-4">
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
                  {query ? 'Aucun contact trouvé' : 'Tapez pour rechercher un contact existant…'}
                </p>
              ) : (
                results.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleAddExisting(c.id)}
                    disabled={c.is_blacklisted}
                    className="w-full text-left p-3 hover:bg-surface-hover transition-colors flex items-start gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  setExistingId(null)
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
            <button
              type="button"
              onClick={() => setStep('search')}
              className="text-xs text-muted hover:text-text"
            >
              ← Retour à la recherche
            </button>

            {existingId && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-600">
                Contact existant sélectionné. Renseignez le motif et la source ci-dessous.
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {!existingId && (
                <>
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
                          {k === 'person' ? 'Personne physique' : 'Personne morale'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>{kind === 'person' ? 'Nom *' : 'Raison sociale *'}</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      className={inputClass}
                    />
                  </div>
                  {kind === 'person' && (
                    <div>
                      <label className={labelClass}>Prénom</label>
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  )}
                  <div>
                    <label className={labelClass}>Email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Téléphone</label>
                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
                  </div>
                  {kind === 'person' && (
                    <>
                      <div>
                        <label className={labelClass}>Date de naissance</label>
                        <DatePicker value={birthDate} onChange={(v) => setBirthDate(v ?? '')} />
                      </div>
                      <div>
                        <label className={labelClass}>Lieu de naissance</label>
                        <input type="text" value={birthPlace} onChange={(e) => setBirthPlace(e.target.value)} className={inputClass} />
                      </div>
                      <div className="md:col-span-2">
                        <label className={labelClass}>N° pièce d&apos;identité (optionnel)</label>
                        <input type="text" value={nationalId} onChange={(e) => setNationalId(e.target.value)} className={inputClass} />
                      </div>
                    </>
                  )}
                  <div className="md:col-span-2">
                    <label className={labelClass}>Adresse</label>
                    <AddressAutocomplete value={address} onChange={setAddress} />
                  </div>
                </>
              )}

              <div className="md:col-span-2">
                <label className={labelClass}>Source *</label>
                <div className="flex gap-2 flex-wrap">
                  {(Object.keys(BLACKLIST_SOURCE_LABELS) as BlacklistSource[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSource(s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        source === s ? 'bg-error text-white border-error' : 'bg-surface border-border hover:bg-surface-hover'
                      }`}
                    >
                      {BLACKLIST_SOURCE_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="md:col-span-2">
                <label className={labelClass}>
                  Motif d&apos;inscription * <span className="text-muted">(min. 10 caractères)</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  required
                  placeholder="Description précise des faits / motifs justifiant l'inscription..."
                  className={`${inputClass} resize-y`}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="px-4 py-2 rounded-lg text-sm text-muted border border-border hover:bg-surface-dark transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isPending || reason.trim().length < 10}
                onClick={handleSubmit}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-error text-white hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                <Ban className="w-4 h-4" />
                Inscrire sur la liste noire
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
