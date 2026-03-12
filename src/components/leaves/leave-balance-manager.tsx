'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { setLeaveBalance, bulkSetLeaveBalances } from '@/lib/actions/leaves'
import type { EstablishmentMember, LeaveType, LeaveBalance } from '@/lib/types/database'

interface LeaveBalanceManagerProps {
  members: EstablishmentMember[]
  leaveTypes: LeaveType[]
  balances: LeaveBalance[]
}

interface EditingCell {
  memberId: string
  leaveTypeId: string
  value: string
}

export function LeaveBalanceManager({ members, leaveTypes, balances }: LeaveBalanceManagerProps) {
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState<EditingCell | null>(null)
  const [showBulkForm, setShowBulkForm] = useState(false)
  const [bulkTypeId, setBulkTypeId] = useState(leaveTypes[0]?.id ?? '')
  const [bulkYear, setBulkYear] = useState(new Date().getFullYear())
  const [bulkDays, setBulkDays] = useState(25)

  const activeTypes = leaveTypes.filter((t) => t.is_active)

  function getBalance(memberId: string, leaveTypeId: string): LeaveBalance | undefined {
    return balances.find((b) => b.member_id === memberId && b.leave_type_id === leaveTypeId)
  }

  function handleCellClick(memberId: string, leaveTypeId: string, currentInitial: number) {
    setEditing({
      memberId,
      leaveTypeId,
      value: String(currentInitial),
    })
  }

  function handleSaveCell() {
    if (!editing) return

    const newValue = parseFloat(editing.value)
    if (isNaN(newValue) || newValue < 0) {
      toast.error('Valeur invalide')
      return
    }

    startTransition(async () => {
      const result = await setLeaveBalance({
        member_id: editing.memberId,
        leave_type_id: editing.leaveTypeId,
        year: new Date().getFullYear(),
        initial_balance: newValue,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Solde mis a jour')
      }
      setEditing(null)
    })
  }

  function handleCellKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      handleSaveCell()
    } else if (e.key === 'Escape') {
      setEditing(null)
    }
  }

  function handleBulkSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!bulkTypeId) {
      toast.error('Veuillez selectionner un type de conge')
      return
    }

    startTransition(async () => {
      const result = await bulkSetLeaveBalances({
        leave_type_id: bulkTypeId,
        year: bulkYear,
        initial_balance: bulkDays,
        member_ids: members.map((m) => m.id),
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Soldes initialises pour ${members.length} membres`)
        setShowBulkForm(false)
      }
    })
  }

  function getMemberDisplayName(member: EstablishmentMember): string {
    return member.full_name || member.pseudo || member.email || 'Membre inconnu'
  }

  return (
    <div className="space-y-4">
      {/* En-tete avec bouton bulk */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-text">Gestion des soldes</h2>
        <button
          onClick={() => setShowBulkForm(!showBulkForm)}
          className="px-3 py-1.5 rounded-lg font-semibold text-white text-xs
            bg-primary hover:bg-primary-dark transition-colors"
        >
          {showBulkForm ? 'Fermer' : 'Initialiser l\'annee'}
        </button>
      </div>

      {/* Formulaire bulk */}
      {showBulkForm && (
        <form
          onSubmit={handleBulkSubmit}
          className="bg-surface rounded-xl border border-border p-5 space-y-4"
        >
          <h3 className="text-sm font-bold text-text">Initialisation en masse</h3>
          <p className="text-xs text-muted">
            Definir le solde initial pour tous les membres pour un type de conge et une annee donnee.
          </p>

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                Type de conge
              </label>
              <select
                value={bulkTypeId}
                onChange={(e) => setBulkTypeId(e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm
                  focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              >
                {activeTypes.map((type) => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                Annee
              </label>
              <input
                type="number"
                value={bulkYear}
                onChange={(e) => setBulkYear(parseInt(e.target.value))}
                min={2020}
                max={2100}
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm
                  focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                Jours initiaux
              </label>
              <input
                type="number"
                value={bulkDays}
                onChange={(e) => setBulkDays(parseFloat(e.target.value))}
                min={0}
                step={0.5}
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm
                  focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 rounded-lg font-semibold text-white text-sm
                bg-primary hover:bg-primary-dark transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? 'Application...' : `Appliquer a ${members.length} membres`}
            </button>
            <button
              type="button"
              onClick={() => setShowBulkForm(false)}
              className="px-4 py-2 rounded-lg font-semibold text-sm text-muted
                bg-surface-dark hover:bg-surface-hover transition-colors"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {/* Tableau des soldes */}
      <div className="bg-surface rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">
                Membre
              </th>
              {activeTypes.map((type) => (
                <th
                  key={type.id}
                  className="text-center px-3 py-3 text-xs font-semibold uppercase tracking-wider text-muted"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ backgroundColor: type.color }}
                    />
                    {type.name}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-b border-border last:border-b-0 hover:bg-surface-hover transition-colors">
                <td className="px-4 py-3 font-medium text-text whitespace-nowrap">
                  {getMemberDisplayName(member)}
                  <span className="text-[11px] text-muted ml-2">{member.role_type}</span>
                </td>
                {activeTypes.map((type) => {
                  const balance = getBalance(member.id, type.id)
                  const initial = balance?.initial_balance ?? 0
                  const used = balance?.used ?? 0
                  const adjustment = balance?.adjustment ?? 0
                  const remaining = initial - used + adjustment
                  const isEditing = editing?.memberId === member.id && editing?.leaveTypeId === type.id

                  return (
                    <td key={type.id} className="px-3 py-3 text-center">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editing.value}
                          onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                          onBlur={handleSaveCell}
                          onKeyDown={handleCellKeyDown}
                          autoFocus
                          min={0}
                          step={0.5}
                          className="w-16 px-2 py-1 text-center bg-surface border border-primary rounded text-sm
                            focus:ring-1 focus:ring-primary"
                        />
                      ) : (
                        <button
                          onClick={() => handleCellClick(member.id, type.id, initial)}
                          className="inline-flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg
                            hover:bg-surface-dark transition-colors cursor-pointer"
                          title="Cliquer pour modifier"
                        >
                          <span className={`font-bold text-sm ${remaining <= 0 ? 'text-danger' : 'text-text'}`}>
                            {remaining}
                          </span>
                          <span className="text-[10px] text-muted">
                            {used}/{initial}
                          </span>
                        </button>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {members.length === 0 && (
          <div className="text-center py-8 text-muted text-sm">
            Aucun membre
          </div>
        )}
      </div>
    </div>
  )
}
