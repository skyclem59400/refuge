'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createLeaveRequest } from '@/lib/actions/leaves'
import type { LeaveType, LeaveBalance } from '@/lib/types/database'

interface LeaveRequestFormProps {
  leaveTypes: LeaveType[]
  balances: LeaveBalance[]
}

function countBusinessDays(startDate: string, endDate: string): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  if (end < start) return 0

  let count = 0
  const current = new Date(start)
  while (current <= end) {
    const day = current.getDay()
    if (day !== 0 && day !== 6) {
      count++
    }
    current.setDate(current.getDate() + 1)
  }
  return count
}

export function LeaveRequestForm({ leaveTypes, balances }: LeaveRequestFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const activeTypes = leaveTypes.filter((t) => t.is_active)

  const [leaveTypeId, setLeaveTypeId] = useState(activeTypes[0]?.id ?? '')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [halfDayStart, setHalfDayStart] = useState(false)
  const [halfDayEnd, setHalfDayEnd] = useState(false)
  const [reason, setReason] = useState('')

  const daysCount = useMemo(() => {
    if (!startDate || !endDate) return 0
    let days = countBusinessDays(startDate, endDate)
    if (halfDayStart) days -= 0.5
    if (halfDayEnd) days -= 0.5
    return Math.max(days, 0)
  }, [startDate, endDate, halfDayStart, halfDayEnd])

  const selectedBalance = balances.find((b) => b.leave_type_id === leaveTypeId)
  const remaining = selectedBalance
    ? selectedBalance.initial_balance - selectedBalance.used + selectedBalance.adjustment
    : null

  const selectedType = activeTypes.find((t) => t.id === leaveTypeId)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!leaveTypeId) {
      toast.error('Veuillez selectionner un type de conge')
      return
    }
    if (!startDate || !endDate) {
      toast.error('Veuillez renseigner les dates')
      return
    }
    if (new Date(endDate) < new Date(startDate)) {
      toast.error('La date de fin doit etre apres la date de debut')
      return
    }
    if (daysCount <= 0) {
      toast.error('La duree doit etre superieure a 0 jour')
      return
    }

    startTransition(async () => {
      const result = await createLeaveRequest({
        leave_type_id: leaveTypeId,
        start_date: startDate,
        end_date: endDate,
        half_day_start: halfDayStart,
        half_day_end: halfDayEnd,
        days_count: daysCount,
        reason: reason.trim() || undefined,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Demande de conge envoyee')
        router.push('/espace-collaborateur/conges')
        router.refresh()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface rounded-xl border border-border p-6 space-y-5">
      <h2 className="text-lg font-bold text-text">Nouvelle demande de conge</h2>

      {/* Type de conge */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
          Type de conge *
        </label>
        <select
          value={leaveTypeId}
          onChange={(e) => setLeaveTypeId(e.target.value)}
          className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm
            focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
        >
          {activeTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>

        {/* Solde restant */}
        {selectedType && remaining !== null && selectedType.deducts_balance && (
          <p className="text-xs text-muted mt-1.5">
            Solde restant : <span className={remaining <= 0 ? 'text-danger font-semibold' : 'text-green-600 font-semibold'}>{remaining} jours</span>
          </p>
        )}
      </div>

      {/* Dates */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
            Date de debut *
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
            className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm
              focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
          />
          <label className="flex items-center gap-2 mt-2 cursor-pointer">
            <input
              type="checkbox"
              checked={halfDayStart}
              onChange={(e) => setHalfDayStart(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-xs text-muted">Demi-journee (debut apres-midi)</span>
          </label>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
            Date de fin *
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
            min={startDate || undefined}
            className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm
              focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
          />
          <label className="flex items-center gap-2 mt-2 cursor-pointer">
            <input
              type="checkbox"
              checked={halfDayEnd}
              onChange={(e) => setHalfDayEnd(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-xs text-muted">Demi-journee (fin le matin)</span>
          </label>
        </div>
      </div>

      {/* Recapitulatif jours */}
      {daysCount > 0 && (
        <div className="bg-primary/10 rounded-lg px-4 py-3">
          <p className="text-sm font-semibold text-primary">
            {daysCount} jour{daysCount > 1 ? 's' : ''} ouvre{daysCount > 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Motif */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
          Motif
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Motif de la demande (facultatif)"
          className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm resize-y
            focus:border-primary focus:ring-1 focus:ring-primary transition-colors
            placeholder:text-muted/50"
        />
      </div>

      {/* Bouton */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={isPending || daysCount <= 0}
          className="px-6 py-2.5 rounded-lg font-semibold text-white text-sm
            bg-primary hover:bg-primary-dark transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? 'Envoi en cours...' : 'Envoyer la demande'}
        </button>
      </div>
    </form>
  )
}
