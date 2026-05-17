'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { X, Loader2, UserPlus, Link2 } from 'lucide-react'
import {
  convertLegacyToClient,
  findMatchingClientsForLegacy,
  type LegacyContact,
  type ClientMatch,
} from '@/lib/actions/legacy-contacts'
import type { ClientKind, ContactCategory } from '@/lib/types/database'

const CATEGORY_LABELS: Record<ContactCategory, string> = {
  client: 'Client',
  member: 'Adhérent',
  volunteer: 'Bénévole',
  board_member: 'Conseil d\'administration',
  foster_family: 'Famille d\'accueil',
  veterinarian: 'Vétérinaire',
}

// Heuristique : si le full_name contient ces marqueurs, c'est une organisation
const ORG_MARKERS = /\b(ASSOCIATION|ASSO|SOCIETE|SARL|SAS|SA|EURL|SCI|VETERINAIRE|CLINIQUE|MAIRIE|COMMUNE|REFUGE|FONDATION|SPA|EARL|GAEC)\b/i

function guessKind(name: string): ClientKind {
  return ORG_MARKERS.test(name) ? 'organization' : 'person'
}

function splitName(fullName: string): { name: string; first_name: string | null } {
  // Convention française : "DUPONT Jean" → name=DUPONT, first_name=Jean
  // Dans le fichier Hunimalis : "Abraham Jerome" → on suppose nom puis prénom
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) return { name: parts[0], first_name: null }
  return { name: parts[0], first_name: parts.slice(1).join(' ') }
}

interface Props {
  contact: LegacyContact
  onClose: () => void
}

export function LegacyContactConvertModal({ contact, onClose }: Props) {
  const router = useRouter()
  const [matches, setMatches] = useState<ClientMatch[] | null>(null)
  const [mode, setMode] = useState<'link' | 'create'>('create')
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Formulaire création nouveau client
  const initialSplit = splitName(contact.full_name)
  const [kind, setKind] = useState<ClientKind>(guessKind(contact.full_name))
  const [name, setName] = useState(initialSplit.name)
  const [firstName, setFirstName] = useState(initialSplit.first_name ?? '')
  const [phone, setPhone] = useState(contact.phone ?? '')
  const [address, setAddress] = useState(contact.address ?? '')
  const [postalCode, setPostalCode] = useState(contact.postal_code ?? '')
  const [city, setCity] = useState(contact.city ?? '')
  const [type, setType] = useState<ContactCategory | ''>('')

  // Recherche les doublons potentiels au mount
  useEffect(() => {
    findMatchingClientsForLegacy(contact.id).then((res) => {
      if ('error' in res) {
        toast.error(res.error)
        setMatches([])
      } else {
        setMatches(res.data ?? [])
        // Si on a au moins 1 match, basculer en mode "link" par défaut
        if ((res.data?.length ?? 0) > 0) setMode('link')
      }
    })
  }, [contact.id])

  function handleSubmit() {
    if (mode === 'link') {
      if (!selectedMatchId) {
        toast.error('Sélectionnez un client à lier.')
        return
      }
      startTransition(async () => {
        const res = await convertLegacyToClient(contact.id, { linkToClientId: selectedMatchId })
        if ('error' in res && res.error) {
          toast.error(res.error)
          return
        }
        toast.success('Contact lié au client existant.')
        router.refresh()
        onClose()
      })
    } else {
      if (!name.trim()) {
        toast.error('Le nom est obligatoire.')
        return
      }
      startTransition(async () => {
        const res = await convertLegacyToClient(contact.id, {
          newClient: {
            kind,
            name: name.trim(),
            first_name: firstName.trim() || null,
            phone: phone.trim() || null,
            address: address.trim() || null,
            postal_code: postalCode.trim() || null,
            city: city.trim() || null,
            type: type || null,
            notes: null,
          },
        })
        if ('error' in res && res.error) {
          toast.error(res.error)
          return
        }
        toast.success('Client créé depuis l\'archive.')
        router.refresh()
        onClose()
      })
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-surface border-b border-border px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Convertir en client</h2>
            <p className="text-sm text-muted mt-0.5">{contact.full_name}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-dark text-muted hover:text-text">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Bandeau doublons potentiels */}
          {matches === null && (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Loader2 className="w-4 h-4 animate-spin" />
              Recherche de doublons existants...
            </div>
          )}
          {matches && matches.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
              <p className="text-sm font-medium text-amber-300 mb-2">
                ⚠️ {matches.length} client{matches.length > 1 ? 's' : ''} existant{matches.length > 1 ? 's' : ''} potentiellement identique{matches.length > 1 ? 's' : ''}
              </p>
              <p className="text-xs text-muted mb-3">
                Pour éviter les doublons, liez à un client existant plutôt que d'en recréer un.
              </p>
              <div className="space-y-2">
                {matches.map((m) => (
                  <label
                    key={m.id}
                    className={`flex items-start gap-3 p-3 rounded-md cursor-pointer transition-colors ${
                      mode === 'link' && selectedMatchId === m.id
                        ? 'bg-primary/15 border border-primary'
                        : 'bg-surface-dark hover:bg-surface-dark/70 border border-transparent'
                    }`}
                  >
                    <input
                      type="radio"
                      checked={mode === 'link' && selectedMatchId === m.id}
                      onChange={() => {
                        setMode('link')
                        setSelectedMatchId(m.id)
                      }}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">
                        {m.name}{m.first_name ? ` ${m.first_name}` : ''}
                      </div>
                      <div className="text-xs text-muted mt-0.5">
                        {[m.city, m.phone].filter(Boolean).join(' · ')}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-amber-400 mt-1">
                        Match : {m.match_reason === 'phone' ? 'téléphone identique' : 'nom + ville'}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Toggle mode */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('create')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                mode === 'create'
                  ? 'bg-primary text-white'
                  : 'bg-surface-dark text-muted hover:text-text'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              Créer un nouveau client
            </button>
            {matches && matches.length > 0 && (
              <button
                type="button"
                onClick={() => setMode('link')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  mode === 'link'
                    ? 'bg-primary text-white'
                    : 'bg-surface-dark text-muted hover:text-text'
                }`}
              >
                <Link2 className="w-4 h-4" />
                Lier à un existant
              </button>
            )}
          </div>

          {/* Formulaire création */}
          {mode === 'create' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Type</label>
                  <div className="flex gap-1 p-1 bg-surface-dark rounded-md border border-border">
                    <button
                      type="button"
                      onClick={() => setKind('person')}
                      className={`flex-1 py-1.5 text-sm rounded ${kind === 'person' ? 'bg-primary text-white' : 'text-muted'}`}
                    >
                      Personne
                    </button>
                    <button
                      type="button"
                      onClick={() => setKind('organization')}
                      className={`flex-1 py-1.5 text-sm rounded ${kind === 'organization' ? 'bg-primary text-white' : 'text-muted'}`}
                    >
                      Organisation
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Catégorie</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as ContactCategory | '')}
                    className="w-full px-3 py-2 bg-surface-dark border border-border rounded-md text-sm"
                  >
                    <option value="">— Aucune —</option>
                    {Object.entries(CATEGORY_LABELS).map(([v, label]) => (
                      <option key={v} value={v}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">
                    {kind === 'organization' ? 'Raison sociale *' : 'Nom *'}
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-dark border border-border rounded-md text-sm"
                  />
                </div>
                {kind === 'person' && (
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">Prénom</label>
                    <input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-dark border border-border rounded-md text-sm"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-muted mb-1">Téléphone</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-dark border border-border rounded-md text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted mb-1">Adresse</label>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-dark border border-border rounded-md text-sm"
                />
              </div>

              <div className="grid grid-cols-[1fr_2fr] gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">CP</label>
                  <input
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-dark border border-border rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Ville</label>
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-dark border border-border rounded-md text-sm"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-surface border-t border-border px-6 py-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={pending}
            className="px-4 py-2 rounded-lg text-sm font-medium text-muted hover:text-text"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={pending || (mode === 'link' && !selectedMatchId)}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            {pending && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'link' ? 'Lier au client existant' : 'Créer le client'}
          </button>
        </div>
      </div>
    </div>
  )
}
