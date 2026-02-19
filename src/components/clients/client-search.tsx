'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Client } from '@/lib/types/database'

interface ClientSearchProps {
  onSelect: (client: Client | null) => void
  selected: Client | null
  establishmentId: string
}

export function ClientSearch({ onSelect, selected, establishmentId }: ClientSearchProps) {
  const [query, setQuery] = useState('')
  const [allClients, setAllClients] = useState<Client[]>([])
  const [results, setResults] = useState<Client[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  async function loadClients() {
    if (loaded) return allClients
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('establishment_id', establishmentId)
      .order('name')
    const clients = (data as Client[]) || []
    setAllClients(clients)
    setLoaded(true)
    return clients
  }

  async function handleFocus() {
    const clients = await loadClients()
    if (query.length === 0) {
      setResults(clients)
    }
    setIsOpen(true)
  }

  useEffect(() => {
    if (!loaded) return
    if (query.length === 0) {
      setResults(allClients)
    } else {
      const q = query.toLowerCase()
      setResults(allClients.filter(c =>
        c.name.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q)
      ))
    }
  }, [query, allClients, loaded])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSelect(client: Client) {
    onSelect(client)
    setQuery('')
    setIsOpen(false)
    setResults([])
  }

  function handleClear() {
    onSelect(null)
    setQuery('')
  }

  if (selected) {
    return (
      <div className="flex items-center gap-3 p-3 bg-surface-dark border border-primary/30 rounded-lg">
        <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-white shrink-0">
          {selected.name[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{selected.name}</p>
          <p className="text-xs text-muted truncate">
            {[selected.email, selected.city].filter(Boolean).join(' - ')}
          </p>
        </div>
        <button
          type="button"
          onClick={handleClear}
          className="text-muted hover:text-danger transition-colors text-lg"
        >
          &times;
        </button>
      </div>
    )
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={handleFocus}
        placeholder="Rechercher un client..."
        className="w-full px-4 py-2.5 bg-surface-dark border border-border rounded-lg text-sm
          focus:border-primary focus:ring-1 focus:ring-primary transition-colors
          placeholder:text-muted/50"
      />

      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-xl z-20 max-h-60 overflow-y-auto">
          {results.map((client) => (
            <button
              key={client.id}
              type="button"
              onClick={() => handleSelect(client)}
              className="w-full text-left px-4 py-2.5 hover:bg-surface-hover transition-colors flex items-center gap-3"
            >
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                {client.name[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{client.name}</p>
                <p className="text-xs text-muted truncate">
                  {[client.email, client.city].filter(Boolean).join(' - ')}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {isOpen && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-xl z-20 p-3">
          <p className="text-sm text-muted text-center">Aucun client trouve</p>
        </div>
      )}
    </div>
  )
}
