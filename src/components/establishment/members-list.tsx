'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { assignMemberToGroup, removeMemberFromGroup, removeMember } from '@/lib/actions/establishments'
import { MemberAvatar } from '@/components/ui/member-avatar'
import type { EstablishmentMember, PermissionGroup } from '@/lib/types/database'

interface MembersListProps {
  members: EstablishmentMember[]
  groups: PermissionGroup[]
  currentUserId: string
  isOwner: boolean
}

function GroupDropdown({
  member,
  allGroups,
  onAssign,
  onRemove,
  disabled,
}: {
  member: EstablishmentMember
  allGroups: PermissionGroup[]
  onAssign: (memberId: string, groupId: string) => void
  onRemove: (memberId: string, groupId: string) => void
  disabled: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const memberGroupIds = new Set((member.groups || []).map(g => g.id))

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="px-2 py-1 rounded text-xs font-medium bg-surface-hover hover:bg-border transition-colors disabled:opacity-50"
      >
        + Groupe
      </button>
      {isOpen && (
        <div className="absolute top-full right-0 mt-1 bg-surface border border-border rounded-lg shadow-xl z-20 min-w-[200px] py-1">
          {allGroups.map((group) => {
            const isMember = memberGroupIds.has(group.id)
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => {
                  if (isMember) {
                    onRemove(member.id, group.id)
                  } else {
                    onAssign(member.id, group.id)
                  }
                }}
                disabled={disabled}
                className="w-full text-left px-3 py-2 hover:bg-surface-hover transition-colors flex items-center justify-between gap-2"
              >
                <span className="text-xs font-medium truncate">{group.name}</span>
                {isMember && (
                  <span className="text-primary text-xs shrink-0">&#10003;</span>
                )}
              </button>
            )
          })}
          {allGroups.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted">Aucun groupe</p>
          )}
        </div>
      )}
    </div>
  )
}

export function MembersList({ members, groups, currentUserId, isOwner }: MembersListProps) {
  const [list, setList] = useState(members)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  useEffect(() => { setList(members) }, [members])

  function handleAssignGroup(memberId: string, groupId: string) {
    // Optimistic update
    const group = groups.find(g => g.id === groupId)
    if (group) {
      setList(prev => prev.map(m =>
        m.id === memberId
          ? { ...m, groups: [...(m.groups || []), group] }
          : m
      ))
    }

    startTransition(async () => {
      const result = await assignMemberToGroup(memberId, groupId)
      if (result.error) {
        toast.error(result.error)
        // Revert
        setList(prev => prev.map(m =>
          m.id === memberId
            ? { ...m, groups: (m.groups || []).filter(g => g.id !== groupId) }
            : m
        ))
      } else {
        toast.success('Groupe assigne')
      }
    })
  }

  function handleRemoveGroup(memberId: string, groupId: string) {
    // Optimistic update
    setList(prev => prev.map(m =>
      m.id === memberId
        ? { ...m, groups: (m.groups || []).filter(g => g.id !== groupId) }
        : m
    ))

    startTransition(async () => {
      const result = await removeMemberFromGroup(memberId, groupId)
      if (result.error) {
        toast.error(result.error)
        router.refresh()
      } else {
        toast.success('Groupe retire')
      }
    })
  }

  function handleRemoveMember(memberId: string) {
    if (!confirm('Supprimer ce membre ?')) return
    startTransition(async () => {
      const result = await removeMember(memberId)
      if (result.error) {
        toast.error(result.error)
      } else {
        setList(prev => prev.filter(m => m.id !== memberId))
        toast.success('Membre supprime')
        router.refresh()
      }
    })
  }

  if (list.length === 0) {
    return (
      <p className="text-sm text-muted text-center py-6">Aucun membre</p>
    )
  }

  return (
    <div className="space-y-3">
      {list.map((member) => {
        const isCurrentUser = member.user_id === currentUserId
        const isAdmin = (member.groups || []).some(g => g.is_system && g.name === 'Administrateur')

        return (
          <div key={member.id} className="p-4 bg-surface-dark rounded-lg border border-border space-y-3">
            <div className="flex items-center gap-3">
              <MemberAvatar
                src={member.avatar_url}
                name={member.full_name || member.email || '?'}
                size={32}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {member.full_name || member.email || member.user_id.slice(0, 8)}
                  {isCurrentUser && <span className="text-muted text-xs ml-1">(vous)</span>}
                </p>
                <p className="text-xs text-muted">
                  {member.email && member.full_name && member.email}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <GroupDropdown
                  member={member}
                  allGroups={groups}
                  onAssign={handleAssignGroup}
                  onRemove={handleRemoveGroup}
                  disabled={isPending}
                />
                {!isCurrentUser && (isOwner || !isAdmin) && (
                  <button
                    onClick={() => handleRemoveMember(member.id)}
                    disabled={isPending}
                    className="px-2 py-1 rounded text-xs font-medium bg-danger/15 text-danger hover:bg-danger/25 transition-colors disabled:opacity-50"
                  >
                    Retirer
                  </button>
                )}
              </div>
            </div>

            {/* Group badges */}
            <div className="flex flex-wrap gap-1.5">
              {(member.groups || []).map((group) => (
                <span
                  key={group.id}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium
                    ${group.is_system
                      ? 'bg-primary/15 text-primary'
                      : 'bg-surface-hover text-text border border-border'
                    }`}
                >
                  {group.name}
                  {!isCurrentUser && (isOwner || !group.is_system) && (
                    <button
                      onClick={() => handleRemoveGroup(member.id, group.id)}
                      disabled={isPending}
                      className="hover:text-danger transition-colors ml-0.5 disabled:opacity-50"
                    >
                      &times;
                    </button>
                  )}
                </span>
              ))}
              {(member.groups || []).length === 0 && (
                <span className="text-[11px] text-muted italic">Aucun groupe</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
