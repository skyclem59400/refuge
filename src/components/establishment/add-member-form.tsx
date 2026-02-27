'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { addMember } from '@/lib/actions/establishments'
import type { PermissionGroup } from '@/lib/types/database'

interface AddMemberFormProps {
  groups: PermissionGroup[]
}

export function AddMemberForm({ groups }: AddMemberFormProps) {
  const [email, setEmail] = useState('')
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set())
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
    if (!email.trim()) {
      toast.error('Veuillez saisir un email')
      return
    }

    startTransition(async () => {
      const result = await addMember(email.trim(), Array.from(selectedGroupIds))

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Membre ajoute avec succes')
        setEmail('')
        setSelectedGroupIds(new Set())
        router.refresh()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-surface-dark rounded-lg border border-border space-y-4">
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
          Email du membre
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="utilisateur@exemple.fr"
          required
          className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg text-sm
            focus:border-primary focus:ring-1 focus:ring-primary transition-colors
            placeholder:text-muted/50"
        />
        <p className="text-xs text-muted mt-1">
          L&apos;utilisateur doit deja avoir un compte sur la plateforme.
        </p>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">
          Groupes
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
                  : 'bg-surface-hover text-muted border border-border hover:text-text'
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
        {isPending ? 'Ajout...' : 'Ajouter le membre'}
      </button>
    </form>
  )
}
