'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createLeaveType, updateLeaveType } from '@/lib/actions/leaves'
import type { LeaveType } from '@/lib/types/database'

interface LeaveTypeManagerProps {
  leaveTypes: LeaveType[]
}

const PRESET_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#84cc16', // lime
  '#6366f1', // indigo
]

interface NewTypeForm {
  name: string
  code: string
  color: string
  requires_approval: boolean
  deducts_balance: boolean
}

const emptyForm: NewTypeForm = {
  name: '',
  code: '',
  color: PRESET_COLORS[0],
  requires_approval: true,
  deducts_balance: true,
}

export function LeaveTypeManager({ leaveTypes }: LeaveTypeManagerProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showAddForm, setShowAddForm] = useState(false)
  const [newType, setNewType] = useState<NewTypeForm>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<NewTypeForm>(emptyForm)

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()

    if (!newType.name.trim()) {
      toast.error('Le nom est obligatoire')
      return
    }
    if (!newType.code.trim()) {
      toast.error('Le code est obligatoire')
      return
    }

    startTransition(async () => {
      const result = await createLeaveType({
        name: newType.name.trim(),
        code: newType.code.trim().toUpperCase(),
        color: newType.color,
        requires_approval: newType.requires_approval,
        deducts_balance: newType.deducts_balance,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Type de conge cree')
        setNewType(emptyForm)
        setShowAddForm(false)
        router.refresh()
      }
    })
  }

  function startEdit(type: LeaveType) {
    setEditingId(type.id)
    setEditForm({
      name: type.name,
      code: type.code,
      color: type.color,
      requires_approval: type.requires_approval,
      deducts_balance: type.deducts_balance,
    })
  }

  function handleUpdate(typeId: string) {
    if (!editForm.name.trim()) {
      toast.error('Le nom est obligatoire')
      return
    }

    startTransition(async () => {
      const result = await updateLeaveType(typeId, {
        name: editForm.name.trim(),
        code: editForm.code.trim().toUpperCase(),
        color: editForm.color,
        requires_approval: editForm.requires_approval,
        deducts_balance: editForm.deducts_balance,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Type de conge mis a jour')
        setEditingId(null)
        router.refresh()
      }
    })
  }

  function handleToggleActive(type: LeaveType) {
    startTransition(async () => {
      const result = await updateLeaveType(type.id, {
        is_active: !type.is_active,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(type.is_active ? 'Type desactive' : 'Type active')
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* En-tete */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-text">Types de conges</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-3 py-1.5 rounded-lg font-semibold text-white text-xs
            bg-primary hover:bg-primary-dark transition-colors"
        >
          {showAddForm ? 'Fermer' : 'Ajouter un type'}
        </button>
      </div>

      {/* Formulaire d'ajout */}
      {showAddForm && (
        <form
          onSubmit={handleCreate}
          className="bg-surface rounded-xl border border-border p-5 space-y-4"
        >
          <h3 className="text-sm font-bold text-text">Nouveau type de conge</h3>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                Nom *
              </label>
              <input
                type="text"
                value={newType.name}
                onChange={(e) => setNewType({ ...newType, name: e.target.value })}
                placeholder="Conges payes"
                required
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm
                  focus:border-primary focus:ring-1 focus:ring-primary transition-colors
                  placeholder:text-muted/50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                Code *
              </label>
              <input
                type="text"
                value={newType.code}
                onChange={(e) => setNewType({ ...newType, code: e.target.value })}
                placeholder="CP"
                required
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm uppercase
                  focus:border-primary focus:ring-1 focus:ring-primary transition-colors
                  placeholder:text-muted/50"
              />
            </div>
          </div>

          {/* Couleur */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
              Couleur
            </label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setNewType({ ...newType, color })}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    newType.color === color
                      ? 'border-text scale-110'
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Options */}
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={newType.requires_approval}
                onChange={(e) => setNewType({ ...newType, requires_approval: e.target.checked })}
                className="rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-xs text-muted">Necessite une approbation</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={newType.deducts_balance}
                onChange={(e) => setNewType({ ...newType, deducts_balance: e.target.checked })}
                className="rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-xs text-muted">Deduit du solde</span>
            </label>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 rounded-lg font-semibold text-white text-sm
                bg-primary hover:bg-primary-dark transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? 'Creation...' : 'Creer'}
            </button>
            <button
              type="button"
              onClick={() => { setShowAddForm(false); setNewType(emptyForm) }}
              className="px-4 py-2 rounded-lg font-semibold text-sm text-muted
                bg-surface-dark hover:bg-surface-hover transition-colors"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {/* Liste des types */}
      <div className="space-y-2">
        {leaveTypes.map((type) => {
          const isEditing = editingId === type.id

          if (isEditing) {
            return (
              <div
                key={type.id}
                className="bg-surface rounded-xl border border-primary p-5 space-y-4"
              >
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                      Nom
                    </label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm
                        focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                      Code
                    </label>
                    <input
                      type="text"
                      value={editForm.code}
                      onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                      className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm uppercase
                        focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                    />
                  </div>
                </div>

                {/* Couleur */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                    Couleur
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setEditForm({ ...editForm, color })}
                        className={`w-7 h-7 rounded-full border-2 transition-all ${
                          editForm.color === color
                            ? 'border-text scale-110'
                            : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                {/* Options */}
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.requires_approval}
                      onChange={(e) => setEditForm({ ...editForm, requires_approval: e.target.checked })}
                      className="rounded border-border text-primary focus:ring-primary"
                    />
                    <span className="text-xs text-muted">Necessite une approbation</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.deducts_balance}
                      onChange={(e) => setEditForm({ ...editForm, deducts_balance: e.target.checked })}
                      className="rounded border-border text-primary focus:ring-primary"
                    />
                    <span className="text-xs text-muted">Deduit du solde</span>
                  </label>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => handleUpdate(type.id)}
                    disabled={isPending}
                    className="px-4 py-2 rounded-lg font-semibold text-white text-sm
                      bg-primary hover:bg-primary-dark transition-colors
                      disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPending ? 'Sauvegarde...' : 'Sauvegarder'}
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    disabled={isPending}
                    className="px-4 py-2 rounded-lg font-semibold text-sm text-muted
                      bg-surface-dark hover:bg-surface-hover transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )
          }

          return (
            <div
              key={type.id}
              className={`bg-surface rounded-lg border border-border p-4 flex items-center justify-between gap-3
                hover:bg-surface-hover transition-colors ${!type.is_active ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="inline-block w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: type.color }}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text">{type.name}</span>
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-surface-dark text-muted font-mono">
                      {type.code}
                    </span>
                    {!type.is_active && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-danger/15 text-danger font-medium">
                        Inactif
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3 mt-0.5">
                    {type.requires_approval && (
                      <span className="text-[11px] text-muted">Approbation requise</span>
                    )}
                    {type.deducts_balance && (
                      <span className="text-[11px] text-muted">Deduit du solde</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => startEdit(type)}
                  disabled={isPending}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold
                    bg-primary/15 text-primary hover:bg-primary/25 transition-colors
                    disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Modifier
                </button>
                <button
                  onClick={() => handleToggleActive(type)}
                  disabled={isPending}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
                    disabled:opacity-50 disabled:cursor-not-allowed ${
                    type.is_active
                      ? 'bg-danger/15 text-danger hover:bg-danger/25'
                      : 'bg-green-500/15 text-green-600 hover:bg-green-500/25'
                  }`}
                >
                  {type.is_active ? 'Desactiver' : 'Activer'}
                </button>
              </div>
            </div>
          )
        })}

        {leaveTypes.length === 0 && (
          <div className="text-center py-8 text-muted text-sm">
            Aucun type de conge configure
          </div>
        )}
      </div>
    </div>
  )
}
