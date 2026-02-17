'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { deleteClientAction } from '@/lib/actions/clients'
import type { Client } from '@/lib/types/database'

export function ClientList({ initialData }: { initialData: Client[] }) {
  const [clients, setClients] = useState<Client[]>(initialData)
  const [search, setSearch] = useState('')
  const [isPending, startTransition] = useTransition()
  const supabase = createClient()

  async function handleSearch(query: string) {
    setSearch(query)
    if (query.length < 2) {
      setClients(initialData)
      return
    }

    const { data } = await supabase
      .from('clients')
      .select('*')
      .or(`name.ilike.%${query}%,email.ilike.%${query}%,city.ilike.%${query}%`)
      .order('name')

    if (data) setClients(data as Client[])
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`Supprimer le client "${name}" ?`)) return
    startTransition(async () => {
      const result = await deleteClientAction(id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Client "${name}" supprime`)
        setClients((prev) => prev.filter((c) => c.id !== id))
      }
    })
  }

  return (
    <div>
      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Rechercher un client (nom, email, ville)..."
          className="w-full max-w-md px-4 py-2.5 bg-surface-dark border border-border rounded-lg text-sm
            focus:border-primary focus:ring-1 focus:ring-primary transition-colors
            placeholder:text-muted/50"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-hover/50">
              <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Nom</th>
              <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Email</th>
              <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Telephone</th>
              <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Ville</th>
              <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Type</th>
              <th className="text-right px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {clients.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  Aucun client trouve
                </td>
              </tr>
            ) : (
              clients.map((client) => (
                <tr key={client.id} className="hover:bg-surface-hover/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-white shrink-0">
                        {client.name[0].toUpperCase()}
                      </div>
                      <span className="font-medium">{client.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">{client.email || '-'}</td>
                  <td className="px-4 py-3 text-muted">{client.phone || '-'}</td>
                  <td className="px-4 py-3 text-muted">{client.city || '-'}</td>
                  <td className="px-4 py-3">
                    {client.type && (
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        client.type === 'organisation'
                          ? 'bg-info/15 text-info'
                          : 'bg-secondary/15 text-secondary'
                      }`}>
                        {client.type === 'organisation' ? 'Org.' : 'Part.'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/clients/${client.id}`}
                        className="px-2 py-1 rounded text-xs font-medium bg-primary/15 text-primary hover:bg-primary/25 transition-colors"
                      >
                        Voir
                      </Link>
                      <button
                        onClick={() => handleDelete(client.id, client.name)}
                        disabled={isPending}
                        className="px-2 py-1 rounded text-xs font-medium bg-danger/15 text-danger hover:bg-danger/25 transition-colors disabled:opacity-50"
                      >
                        Suppr.
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
