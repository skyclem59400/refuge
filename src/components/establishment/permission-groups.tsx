'use client'

import { useState, useEffect, useTransition } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import {
  createPermissionGroup,
  updatePermissionGroup,
  deletePermissionGroup,
} from '@/lib/actions/establishments'
import type { PermissionGroup, Permission } from '@/lib/types/database'

const PERMISSION_LABELS: { key: Permission; label: string }[] = [
  { key: 'manage_establishment', label: 'Gestion etablissement' },
  { key: 'manage_animals', label: 'Gestion animaux' },
  { key: 'view_animals', label: 'Voir animaux' },
  { key: 'manage_health', label: 'Sante' },
  { key: 'manage_movements', label: 'Mouvements' },
  { key: 'manage_boxes', label: 'Box' },
  { key: 'manage_outings', label: 'Sorties' },
  { key: 'manage_documents', label: 'Documents' },
  { key: 'manage_clients', label: 'Repertoire' },
  { key: 'manage_donations', label: 'Dons' },
  { key: 'manage_posts', label: 'Publications' },
  { key: 'view_pound', label: 'Fourriere' },
  { key: 'view_statistics', label: 'Statistiques' },
]

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

interface PermissionGroupsProps {
  groups: PermissionGroup[]
}

export function PermissionGroups({ groups: initialGroups }: PermissionGroupsProps) {
  const [groups, setGroups] = useState(initialGroups)
  const [isPending, startTransition] = useTransition()
  const [creatingName, setCreatingName] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editingNameId, setEditingNameId] = useState<string | null>(null)
  const [editingNameValue, setEditingNameValue] = useState('')
  const router = useRouter()

  useEffect(() => { setGroups(initialGroups) }, [initialGroups])

  function handleTogglePermission(groupId: string, permission: Permission, currentValue: boolean) {
    // Optimistic update
    setGroups(prev => prev.map(g =>
      g.id === groupId ? { ...g, [permission]: !currentValue } : g
    ))

    startTransition(async () => {
      const result = await updatePermissionGroup(groupId, { [permission]: !currentValue })
      if (result.error) {
        toast.error(result.error)
        // Revert
        setGroups(prev => prev.map(g =>
          g.id === groupId ? { ...g, [permission]: currentValue } : g
        ))
      }
    })
  }

  function handleCreate() {
    if (!creatingName.trim()) return
    startTransition(async () => {
      const result = await createPermissionGroup({ name: creatingName.trim() })
      if (result.error) {
        toast.error(result.error)
      } else if (result.data) {
        setGroups(prev => [...prev, result.data!])
        setCreatingName('')
        setShowCreate(false)
        toast.success('Groupe cree')
        router.refresh()
      }
    })
  }

  function handleDelete(groupId: string, groupName: string) {
    if (!confirm(`Supprimer le groupe "${groupName}" ?`)) return
    startTransition(async () => {
      const result = await deletePermissionGroup(groupId)
      if (result.error) {
        toast.error(result.error)
      } else {
        setGroups(prev => prev.filter(g => g.id !== groupId))
        toast.success('Groupe supprime')
        router.refresh()
      }
    })
  }

  function handleStartEditName(group: PermissionGroup) {
    setEditingNameId(group.id)
    setEditingNameValue(group.name)
  }

  function handleSaveName(groupId: string) {
    if (!editingNameValue.trim()) return
    startTransition(async () => {
      const result = await updatePermissionGroup(groupId, { name: editingNameValue.trim() })
      if (result.error) {
        toast.error(result.error)
      } else {
        setGroups(prev => prev.map(g =>
          g.id === groupId ? { ...g, name: editingNameValue.trim() } : g
        ))
        toast.success('Nom mis a jour')
      }
      setEditingNameId(null)
    })
  }

  return (
    <div className="bg-surface rounded-xl border border-border p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Groupes de permissions</h2>
          <p className="text-xs text-muted mt-0.5">
            Creez des groupes et activez/desactivez les fonctionnalites pour chacun
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-3 py-1.5 rounded-lg font-semibold text-white text-xs
            bg-primary hover:bg-primary-dark transition-colors"
        >
          + Nouveau groupe
        </button>
      </div>

      {showCreate && (
        <div className="flex items-center gap-3 p-4 bg-surface-dark rounded-lg border border-border">
          <input
            type="text"
            value={creatingName}
            onChange={(e) => setCreatingName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Nom du groupe..."
            className="flex-1 px-3 py-2 bg-surface border border-border rounded-lg text-sm
              focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
            autoFocus
          />
          <button
            onClick={handleCreate}
            disabled={isPending || !creatingName.trim()}
            className="px-3 py-2 rounded-lg font-semibold text-white text-xs
              bg-primary hover:bg-primary-dark transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Creer
          </button>
          <button
            onClick={() => { setShowCreate(false); setCreatingName('') }}
            className="px-3 py-2 rounded-lg text-xs text-muted hover:text-text transition-colors"
          >
            Annuler
          </button>
        </div>
      )}

      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.id} className="p-4 bg-surface-dark rounded-lg border border-border space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {editingNameId === group.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editingNameValue}
                      onChange={(e) => setEditingNameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveName(group.id)
                        if (e.key === 'Escape') setEditingNameId(null)
                      }}
                      className="px-2 py-1 bg-surface border border-border rounded text-sm font-semibold
                        focus:border-primary focus:ring-1 focus:ring-primary"
                      autoFocus
                    />
                    <button
                      onClick={() => handleSaveName(group.id)}
                      className="text-xs text-primary hover:text-primary-dark"
                    >
                      OK
                    </button>
                  </div>
                ) : (
                  <>
                    <h3 className="text-sm font-semibold">{group.name}</h3>
                    {group.is_system && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium">
                        Systeme
                      </span>
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!group.is_system && editingNameId !== group.id && (
                  <>
                    <button
                      onClick={() => handleStartEditName(group)}
                      className="text-xs text-muted hover:text-text transition-colors"
                    >
                      Renommer
                    </button>
                    <button
                      onClick={() => handleDelete(group.id, group.name)}
                      disabled={isPending}
                      className="px-2 py-1 rounded text-xs font-medium bg-danger/15 text-danger hover:bg-danger/25 transition-colors disabled:opacity-50"
                    >
                      Supprimer
                    </button>
                  </>
                )}
              </div>
            </div>

            {group.description && (
              <p className="text-xs text-muted">{group.description}</p>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {PERMISSION_LABELS.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-surface/50">
                  <span className="text-xs text-text truncate">{label}</span>
                  <ToggleSwitch
                    checked={group[key] as boolean}
                    onChange={() => handleTogglePermission(group.id, key, group[key] as boolean)}
                    disabled={isPending || group.is_system}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
