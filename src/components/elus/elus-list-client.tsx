'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Search,
  Mail,
  Phone,
  FileSignature,
  Pencil,
  Trash2,
  Building2,
  MapPin,
  Tag as TagIcon,
  Star,
  Calendar,
  Filter,
  X,
} from 'lucide-react'
import { type Elu, buildGreeting, deleteElu, markEluContacted } from '@/lib/actions/elus'

const TONE_LABEL: Record<Elu['tone_variant'], string> = {
  'tu-prenom': 'tu + prénom',
  'vous-prenom': 'vous + prénom',
  'vous-nom': 'vous + nom',
  'institutionnel': 'institutionnel',
}

const TONE_COLOR: Record<Elu['tone_variant'], string> = {
  'tu-prenom': 'bg-success/10 text-success',
  'vous-prenom': 'bg-blue-500/10 text-blue-500',
  'vous-nom': 'bg-primary/10 text-primary',
  'institutionnel': 'bg-muted/10 text-muted',
}

const COLLECTIVITY_LABEL: Record<NonNullable<Elu['collectivity_type']>, string> = {
  commune: 'Commune',
  epci: 'EPCI',
  departement: 'Département',
  region: 'Région',
  etat: 'État',
  autre: 'Autre',
}

function formatLastContact(iso: string | null): string {
  if (!iso) return 'Jamais'
  const d = new Date(iso)
  const days = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24))
  if (days === 0) return "Aujourd'hui"
  if (days === 1) return 'Hier'
  if (days < 30) return `il y a ${days} j`
  if (days < 365) return `il y a ${Math.floor(days / 30)} mois`
  return `il y a ${Math.floor(days / 365)} an${Math.floor(days / 365) > 1 ? 's' : ''}`
}

export function ElusListClient({ initialList }: { initialList: Elu[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [q, setQ] = useState('')
  const [tagFilter, setTagFilter] = useState<string | null>(null)

  // Tous les tags présents dans la liste (dédupliqués)
  const allTags = useMemo(() => {
    const set = new Set<string>()
    initialList.forEach((e) => e.tags?.forEach((t) => set.add(t)))
    return Array.from(set).sort()
  }, [initialList])

  const filtered = useMemo(() => {
    let result = initialList
    if (tagFilter) result = result.filter((e) => e.tags?.includes(tagFilter))
    if (q.trim()) {
      const needle = q.toLowerCase().trim()
      result = result.filter((e) =>
        `${e.first_name} ${e.last_name} ${e.role} ${e.collectivity_name || ''} ${e.email || ''}`
          .toLowerCase()
          .includes(needle),
      )
    }
    return result
  }, [initialList, q, tagFilter])

  function handleMailto(elu: Elu) {
    if (!elu.email) {
      alert('Aucun email enregistré pour cet élu.')
      return
    }
    const greeting = buildGreeting(elu)
    const body = `${greeting}\n\n\n\nClément Scailteux\nPrésident de la SDA d'Estourmel`
    const url = `mailto:${encodeURIComponent(elu.email)}?body=${encodeURIComponent(body)}`
    window.open(url, '_blank')
    // Marque comme contacté (best effort, non-bloquant)
    startTransition(async () => {
      await markEluContacted(elu.id)
      router.refresh()
    })
  }

  function handleDelete(elu: Elu) {
    if (!confirm(`Supprimer ${elu.first_name} ${elu.last_name} de l'annuaire ?\nCette action est irréversible.`)) return
    startTransition(async () => {
      const res = await deleteElu(elu.id)
      if (res.error) alert(res.error)
      else router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="flex flex-wrap gap-3 items-end p-4 rounded-xl border border-border bg-surface">
        <div className="flex-1 min-w-[200px]">
          <label htmlFor="elus-q" className="block text-xs font-medium text-muted mb-1">Rechercher</label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              id="elus-q"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nom, rôle, collectivité, email…"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface-dark border border-border text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>

        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs text-muted mr-1"><TagIcon className="w-3.5 h-3.5 inline" /></span>
            {allTags.map((t) => {
              const isActive = tagFilter === t
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTagFilter(isActive ? null : t)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    isActive ? 'bg-primary text-white' : 'bg-surface-dark text-muted hover:text-text hover:bg-surface-hover'
                  }`}
                >
                  {t}
                </button>
              )
            })}
            {tagFilter && (
              <button
                type="button"
                onClick={() => setTagFilter(null)}
                className="text-xs text-muted hover:text-text"
                aria-label="Effacer le filtre tag"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        <div className="text-xs text-muted ml-auto">
          <Filter className="w-3.5 h-3.5 inline mr-1" />
          {filtered.length} élu{filtered.length > 1 ? 's' : ''}
        </div>
      </div>

      {/* Cartes élus */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center text-muted">
          Aucun élu ne correspond à ces filtres.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((elu) => (
            <article
              key={elu.id}
              className="rounded-xl border border-border bg-surface p-4 hover:border-primary/30 transition-colors flex flex-col"
            >
              {/* Header carte */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-semibold text-text">
                      {elu.civility ? `${elu.civility} ` : ''}{elu.first_name} {elu.last_name}
                    </h2>
                    {elu.tags?.includes('VIP') && (
                      <Star className="w-3.5 h-3.5 text-warning fill-current" />
                    )}
                  </div>
                  <p className="text-sm text-muted mt-0.5">{elu.role}</p>
                </div>
                <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${TONE_COLOR[elu.tone_variant]}`}>
                  {TONE_LABEL[elu.tone_variant]}
                </span>
              </div>

              {/* Collectivité */}
              {elu.collectivity_name && (
                <div className="flex items-center gap-1.5 text-xs text-muted mb-2">
                  <Building2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{elu.collectivity_name}</span>
                  {elu.collectivity_type && (
                    <span className="px-1.5 py-0.5 rounded bg-surface-dark text-[10px]">
                      {COLLECTIVITY_LABEL[elu.collectivity_type]}
                    </span>
                  )}
                </div>
              )}

              {/* Coordonnées */}
              <div className="space-y-1 text-sm text-text mb-3">
                {elu.email && (
                  <div className="flex items-center gap-2 text-xs">
                    <Mail className="w-3.5 h-3.5 shrink-0 text-muted" />
                    <a href={`mailto:${elu.email}`} className="text-primary hover:underline truncate">{elu.email}</a>
                  </div>
                )}
                {elu.phone && (
                  <div className="flex items-center gap-2 text-xs">
                    <Phone className="w-3.5 h-3.5 shrink-0 text-muted" />
                    <a href={`tel:${elu.phone}`} className="text-primary hover:underline">{elu.phone}</a>
                  </div>
                )}
                {elu.postal_address && (
                  <div className="flex items-start gap-2 text-xs">
                    <MapPin className="w-3.5 h-3.5 shrink-0 text-muted mt-0.5" />
                    <span className="text-muted">{elu.postal_address}</span>
                  </div>
                )}
              </div>

              {/* Notes (preview) */}
              {elu.notes && (
                <p className="text-xs text-muted italic line-clamp-3 mb-3 bg-surface-dark/30 p-2 rounded">
                  {elu.notes}
                </p>
              )}

              {/* Tags */}
              {elu.tags && elu.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {elu.tags.map((t) => (
                    <span key={t} className="px-1.5 py-0.5 rounded bg-surface-dark text-[10px] text-muted">{t}</span>
                  ))}
                </div>
              )}

              {/* Footer : dernier contact + actions */}
              <div className="flex items-center justify-between gap-2 mt-auto pt-3 border-t border-border">
                <div className="flex items-center gap-1 text-[10px] text-muted">
                  <Calendar className="w-3 h-3" />
                  Dernier contact : <strong className="text-text">{formatLastContact(elu.last_contact_at)}</strong>
                </div>
                <div className="flex items-center gap-1">
                  {elu.email && (
                    <button
                      type="button"
                      onClick={() => handleMailto(elu)}
                      disabled={isPending}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                      title="Composer un mail avec son ton/civilité"
                    >
                      <Mail className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {elu.collectivity_name && (
                    <Link
                      href={`/admin/conventions?q=${encodeURIComponent(elu.collectivity_name)}`}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-accent/10 hover:bg-accent/20 text-accent transition-colors"
                      title="Voir les conventions liées"
                    >
                      <FileSignature className="w-3.5 h-3.5" />
                    </Link>
                  )}
                  <Link
                    href={`/astreinte/elus/${elu.id}`}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-surface-dark hover:bg-surface-hover text-muted hover:text-text transition-colors"
                    title="Éditer la fiche"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDelete(elu)}
                    disabled={isPending}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-surface-dark hover:bg-warning/10 text-muted hover:text-warning transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {isPending && <p className="text-xs text-muted text-center">En cours…</p>}
    </div>
  )
}
