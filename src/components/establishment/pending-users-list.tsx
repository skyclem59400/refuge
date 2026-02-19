'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { addPendingUser } from '@/lib/actions/establishments'
import type { UnassignedUser } from '@/lib/types/database'

interface PendingUsersListProps {
  users: UnassignedUser[]
}

export function PendingUsersList({ users }: PendingUsersListProps) {
  const [list, setList] = useState(users)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const [permissionsMap, setPermissionsMap] = useState<Record<string, {
    manage_documents: boolean
    manage_clients: boolean
    manage_establishment: boolean
  }>>({})

  function getPermissions(userId: string) {
    return permissionsMap[userId] || {
      manage_documents: false,
      manage_clients: false,
      manage_establishment: false,
    }
  }

  function togglePermission(userId: string, field: 'manage_documents' | 'manage_clients' | 'manage_establishment') {
    setPermissionsMap(prev => ({
      ...prev,
      [userId]: {
        ...getPermissions(userId),
        [field]: !getPermissions(userId)[field],
      },
    }))
  }

  function handleAdd(userId: string) {
    startTransition(async () => {
      const result = await addPendingUser(userId, getPermissions(userId))
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Membre ajoute avec succes')
        setList(prev => prev.filter(u => u.id !== userId))
        router.refresh()
      }
    })
  }

  if (list.length === 0) {
    return (
      <p className="text-sm text-muted text-center py-6">
        Aucun utilisateur en attente
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {list.map((user) => {
        const perms = getPermissions(user.id)
        return (
          <div key={user.id} className="p-4 bg-surface-dark rounded-lg border border-border space-y-3">
            <div className="flex items-center gap-3">
              {user.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-white shrink-0">
                  {(user.full_name || user.email || '?')[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {user.full_name || user.email}
                </p>
                {user.full_name && (
                  <p className="text-xs text-muted truncate">{user.email}</p>
                )}
              </div>
              <span className="text-xs text-muted shrink-0">
                {new Date(user.created_at).toLocaleDateString('fr-FR')}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={perms.manage_documents}
                    onChange={() => togglePermission(user.id, 'manage_documents')}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-xs">Documents</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={perms.manage_clients}
                    onChange={() => togglePermission(user.id, 'manage_clients')}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-xs">Clients</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={perms.manage_establishment}
                    onChange={() => togglePermission(user.id, 'manage_establishment')}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-xs">Admin</span>
                </label>
              </div>

              <button
                onClick={() => handleAdd(user.id)}
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
      })}
    </div>
  )
}
