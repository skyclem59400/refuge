'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Activity, Search } from 'lucide-react'
import type { ActivityLog } from '@/lib/types/database'

interface ActivityLogListProps {
  readonly logs: ActivityLog[]
  readonly userNames: Record<string, string>
}

const ACTION_VERBS: Record<string, string> = {
  create: 'a cree',
  update: 'a modifie',
  delete: 'a supprime',
  assign: 'a assigne',
}

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-success/15 text-success',
  update: 'bg-info/15 text-info',
  delete: 'bg-error/15 text-error',
  assign: 'bg-primary/15 text-primary',
}

const ENTITY_LABELS: Record<string, string> = {
  animal: 'l\'animal',
  health_record: 'le suivi sante de',
  movement: 'le mouvement de',
  outing: 'la sortie de',
  outing_assignment: 'l\'assignation de sortie de',
  document: 'le document',
  client: 'le client',
  box: 'le box',
  donation: 'le don',
  post: 'la publication',
  member: 'le membre',
  permission_group: 'le groupe',
  establishment: 'l\'etablissement',
}

const ENTITY_FILTER_LABELS: Record<string, string> = {
  animal: 'Animaux',
  health_record: 'Sante',
  movement: 'Mouvements',
  outing: 'Sorties',
  outing_assignment: 'Assignations',
  document: 'Documents',
  client: 'Clients',
  box: 'Box',
  donation: 'Dons',
  post: 'Publications',
  member: 'Membres',
  permission_group: 'Groupes',
  establishment: 'Etablissement',
}

const DETAIL_LABELS: Record<string, string> = {
  field: 'champ',
  value: 'valeur',
  adoptable: 'adoptable',
  reserved: 'reserve',
  status: 'statut',
  statut: 'statut',
  name: 'nom',
  nom: 'nom',
  name_secondary: 'nom secondaire',
  species: 'espece',
  espece: 'espece',
  breed: 'race',
  breed_cross: 'croisement',
  sex: 'sexe',
  birth_date: 'date de naissance',
  birth_place: 'lieu de naissance',
  color: 'couleur',
  weight: 'poids',
  sterilized: 'sterilise',
  chip_number: 'puce',
  tattoo_number: 'tatouage',
  tattoo_position: 'position tatouage',
  medal_number: 'medaille',
  loof_number: 'LOOF',
  passport_number: 'passeport',
  icad_updated: 'ICAD à jour',
  behavior_score: 'score comportement',
  description: 'description',
  capture_location: 'lieu de capture',
  capture_circumstances: 'circonstances',
  origin_type: 'type d\'origine',
  box_id: 'box',
  rating: 'note',
  note: 'note',
  is_tig: 'TIG',
  tig: 'TIG',
  duree: 'duree',
  type: 'type',
  numero: 'numero',
  client: 'client',
  total: 'total',
  converti_depuis: 'converti depuis',
  annule_facture: 'annule facture',
  capacite: 'capacite',
  montant: 'montant',
  amount: 'montant',
  donateur: 'donateur',
  donor_name: 'donateur',
  donor_email: 'email donateur',
  donor_phone: 'tel donateur',
  donor_address: 'adresse donateur',
  donor_postal_code: 'code postal',
  donor_city: 'ville',
  payment_method: 'methode paiement',
  methode: 'methode',
  nature: 'nature',
  date: 'date',
  notes: 'notes',
  // Health records
  veterinarian: 'veterinaire',
  next_due_date: 'prochaine echeance',
  cost: 'cout',
  plateforme: 'plateforme',
  intervention: 'intervention',
  appelant: 'appelant',
  commune: 'commune',
  origine: 'origine',
  groupe_id: 'groupe',
  retire_du_groupe: 'retire du groupe',
  action: 'action',
}

function formatDetailValue(key: string, value: unknown): string {
  if (value === true) return 'oui'
  if (value === false) return 'non'
  if (value === null || value === undefined) return '-'
  return String(value)
}

function buildDetailString(details: Record<string, unknown>): string | null {
  if (!details || Object.keys(details).length === 0) return null

  const parts: string[] = []
  for (const [key, value] of Object.entries(details)) {
    const label = DETAIL_LABELS[key] || key

    // Handle change objects with old/new values
    if (value && typeof value === 'object' && 'old' in value && 'new' in value) {
      const change = value as { old: unknown; new: unknown }
      const oldVal = formatDetailValue(key, change.old)
      const newVal = formatDetailValue(key, change.new)
      parts.push(`${label}: ${oldVal} → ${newVal}`)
    } else {
      parts.push(`${label} → ${formatDetailValue(key, value)}`)
    }
  }
  return parts.join(', ')
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatRelativeDate(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return 'A l\'instant'
  if (diffMin < 60) return `Il y a ${diffMin} min`
  if (diffHours < 24) return `Il y a ${diffHours}h`
  if (diffDays < 7) return `Il y a ${diffDays}j`
  return formatDateTime(dateStr)
}

function getEntityLink(log: ActivityLog): string | null {
  if (!log.entity_id) return null
  switch (log.entity_type) {
    case 'animal': return `/animals/${log.entity_id}`
    case 'document': return `/documents/${log.entity_id}`
    case 'client': return `/clients/${log.entity_id}`
    case 'donation': return `/donations/${log.entity_id}`
    default: return null
  }
}

function buildSentence(log: ActivityLog, userName: string): { text: string; entityName: string | null; entityLink: string | null } {
  const verb = ACTION_VERBS[log.action] || log.action
  const entityLabel = ENTITY_LABELS[log.entity_type] || log.entity_type
  const entityName = log.entity_name || null
  const entityLink = getEntityLink(log)

  return {
    text: `${userName} ${verb} ${entityLabel}`,
    entityName,
    entityLink,
  }
}

export function ActivityLogList({ logs, userNames }: ActivityLogListProps) {
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [entityFilter, setEntityFilter] = useState<string>('all')
  const [userFilter, setUserFilter] = useState<string>('all')
  const [visibleCount, setVisibleCount] = useState(50)

  const entityTypes = useMemo(() => [...new Set(logs.map((l) => l.entity_type))].sort((a, b) => a.localeCompare(b)), [logs])

  // All members for the user filter (sorted alphabetically)
  const allUsers = useMemo(() => {
    return Object.entries(userNames)
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [userNames])

  const filtered = useMemo(() => {
    let result = logs

    if (actionFilter !== 'all') {
      result = result.filter((l) => l.action === actionFilter)
    }
    if (entityFilter !== 'all') {
      result = result.filter((l) => l.entity_type === entityFilter)
    }
    if (userFilter !== 'all') {
      result = result.filter((l) => l.user_id === userFilter)
    }
    if (search.length >= 2) {
      const q = search.toLowerCase()
      result = result.filter((l) =>
        (l.entity_name && l.entity_name.toLowerCase().includes(q)) ||
        (userNames[l.user_id] && userNames[l.user_id].toLowerCase().includes(q)) ||
        (buildDetailString(l.details) || '').toLowerCase().includes(q)
      )
    }

    return result
  }, [logs, actionFilter, entityFilter, userFilter, search, userNames])

  const visible = filtered.slice(0, visibleCount)

  return (
    <div className="bg-surface rounded-xl border border-border">
      <div className="flex items-center justify-between p-5 border-b border-border">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold">Journal d&apos;activite</h2>
        </div>
        <span className="text-xs text-muted bg-surface-dark px-2 py-1 rounded-lg">
          {filtered.length} action{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-border">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setVisibleCount(50) }}
            placeholder="Rechercher un animal, une action..."
            className="w-full pl-9 pr-4 py-2 bg-surface-dark border border-border rounded-lg text-sm
              focus:border-primary focus:ring-1 focus:ring-primary transition-colors placeholder:text-muted/50"
          />
        </div>
        <select
          value={userFilter}
          onChange={(e) => { setUserFilter(e.target.value); setVisibleCount(50) }}
          className="px-3 py-2 bg-surface-dark border border-border rounded-lg text-sm
            focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
        >
          <option value="all">Tous les utilisateurs</option>
          {allUsers.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setVisibleCount(50) }}
          className="px-3 py-2 bg-surface-dark border border-border rounded-lg text-sm
            focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
        >
          <option value="all">Toutes les actions</option>
          <option value="create">Creations</option>
          <option value="update">Modifications</option>
          <option value="delete">Suppressions</option>
          <option value="assign">Assignations</option>
        </select>
        <select
          value={entityFilter}
          onChange={(e) => { setEntityFilter(e.target.value); setVisibleCount(50) }}
          className="px-3 py-2 bg-surface-dark border border-border rounded-lg text-sm
            focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
        >
          <option value="all">Tous les types</option>
          {entityTypes.map((t) => (
            <option key={t} value={t}>{ENTITY_FILTER_LABELS[t] || t}</option>
          ))}
        </select>
      </div>

      {/* Log entries */}
      {visible.length === 0 ? (
        <div className="p-8 text-center">
          <Activity className="w-10 h-10 text-muted mx-auto mb-3" />
          <p className="text-muted text-sm">
            {logs.length === 0 ? 'Aucune activite enregistree' : 'Aucun resultat pour ces filtres'}
          </p>
        </div>
      ) : (
        <>
          <div className="divide-y divide-border">
            {visible.map((log) => {
              const userName = userNames[log.user_id] || 'Utilisateur inconnu'
              const sentence = buildSentence(log, userName)
              const details = buildDetailString(log.details)

              return (
                <div key={log.id} className="flex items-start gap-3 px-5 py-3 hover:bg-surface-hover transition-colors">
                  {/* Action badge */}
                  <div className="mt-0.5">
                    <span className={`inline-flex w-2 h-2 rounded-full shrink-0 ${ACTION_COLORS[log.action] || 'bg-muted'}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-semibold">{userName}</span>
                      {' '}
                      <span className="text-muted">{ACTION_VERBS[log.action] || log.action}</span>
                      {' '}
                      <span className="text-muted">{ENTITY_LABELS[log.entity_type] || log.entity_type}</span>
                      {sentence.entityName && (
                        <>
                          {' '}
                          {sentence.entityLink ? (
                            <Link
                              href={sentence.entityLink}
                              className="font-semibold text-primary hover:text-primary-light transition-colors"
                            >
                              {sentence.entityName}
                            </Link>
                          ) : (
                            <span className="font-semibold">{sentence.entityName}</span>
                          )}
                        </>
                      )}
                    </p>
                    {details && (
                      <p className="text-xs text-muted mt-0.5">{details}</p>
                    )}
                  </div>

                  {/* Timestamp */}
                  <span className="text-xs text-muted whitespace-nowrap shrink-0 mt-0.5" title={formatDateTime(log.created_at)}>
                    {formatRelativeDate(log.created_at)}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Load more */}
          {visible.length < filtered.length && (
            <div className="p-4 text-center border-t border-border">
              <button
                onClick={() => setVisibleCount((prev) => prev + 50)}
                className="text-sm text-primary hover:text-primary-light transition-colors font-medium"
              >
                Afficher plus ({filtered.length - visible.length} restants)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
