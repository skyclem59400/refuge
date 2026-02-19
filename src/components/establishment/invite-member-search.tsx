'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { addMemberById } from '@/lib/actions/establishments'
import type { UnassignedUser } from '@/lib/types/database'

interface InviteMemberSearchProps {
  users: UnassignedUser[]
}

export function InviteMemberSearch({ users: initialUsers }: InviteMemberSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UnassignedUser[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [selected, setSelected] = useState<UnassignedUser | null>(null)
  const [isPending, startTransition] = useTransition()
  const [users, setUsers] = useState(initialUsers)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => { setUsers(initialUsers) }, [initialUsers])

  const [permissions, setPermissions] = useState({
    manage_documents: false,
    manage_clients: false,
    manage_establishment: false,
  })

  useEffect(() => {
    if (query.length === 0) {
      setResults(users)
    } else {
      const q = query.toLowerCase()
      setResults(users.filter(u =>
        u.email.toLowerCase().includes(q) ||
        u.full_name?.toLowerCase().includes(q)
      ))
    }
  }, [query, users])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSelect(user: UnassignedUser) {
    setSelected(user)
    setQuery('')
    setIsOpen(false)
  }

  function handleClear() {
    setSelected(null)
    setPermissions({ manage_documents: false, manage_clients: false, manage_establishment: false })
  }

  function handleAdd() {
    if (!selected) return
    startTransition(async () => {
      const result = await addMemberById(selected.id, permissions)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Membre ajoute avec succes')
        setUsers(prev => prev.filter(u => u.id !== selected.id))
        setSelected(null)
        setPermissions({ manage_documents: false, manage_clients: false, manage_establishment: false })
        router.refresh()
      }
    })
  }

  if (selected) {
    return (
      <div className="p-4 bg-surface-dark rounded-lg border border-border space-y-3">
        <div className="flex items-center gap-3">
          {selected.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={selected.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-white shrink-0">
              {(selected.full_name || selected.email)[0].toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{selected.full_name || selected.email}</p>
            {selected.full_name && (
              <p className="text-xs text-muted truncate">{selected.email}</p>
            )}
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="text-muted hover:text-danger transition-colors text-lg"
          >
            &times;
          </button>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={permissions.manage_documents}
                onChange={(e) => setPermissions(p => ({ ...p, manage_documents: e.target.checked }))}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-xs">Documents</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={permissions.manage_clients}
                onChange={(e) => setPermissions(p => ({ ...p, manage_clients: e.target.checked }))}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-xs">Clients</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={permissions.manage_establishment}
                onChange={(e) => setPermissions(p => ({ ...p, manage_establishment: e.target.checked }))}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-xs">Admin</span>
            </label>
          </div>

          <button
            onClick={handleAdd}
            disabled={isPending}
            className="px-3 py-1.5 rounded-lg font-semibold text-white text-xs
              bg-primary hover:bg-primary-dark transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {isPending ? 'Ajout...' : 'Ajouter'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setIsOpen(true)}
        placeholder="Rechercher un utilisateur..."
        className="w-full px-4 py-2.5 bg-surface-dark border border-border rounded-lg text-sm
          focus:border-primary focus:ring-1 focus:ring-primary transition-colors
          placeholder:text-muted/50"
      />

      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-xl z-20 max-h-60 overflow-y-auto">
          {results.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => handleSelect(user)}
              className="w-full text-left px-4 py-2.5 hover:bg-surface-hover transition-colors flex items-center gap-3"
            >
              {user.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {(user.full_name || user.email)[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{user.full_name || user.email}</p>
                {user.full_name && (
                  <p className="text-xs text-muted truncate">{user.email}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {isOpen && results.length === 0 && query.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-xl z-20 p-3">
          <p className="text-sm text-muted text-center">Aucun utilisateur trouve</p>
        </div>
      )}
    </div>
  )
}
