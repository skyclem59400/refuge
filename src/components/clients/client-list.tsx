'use client'

import { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { deleteClientAction } from '@/lib/actions/clients'
import { getCategoryLabel, getCategoryColor, ALL_CONTACT_CATEGORIES } from '@/lib/sda-utils'
import { getClientDisplayName, type Client, type ContactCategory } from '@/lib/types/database'

interface ClientListProps {
  readonly initialData: Client[]
  readonly canEdit: boolean
  readonly establishmentId: string
}

export function ClientList({ initialData, canEdit, establishmentId }: ClientListProps) {
  const [clients, setClients] = useState<Client[]>(initialData)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<ContactCategory | ''>('')

  useEffect(() => { setClients(initialData) }, [initialData])
  const [isPending, startTransition] = useTransition()
  const supabase = createClient()

  const handleSearch = async (query: string) => {
    setSearch(query)
    if (query.length < 2) {
      setClients(initialData)
      return
    }

    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('establishment_id', establishmentId)
      .or(`name.ilike.%${query}%,first_name.ilike.%${query}%,email.ilike.%${query}%,city.ilike.%${query}%`)
      .order('name')

    if (data) setClients(data as Client[])
  }

  const deleteClientHandler = async (id: string, name: string) => {
    const result = await deleteClientAction(id)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(`Contact "${name}" supprime`)
      setClients((prev) => prev.filter((c) => c.id !== id))
    }
  }

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Supprimer le contact "${name}" ?`)) return
    startTransition(() => deleteClientHandler(id, name))
  }

  const displayed = (() => {
    if (!categoryFilter) return clients
    if (categoryFilter === 'foster_family') return clients.filter((c) => c.is_foster)
    if (categoryFilter === 'member') return clients.filter((c) => c.is_member)
    if (categoryFilter === 'client') return clients.filter((c) => c.is_adopter)
    return clients.filter((c) => c.type === categoryFilter)
  })()

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Rechercher (nom, email, ville)..."
          className="flex-1 min-w-[200px] max-w-md px-4 py-2.5 bg-surface-dark border border-border rounded-lg text-sm
            focus:border-primary focus:ring-1 focus:ring-primary transition-colors
            placeholder:text-muted/50"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as ContactCategory | '')}
          className="px-4 py-2.5 bg-surface-dark border border-border rounded-lg text-sm
            focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
        >
          <option value="">Toutes categories</option>
          {ALL_CONTACT_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{getCategoryLabel(cat)}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-hover/50">
              <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Nom</th>
              <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Prénom</th>
              <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Email</th>
              <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Telephone</th>
              <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Ville</th>
              <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Categorie</th>
              <th className="text-right px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {displayed.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted">
                  Aucun contact trouve
                </td>
              </tr>
            ) : (
              displayed.map((client) => {
                const displayName = getClientDisplayName(client)
                const secondary = client.kind === 'person' ? client.first_name : client.contact_person
                return (
                <tr key={client.id} className="hover:bg-surface-hover/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-white shrink-0">
                        {(displayName[0] || '?').toUpperCase()}
                      </div>
                      <span className="font-medium">{client.name}</span>
                      {client.kind === 'organization' && (
                        <span className="text-[10px] uppercase tracking-wider text-muted/70 bg-surface-hover/50 px-1.5 py-0.5 rounded">
                          Org
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {secondary ?? (
                      <span className="text-muted/40">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">{client.email || '-'}</td>
                  <td className="px-4 py-3 text-muted">{client.phone || '-'}</td>
                  <td className="px-4 py-3 text-muted">{client.city || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {client.is_adopter && (
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-primary/15 text-primary">
                          Adoptant
                        </span>
                      )}
                      {client.is_foster && (
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400">
                          Famille d’accueil
                        </span>
                      )}
                      {client.is_member && (
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-green-500/15 text-green-600 dark:text-green-400">
                          Adhérent
                        </span>
                      )}
                      {!client.is_adopter && !client.is_foster && !client.is_member && (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/clients/${client.id}`}
                        className="px-2 py-1 rounded text-xs font-medium bg-primary/15 text-primary hover:bg-primary/25 transition-colors"
                      >
                        Voir
                      </Link>
                      {canEdit && (
                        <button
                          onClick={() => handleDelete(client.id, displayName)}
                          disabled={isPending}
                          className="px-2 py-1 rounded text-xs font-medium bg-danger/15 text-danger hover:bg-danger/25 transition-colors disabled:opacity-50"
                        >
                          Suppr.
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )})
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
