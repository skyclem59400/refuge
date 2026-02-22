'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface Commune {
  nom: string
  code: string
  codeDepartement: string
  codesPostaux: string[]
}

interface CommuneAutocompleteProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function CommuneAutocomplete({ value, onChange, placeholder, className }: CommuneAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Commune[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchCommunes = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([])
      setIsOpen(false)
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch(
        `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(query)}&boost=population&limit=7&fields=nom,code,codeDepartement,codesPostaux`,
        { signal: controller.signal }
      )
      if (!res.ok) return
      const data: Commune[] = await res.json()
      setSuggestions(data)
      setIsOpen(data.length > 0)
      setHighlightedIndex(-1)
    } catch {
      // Ignore abort errors
    }
  }, [])

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    onChange(val)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchCommunes(val), 250)
  }

  function handleSelect(commune: Commune) {
    const cp = commune.codesPostaux[0] || ''
    const label = `${commune.nom} (${cp})`
    onChange(label)
    setSuggestions([])
    setIsOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen || suggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((i) => (i < suggestions.length - 1 ? i + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((i) => (i > 0 ? i - 1 : suggestions.length - 1))
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault()
      handleSelect(suggestions[highlightedIndex])
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => suggestions.length > 0 && setIsOpen(true)}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-50 top-full left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-xl max-h-56 overflow-y-auto">
          {suggestions.map((commune, i) => (
            <li
              key={commune.code}
              onMouseDown={() => handleSelect(commune)}
              onMouseEnter={() => setHighlightedIndex(i)}
              className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between transition-colors
                ${i === highlightedIndex ? 'bg-primary/15 text-primary-light' : 'text-text hover:bg-surface-hover'}`}
            >
              <span className="font-medium">{commune.nom}</span>
              <span className="text-xs text-muted ml-2">
                {commune.codesPostaux[0] || ''} ({commune.codeDepartement})
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
