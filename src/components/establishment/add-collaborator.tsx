'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { createPseudoMember } from '@/lib/actions/establishments'
import type { PermissionGroup } from '@/lib/types/database'

interface AddCollaboratorProps {
  groups: PermissionGroup[]
}

export function AddCollaborator({ groups }: AddCollaboratorProps) {
  const [pseudo, setPseudo] = useState('')
  const [roleType, setRoleType] = useState<'salarie' | 'benevole'>('salarie')
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(() => {
    const membreGroup = groups.find(g => g.name === 'Membre' && !g.is_system)
    return membreGroup ? new Set([membreGroup.id]) : new Set()
  })
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function toggleGroup(groupId: string) {
    setSelectedGroupIds(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!pseudo.trim()) {
      toast.error('Veuillez saisir un prenom')
      return
    }

    startTransition(async () => {
      const result = await createPseudoMember({
        pseudo: pseudo.trim(),
        roleType,
        groupIds: Array.from(selectedGroupIds),
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Collaborateur "${pseudo}" ajoute. Il pourra se connecter avec son pseudo.`)
        setPseudo('')
        const membreGroup = groups.find(g => g.name === 'Membre' && !g.is_system)
        setSelectedGroupIds(membreGroup ? new Set([membreGroup.id]) : new Set())
        router.refresh()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-surface-dark rounded-lg border border-border space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
            Prenom (pseudo)
          </label>
          <input
            type="text"
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            placeholder="Ex: Marie"
            required
            className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg text-sm
              focus:border-primary focus:ring-1 focus:ring-primary transition-colors
              placeholder:text-muted/50"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
            Role
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRoleType('salarie')}
              className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border
                ${roleType === 'salarie'
                  ? 'bg-primary/15 text-primary border-primary/30'
                  : 'bg-surface border-border text-muted hover:text-text'
                }`}
            >
              Salarie
            </button>
            <button
              type="button"
              onClick={() => setRoleType('benevole')}
              className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border
                ${roleType === 'benevole'
                  ? 'bg-primary/15 text-primary border-primary/30'
                  : 'bg-surface border-border text-muted hover:text-text'
                }`}
            >
              Benevole
            </button>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">
          Groupes de permissions
        </label>
        <div className="flex flex-wrap gap-2">
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => toggleGroup(group.id)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors
                ${selectedGroupIds.has(group.id)
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'bg-surface text-muted border border-border hover:text-text'
                }`}
            >
              {group.name}
            </button>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="px-4 py-2 rounded-lg font-semibold text-white text-sm
          bg-primary hover:bg-primary-dark transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? 'Creation...' : 'Ajouter le collaborateur'}
      </button>
    </form>
  )
}
