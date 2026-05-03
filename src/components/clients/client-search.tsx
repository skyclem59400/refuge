'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { createClientAction } from '@/lib/actions/clients'
import type { Client, ContactCategory } from '@/lib/types/database'

interface ClientSearchProps {
  readonly onSelect: (client: Client | null) => void
  readonly selected: Client | null
  readonly establishmentId: string
  readonly category?: ContactCategory
  readonly placeholder?: string
  readonly enableQuickCreate?: boolean
}

export function ClientSearch({ onSelect, selected, establishmentId, category, placeholder, enableQuickCreate = true }: ClientSearchProps) {
  const [query, setQuery] = useState('')
  const [allClients, setAllClients] = useState<Client[]>([])
  const [results, setResults] = useState<Client[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [isCreating, startCreating] = useTransition()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  function handleQuickCreate() {
    const trimmed = query.trim()
    if (!trimmed) {
      toast.error('Saisissez un nom avant de créer')
      return
    }
    startCreating(async () => {
      const result = await createClientAction({
        name: trimmed,
        type: category ?? null,
      })
      if (result.error || !result.data) {
        toast.error(result.error || 'Création impossible')
        return
      }
      const created = result.data as Client
      // Refresh local cache so a future search shows it
      setAllClients((prev) => [...prev, created])
      onSelect(created)
      setQuery('')
      setIsOpen(false)
      setResults([])
      toast.success('Contact créé et sélectionné')
    })
  }

  async function loadClients() {
    if (loaded) return allClients
    let q = supabase
      .from('clients')
      .select('*')
      .eq('establishment_id', establishmentId)
      .order('name')
    if (category) q = q.eq('type', category)
    const { data } = await q
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
        placeholder={placeholder || 'Rechercher un client...'}
        className="w-full px-4 py-2.5 bg-surface-dark border border-border rounded-lg text-sm
          focus:border-primary focus:ring-1 focus:ring-primary transition-colors
          placeholder:text-muted/50"
      />

      {isOpen && (results.length > 0 || enableQuickCreate) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-xl z-20 max-h-72 overflow-y-auto">
          {results.length > 0 ? (
            results.map((client) => (
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
            ))
          ) : (
            <p className="text-sm text-muted text-center px-3 py-2.5">Aucun contact trouvé</p>
          )}
          {enableQuickCreate && query.trim() && (
            <button
              type="button"
              onClick={handleQuickCreate}
              disabled={isCreating}
              className="w-full text-left px-4 py-2.5 border-t border-border bg-surface-dark hover:bg-surface-hover text-sm font-medium text-primary inline-flex items-center gap-2 disabled:opacity-50"
            >
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {isCreating ? 'Création…' : `Créer « ${query.trim()} » comme nouveau contact`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
