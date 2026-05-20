'use client'

import { useEffect, useRef, useState } from 'react'
import { MapPin, Loader2, X, Check } from 'lucide-react'

/**
 * Autocomplétion d'adresse française via la Base Adresse Nationale (BAN).
 * https://adresse.data.gouv.fr/api-doc/adresse
 *
 * Fonctionnement :
 * - Tape du texte → debounce 250ms → fetch /search?q=...&limit=8
 * - L'utilisateur DOIT cliquer un résultat pour valider (pas de saisie libre acceptée)
 * - Si l'utilisateur quitte le champ sans sélectionner, on restaure la valeur précédente
 */

export interface BanSelection {
  label: string
  postcode: string | null
  city: string | null
  lat: number | null
  lng: number | null
  banId: string | null
}

interface Feature {
  properties: {
    id: string
    label: string
    postcode?: string
    city?: string
    name?: string
    context?: string
  }
  geometry?: { coordinates: [number, number] }
}

interface Props {
  readonly value: BanSelection | null
  readonly onChange: (s: BanSelection | null) => void
  readonly placeholder?: string
  readonly id?: string
  readonly className?: string
  /** Restreint la recherche à un type ('housenumber' | 'street' | 'locality' | 'municipality'). Defaut: tous. */
  readonly type?: string
  /** Désactive le champ. */
  readonly disabled?: boolean
}

export function AddressAutocomplete({
  value,
  onChange,
  placeholder = 'Adresse ou ville…',
  id,
  className,
  type,
  disabled,
}: Props) {
  const [query, setQuery] = useState(value?.label ?? '')
  const [results, setResults] = useState<Feature[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [dirty, setDirty] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Sync external value -> input
  useEffect(() => {
    setQuery(value?.label ?? '')
    setDirty(false)
  }, [value?.label])

  // Click outside → close + restore
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!wrapperRef.current) return
      if (!wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
        if (dirty) {
          setQuery(value?.label ?? '')
          setDirty(false)
        }
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [dirty, value])

  // Debounced search
  useEffect(() => {
    if (!dirty) return
    if (query.trim().length < 3) {
      setResults([])
      return
    }
    const handle = setTimeout(async () => {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      setLoading(true)
      try {
        const url = new URL('https://api-adresse.data.gouv.fr/search/')
        url.searchParams.set('q', query.trim())
        url.searchParams.set('limit', '8')
        if (type) url.searchParams.set('type', type)
        const res = await fetch(url.toString(), { signal: ctrl.signal })
        if (!res.ok) {
          setResults([])
        } else {
          const data = await res.json()
          setResults(data?.features ?? [])
          setOpen(true)
        }
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setResults([])
      } finally {
        if (!ctrl.signal.aborted) setLoading(false)
      }
    }, 250)
    return () => clearTimeout(handle)
  }, [query, dirty, type])

  function pick(f: Feature) {
    const sel: BanSelection = {
      label: f.properties.label,
      postcode: f.properties.postcode ?? null,
      city: f.properties.city ?? null,
      lat: f.geometry?.coordinates?.[1] ?? null,
      lng: f.geometry?.coordinates?.[0] ?? null,
      banId: f.properties.id ?? null,
    }
    onChange(sel)
    setQuery(sel.label)
    setResults([])
    setOpen(false)
    setDirty(false)
  }

  function clearValue() {
    onChange(null)
    setQuery('')
    setResults([])
    setOpen(false)
    setDirty(false)
  }

  const showValidIcon = !dirty && value?.label && query === value.label

  return (
    <div ref={wrapperRef} className={`relative ${className ?? ''}`}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
        <input
          id={id}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setDirty(true)
          }}
          onFocus={() => {
            if (results.length > 0) setOpen(true)
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full pl-9 pr-9 py-2 bg-surface-dark border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted animate-spin" />
        )}
        {!loading && showValidIcon && (
          <Check className="absolute right-9 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
        )}
        {!loading && query.length > 0 && (
          <button
            type="button"
            onClick={clearValue}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-muted hover:text-text hover:bg-surface-hover"
            aria-label="Effacer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {dirty && query.trim().length > 0 && query.trim().length < 3 && (
        <p className="text-[11px] text-muted mt-1">Tape au moins 3 caractères…</p>
      )}

      {dirty && !showValidIcon && (
        <p className="text-[11px] text-amber-500 mt-1">
          Sélectionne une adresse dans la liste pour valider.
        </p>
      )}

      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-surface border border-border rounded-lg shadow-xl max-h-72 overflow-y-auto">
          {results.map((f) => (
            <li key={f.properties.id}>
              <button
                type="button"
                onClick={() => pick(f)}
                className="w-full text-left px-3 py-2 hover:bg-surface-hover transition-colors"
              >
                <div className="text-sm font-medium text-text">
                  {f.properties.name || f.properties.label}
                </div>
                <div className="text-[11px] text-muted">
                  {f.properties.context
                    ? f.properties.context
                    : `${f.properties.postcode ?? ''} ${f.properties.city ?? ''}`}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && !loading && results.length === 0 && query.trim().length >= 3 && (
        <div className="absolute z-50 mt-1 w-full bg-surface border border-border rounded-lg shadow-xl px-3 py-2 text-xs text-muted">
          Aucune adresse trouvée. Essayez en élargissant (ex : ajouter la ville).
        </div>
      )}
    </div>
  )
}
