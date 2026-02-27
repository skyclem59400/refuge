'use client'

import { useState, useEffect, useTransition } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { addPendingUser } from '@/lib/actions/establishments'
import type { UnassignedUser, PermissionGroup } from '@/lib/types/database'

interface PendingUsersListProps {
  users: UnassignedUser[]
  groups: PermissionGroup[]
}

export function PendingUsersList({ users, groups }: PendingUsersListProps) {
  const [list, setList] = useState(users)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  useEffect(() => { setList(users) }, [users])

  // Track selected groups per user
  const [selectedGroupsMap, setSelectedGroupsMap] = useState<Record<string, Set<string>>>({})

  function getSelectedGroups(userId: string): Set<string> {
    if (selectedGroupsMap[userId]) return selectedGroupsMap[userId]
    // Default: select the "Membre" group
    const membreGroup = groups.find(g => g.name === 'Membre' && !g.is_system)
    return membreGroup ? new Set([membreGroup.id]) : new Set()
  }

  function toggleGroup(userId: string, groupId: string) {
    setSelectedGroupsMap(prev => {
      const current = getSelectedGroups(userId)
      const next = new Set(current)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return { ...prev, [userId]: next }
    })
  }

  function handleAdd(userId: string) {
    const groupIds = Array.from(getSelectedGroups(userId))
    startTransition(async () => {
      const result = await addPendingUser(userId, groupIds)
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
        const selected = getSelectedGroups(user.id)
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
              <div className="flex flex-wrap gap-2">
                {groups.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => toggleGroup(user.id, group.id)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors
                      ${selected.has(group.id)
                        ? 'bg-primary/15 text-primary border border-primary/30'
                        : 'bg-surface-hover text-muted border border-border hover:text-text'
                      }`}
                  >
                    {group.name}
                  </button>
                ))}
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
