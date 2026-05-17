'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  X,
  Loader2,
  Search,
  Euro,
  CalendarDays,
  HandHeart,
  Heart,
  UserPlus,
  Check,
} from 'lucide-react'
import {
  createSponsorship,
  updateSponsorship,
  endSponsorship,
} from '@/lib/actions/sponsorships'
import { searchAllClients, createClientAction } from '@/lib/actions/clients'
import {
  getClientDisplayName,
  SPONSORSHIP_ENDED_REASON_LABELS,
  type Sponsorship,
  type SponsorshipKind,
  type SponsorshipEndedReason,
} from '@/lib/types/database'

interface ClientSearchResult {
  id: string
  kind: 'person' | 'organization'
  name: string
  first_name: string | null
  contact_person?: string | null
  email: string | null
  phone: string | null
  city: string | null
  type?: string | null
}

interface SelectedClient {
  id: string
  kind: 'person' | 'organization'
  name: string
  first_name: string | null
  city: string | null
}

interface BaseProps {
  animalId: string
  onClose: () => void
}

type Props =
  | (BaseProps & { mode: 'create'; sponsorship?: undefined })
  | (BaseProps & { mode: 'edit'; sponsorship: Sponsorship & { client?: SelectedClient | null } })

const KIND_OPTIONS: { value: SponsorshipKind; label: string; description: string; icon: React.ElementType }[] = [
  {
    value: 'financial_monthly',
    label: 'Mensuel',
    description: 'Don récurrent chaque mois',
    icon: Euro,
  },
  {
    value: 'financial_punctual',
    label: 'Ponctuel',
    description: 'Don unique ou occasionnel',
    icon: HandHeart,
  },
  {
    value: 'symbolic',
    label: 'Symbolique',
    description: 'Sans contribution financière',
    icon: Heart,
  },
]

export function SponsorshipModal(props: Props) {
  const { animalId, mode, onClose } = props
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Client selection (create only)
  const initialClient: SelectedClient | null =
    mode === 'edit' && props.sponsorship.client
      ? {
          id: props.sponsorship.client.id,
          kind: props.sponsorship.client.kind,
          name: props.sponsorship.client.name,
          first_name: props.sponsorship.client.first_name,
          city: props.sponsorship.client.city,
        }
      : null

  const [selectedClient, setSelectedClient] = useState<SelectedClient | null>(initialClient)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<ClientSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Inline create client form
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newClient, setNewClient] = useState({
    kind: 'person' as 'person' | 'organization',
    name: '',
    first_name: '',
    email: '',
    phone: '',
  })

  // Sponsorship fields
  const today = new Date().toISOString().slice(0, 10)
  const [kind, setKind] = useState<SponsorshipKind>(
    mode === 'edit' ? props.sponsorship.kind : 'financial_monthly'
  )
  const [monthlyAmount, setMonthlyAmount] = useState<string>(
    mode === 'edit' && props.sponsorship.monthly_amount != null
      ? String(props.sponsorship.monthly_amount)
      : ''
  )
  const [startedAt, setStartedAt] = useState<string>(
    mode === 'edit' ? props.sponsorship.started_at : today
  )
  const [publicAlias, setPublicAlias] = useState<string>(
    mode === 'edit' ? props.sponsorship.public_alias ?? '' : ''
  )
  const [showPublicly, setShowPublicly] = useState<boolean>(
    mode === 'edit' ? props.sponsorship.show_publicly : false
  )
  const [notes, setNotes] = useState<string>(
    mode === 'edit' ? props.sponsorship.notes ?? '' : ''
  )

  // Debounced search
  useEffect(() => {
    if (mode === 'edit' || selectedClient) return
    if (showCreateForm) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      if (search.trim().length === 0) {
        setResults([])
        return
      }
      setSearching(true)
      const res = await searchAllClients(search.trim())
      if ('data' in res && res.data) {
        setResults(res.data as ClientSearchResult[])
      } else {
        setResults([])
      }
      setSearching(false)
    }, 250)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search, selectedClient, showCreateForm, mode])

  function handleSelectClient(c: ClientSearchResult) {
    setSelectedClient({
      id: c.id,
      kind: c.kind,
      name: c.name,
      first_name: c.first_name,
      city: c.city,
    })
    setSearch('')
    setResults([])
    setShowResults(false)
    setShowCreateForm(false)
  }

  function handleClearClient() {
    setSelectedClient(null)
  }

  function handleCreateClient() {
    if (!newClient.name.trim()) {
      toast.error('Le nom est obligatoire.')
      return
    }
    startTransition(async () => {
      const res = await createClientAction({
        kind: newClient.kind,
        name: newClient.name.trim(),
        first_name: newClient.first_name.trim() || null,
        email: newClient.email.trim() || null,
        phone: newClient.phone.trim() || null,
        type: 'client',
      })
      if ('error' in res && res.error) {
        toast.error(res.error)
        return
      }
      if ('data' in res && res.data) {
        const created = res.data as {
          id: string
          kind: 'person' | 'organization'
          name: string
          first_name: string | null
          city: string | null
        }
        setSelectedClient({
          id: created.id,
          kind: created.kind,
          name: created.name,
          first_name: created.first_name,
          city: created.city,
        })
        setShowCreateForm(false)
        toast.success('Client créé.')
      }
    })
  }

  function handleSubmit() {
    if (mode === 'create' && !selectedClient) {
      toast.error('Sélectionnez un parrain.')
      return
    }
    if (!startedAt) {
      toast.error('Date de début requise.')
      return
    }
    const monthly =
      kind === 'financial_monthly' && monthlyAmount.trim()
        ? Number(monthlyAmount.replace(',', '.'))
        : null
    if (kind === 'financial_monthly' && monthlyAmount.trim() && (monthly == null || isNaN(monthly) || monthly < 0)) {
      toast.error('Montant mensuel invalide.')
      return
    }

    startTransition(async () => {
      if (mode === 'create') {
        const res = await createSponsorship({
          animal_id: animalId,
          client_id: selectedClient!.id,
          kind,
          monthly_amount: monthly,
          started_at: startedAt,
          public_alias: publicAlias.trim() || null,
          show_publicly: showPublicly,
          notes: notes.trim() || null,
        })
        if (res.error) {
          toast.error(res.error)
          return
        }
        toast.success('Parrain ajouté.')
        router.refresh()
        onClose()
      } else {
        const res = await updateSponsorship(props.sponsorship.id, {
          kind,
          monthly_amount: monthly,
          public_alias: publicAlias.trim() || null,
          show_publicly: showPublicly,
          notes: notes.trim() || null,
        })
        if (res.error) {
          toast.error(res.error)
          return
        }
        toast.success('Parrainage mis à jour.')
        router.refresh()
        onClose()
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-surface border-b border-border px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <HandHeart className="w-5 h-5 text-primary" />
              {mode === 'create' ? 'Ajouter un parrain' : 'Modifier le parrainage'}
            </h2>
            <p className="text-sm text-muted mt-0.5">
              {mode === 'create'
                ? "Associer un client à cet animal en tant que parrain"
                : 'Mettre à jour les informations du parrainage'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-surface-dark text-muted hover:text-text"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Client picker (create only) */}
          {mode === 'create' && (
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">
                Parrain
              </label>
              {selectedClient ? (
                <div className="flex items-center justify-between gap-3 p-3 bg-primary/10 border border-primary/30 rounded-lg">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">
                      {getClientDisplayName(selectedClient)}
                    </div>
                    {selectedClient.city && (
                      <div className="text-xs text-muted truncate">{selectedClient.city}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleClearClient}
                    className="p-1.5 rounded-md text-muted hover:bg-surface-dark hover:text-text"
                    aria-label="Changer de parrain"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : showCreateForm ? (
                <div className="space-y-3 p-4 bg-surface-dark border border-border rounded-lg">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewClient((s) => ({ ...s, kind: 'person' }))}
                      className={`py-1.5 text-sm rounded ${newClient.kind === 'person' ? 'bg-primary text-white' : 'bg-surface text-muted'}`}
                    >
                      Personne
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewClient((s) => ({ ...s, kind: 'organization' }))}
                      className={`py-1.5 text-sm rounded ${newClient.kind === 'organization' ? 'bg-primary text-white' : 'bg-surface text-muted'}`}
                    >
                      Organisation
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={newClient.name}
                      onChange={(e) => setNewClient((s) => ({ ...s, name: e.target.value }))}
                      placeholder={newClient.kind === 'organization' ? 'Raison sociale *' : 'Nom *'}
                      className="px-3 py-2 bg-surface border border-border rounded-md text-sm"
                    />
                    {newClient.kind === 'person' && (
                      <input
                        type="text"
                        value={newClient.first_name}
                        onChange={(e) => setNewClient((s) => ({ ...s, first_name: e.target.value }))}
                        placeholder="Prénom"
                        className="px-3 py-2 bg-surface border border-border rounded-md text-sm"
                      />
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="email"
                      value={newClient.email}
                      onChange={(e) => setNewClient((s) => ({ ...s, email: e.target.value }))}
                      placeholder="Email"
                      className="px-3 py-2 bg-surface border border-border rounded-md text-sm"
                    />
                    <input
                      type="tel"
                      value={newClient.phone}
                      onChange={(e) => setNewClient((s) => ({ ...s, phone: e.target.value }))}
                      placeholder="Téléphone"
                      className="px-3 py-2 bg-surface border border-border rounded-md text-sm"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="px-3 py-1.5 text-xs text-muted hover:text-text"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateClient}
                      disabled={isPending || !newClient.name.trim()}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
                    >
                      {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Créer et sélectionner
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onFocus={() => setShowResults(true)}
                    placeholder="Rechercher un client (nom, email, ville)..."
                    className="w-full pl-9 pr-3 py-2.5 bg-surface-dark border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                  {showResults && (search.trim().length > 0 || results.length > 0) && (
                    <div className="absolute left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-xl max-h-64 overflow-y-auto z-20">
                      {searching && (
                        <div className="flex items-center gap-2 px-3 py-3 text-xs text-muted">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Recherche...
                        </div>
                      )}
                      {!searching && results.length === 0 && search.trim().length > 0 && (
                        <div className="px-3 py-3 text-xs text-muted">
                          Aucun client trouvé.
                        </div>
                      )}
                      {results.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleSelectClient(c)}
                          className="w-full text-left px-3 py-2 hover:bg-surface-dark transition-colors border-b border-border last:border-0"
                        >
                          <div className="text-sm font-medium">
                            {getClientDisplayName(c)}
                          </div>
                          <div className="text-xs text-muted">
                            {[c.city, c.email, c.phone].filter(Boolean).join(' · ')}
                          </div>
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateForm(true)
                          setShowResults(false)
                          setNewClient((s) => ({
                            ...s,
                            name: search.trim().split(/\s+/)[0] ?? '',
                            first_name: search.trim().split(/\s+/).slice(1).join(' '),
                          }))
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-primary hover:bg-primary/10 transition-colors border-t border-border"
                      >
                        <UserPlus className="w-4 h-4" />
                        Créer un nouveau client
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {mode === 'edit' && selectedClient && (
            <div className="p-3 bg-surface-dark border border-border rounded-lg">
              <div className="text-xs text-muted uppercase tracking-wider mb-0.5">Parrain</div>
              <div className="text-sm font-semibold">{getClientDisplayName(selectedClient)}</div>
              {selectedClient.city && (
                <div className="text-xs text-muted">{selectedClient.city}</div>
              )}
            </div>
          )}

          {/* Kind selector */}
          <div>
            <label className="block text-xs font-medium text-muted mb-2 uppercase tracking-wider">
              Type de parrainage
            </label>
            <div className="grid grid-cols-3 gap-2">
              {KIND_OPTIONS.map((opt) => {
                const Icon = opt.icon
                const isActive = kind === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setKind(opt.value)}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      isActive
                        ? 'bg-primary/10 border-primary text-text'
                        : 'bg-surface-dark border-border text-muted hover:text-text hover:border-border/80'
                    }`}
                  >
                    <Icon className={`w-4 h-4 mb-1.5 ${isActive ? 'text-primary' : 'text-muted'}`} />
                    <div className="text-sm font-semibold">{opt.label}</div>
                    <div className="text-[11px] text-muted leading-tight mt-0.5">
                      {opt.description}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Monthly amount (only for financial_monthly) */}
          {kind === 'financial_monthly' && (
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">
                Montant mensuel (optionnel)
              </label>
              <div className="relative max-w-[200px]">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={monthlyAmount}
                  onChange={(e) => setMonthlyAmount(e.target.value)}
                  placeholder="0,00"
                  className="w-full pl-3 pr-9 py-2 bg-surface-dark border border-border rounded-md text-sm"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-sm">€</span>
              </div>
            </div>
          )}

          {/* Start date */}
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">
              Date de début
            </label>
            <div className="relative max-w-[220px]">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
              <input
                type="date"
                value={startedAt}
                onChange={(e) => setStartedAt(e.target.value)}
                disabled={mode === 'edit'}
                className="w-full pl-9 pr-3 py-2 bg-surface-dark border border-border rounded-md text-sm disabled:opacity-60"
              />
            </div>
            {mode === 'edit' && (
              <p className="text-[11px] text-muted mt-1">
                La date de début n&apos;est pas modifiable.
              </p>
            )}
          </div>

          {/* Public alias */}
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">
              Nom public (alias)
            </label>
            <input
              type="text"
              value={publicAlias}
              onChange={(e) => setPublicAlias(e.target.value)}
              placeholder="Laisser vide pour utiliser le nom complet"
              className="w-full px-3 py-2 bg-surface-dark border border-border rounded-md text-sm"
            />
          </div>

          {/* Show publicly */}
          <label className="flex items-start gap-3 p-3 bg-surface-dark border border-border rounded-lg cursor-pointer hover:border-border/80">
            <input
              type="checkbox"
              checked={showPublicly}
              onChange={(e) => setShowPublicly(e.target.checked)}
              className="mt-0.5"
            />
            <div>
              <div className="text-sm font-medium">Affichage public</div>
              <div className="text-xs text-muted">
                Autoriser l&apos;affichage de ce parrainage sur le portail public.
              </div>
            </div>
          </label>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Informations complémentaires (optionnel)"
              className="w-full px-3 py-2 bg-surface-dark border border-border rounded-md text-sm resize-y"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-surface border-t border-border px-6 py-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 rounded-lg text-sm font-medium text-muted hover:text-text"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || (mode === 'create' && !selectedClient)}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'create' ? 'Ajouter le parrain' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   Modal de terminaison
   ============================================================ */

interface EndModalProps {
  sponsorshipId: string
  sponsorName: string
  onClose: () => void
}

// Raisons disponibles côté UI (les raisons "animal_*" sont gérées par trigger DB)
const SELECTABLE_END_REASONS: SponsorshipEndedReason[] = [
  'sponsor_cancelled',
  'sponsor_deceased',
  'other',
]

export function EndSponsorshipModal({ sponsorshipId, sponsorName, onClose }: EndModalProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const today = new Date().toISOString().slice(0, 10)
  const [reason, setReason] = useState<SponsorshipEndedReason>('sponsor_cancelled')
  const [endedAt, setEndedAt] = useState<string>(today)

  function handleEnd() {
    startTransition(async () => {
      const res = await endSponsorship(sponsorshipId, reason, endedAt)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success('Parrainage terminé.')
      router.refresh()
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Terminer le parrainage</h2>
            <p className="text-sm text-muted mt-0.5 truncate">{sponsorName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-surface-dark text-muted hover:text-text"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">
              Raison
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as SponsorshipEndedReason)}
              className="w-full px-3 py-2 bg-surface-dark border border-border rounded-md text-sm"
            >
              {SELECTABLE_END_REASONS.map((r) => (
                <option key={r} value={r}>
                  {SPONSORSHIP_ENDED_REASON_LABELS[r]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">
              Date de fin
            </label>
            <input
              type="date"
              value={endedAt}
              onChange={(e) => setEndedAt(e.target.value)}
              className="w-full px-3 py-2 bg-surface-dark border border-border rounded-md text-sm"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 rounded-lg text-sm font-medium text-muted hover:text-text"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleEnd}
            disabled={isPending}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-warning text-white hover:bg-warning/90 disabled:opacity-50 flex items-center gap-2"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Terminer
          </button>
        </div>
      </div>
    </div>
  )
}
