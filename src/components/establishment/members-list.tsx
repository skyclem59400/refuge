'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { updateMemberPermissions, removeMember } from '@/lib/actions/establishments'
import type { EstablishmentMember } from '@/lib/types/database'

interface MembersListProps {
  members: EstablishmentMember[]
  currentUserId: string
}

function ToggleSwitch({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={`relative w-9 h-5 rounded-full transition-colors shrink-0
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${checked ? 'bg-primary' : 'bg-border'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm
          ${checked ? 'translate-x-4' : 'translate-x-0'}`}
      />
    </button>
  )
}

export function MembersList({ members, currentUserId }: MembersListProps) {
  const [list, setList] = useState(members)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleToggle(memberId: string, field: 'manage_documents' | 'manage_clients' | 'manage_establishment', currentValue: boolean) {
    startTransition(async () => {
      const result = await updateMemberPermissions(memberId, { [field]: !currentValue })
      if (result.error) {
        toast.error(result.error)
      } else {
        setList(prev => prev.map(m =>
          m.id === memberId ? { ...m, [field]: !currentValue } : m
        ))
        toast.success('Permissions mises a jour')
      }
    })
  }

  function handleRemove(memberId: string) {
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
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-hover/50">
            <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Membre</th>
            <th className="text-center px-3 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Documents</th>
            <th className="text-center px-3 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Clients</th>
            <th className="text-center px-3 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Admin</th>
            <th className="text-right px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {list.map((member) => {
            const isCurrentUser = member.user_id === currentUserId
            const isAdmin = member.role === 'admin'
            return (
              <tr key={member.id} className="hover:bg-surface-hover/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-white shrink-0">
                      {(member.email || '?')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {member.email || member.user_id.slice(0, 8)}
                        {isCurrentUser && <span className="text-muted text-xs ml-1">(vous)</span>}
                      </p>
                      <p className="text-xs text-muted">
                        {isAdmin ? (
                          <span className="text-primary font-medium">Admin</span>
                        ) : (
                          'Membre'
                        )}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-center">
                  <div className="flex justify-center">
                    <ToggleSwitch
                      checked={isAdmin || member.manage_documents}
                      onChange={() => handleToggle(member.id, 'manage_documents', member.manage_documents)}
                      disabled={isPending || isAdmin}
                    />
                  </div>
                </td>
                <td className="px-3 py-3 text-center">
                  <div className="flex justify-center">
                    <ToggleSwitch
                      checked={isAdmin || member.manage_clients}
                      onChange={() => handleToggle(member.id, 'manage_clients', member.manage_clients)}
                      disabled={isPending || isAdmin}
                    />
                  </div>
                </td>
                <td className="px-3 py-3 text-center">
                  <div className="flex justify-center">
                    <ToggleSwitch
                      checked={isAdmin || member.manage_establishment}
                      onChange={() => handleToggle(member.id, 'manage_establishment', member.manage_establishment)}
                      disabled={isPending || isAdmin}
                    />
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  {!isAdmin && !isCurrentUser && (
                    <button
                      onClick={() => handleRemove(member.id)}
                      disabled={isPending}
                      className="px-2 py-1 rounded text-xs font-medium bg-danger/15 text-danger hover:bg-danger/25 transition-colors disabled:opacity-50"
                    >
                      Retirer
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
