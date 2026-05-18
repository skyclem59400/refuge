'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Clock, Plus } from 'lucide-react'
import { adminCreateLeaveRequest } from '@/lib/actions/leaves'
import type { EstablishmentMember, LeaveType, LeaveGranularity } from '@/lib/types/database'

interface Props {
  readonly members: EstablishmentMember[]
  readonly leaveTypes: LeaveType[]
}

function memberLabel(m: EstablishmentMember): string {
  return m.full_name || m.pseudo || m.email || 'Membre'
}

function diffDays(start: string, end: string): number {
  if (!start || !end) return 0
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  return Math.max(0, Math.round((e.getTime() - s.getTime()) / 86400000) + 1)
}

function hoursBetween(start: string, end: string): number {
  if (!start || !end) return 0
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const h = (eh * 60 + em - (sh * 60 + sm)) / 60
  return h > 0 ? h : 0
}

export function AdminLeaveCreator({ members, leaveTypes }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const [memberId, setMemberId] = useState('')
  const [leaveTypeId, setLeaveTypeId] = useState(leaveTypes[0]?.id || '')
  const [granularity, setGranularity] = useState<LeaveGranularity>('full_day')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [halfStart, setHalfStart] = useState(false)
  const [halfEnd, setHalfEnd] = useState(false)
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [reason, setReason] = useState('')
  const [autoApprove, setAutoApprove] = useState(true)

  function reset() {
    setMemberId('')
    setLeaveTypeId(leaveTypes[0]?.id || '')
    setGranularity('full_day')
    setStartDate('')
    setEndDate('')
    setHalfStart(false)
    setHalfEnd(false)
    setStartTime('')
    setEndTime('')
    setReason('')
    setAutoApprove(true)
  }

  const computedDays =
    granularity === 'hourly'
      ? 0
      : Math.max(
          0.5,
          diffDays(startDate, endDate) - (halfStart ? 0.5 : 0) - (halfEnd ? 0.5 : 0)
        )
  const computedHours = granularity === 'hourly' ? hoursBetween(startTime, endTime) : 0

  function handleSubmit() {
    if (!memberId) return toast.error('Selectionne un collaborateur')
    if (!leaveTypeId) return toast.error('Selectionne un type')
    if (!startDate || !endDate) return toast.error('Renseigne les dates')
    if (granularity === 'hourly') {
      if (startDate !== endDate) return toast.error('Arret horaire : meme date debut/fin')
      if (!startTime || !endTime) return toast.error('Heures obligatoires')
      if (endTime <= startTime) return toast.error('Heure de fin > debut')
    }

    startTransition(async () => {
      const res = await adminCreateLeaveRequest({
        member_id: memberId,
        leave_type_id: leaveTypeId,
        start_date: startDate,
        end_date: endDate,
        half_day_start: granularity === 'half_day' ? halfStart : false,
        half_day_end: granularity === 'half_day' ? halfEnd : false,
        days_count: computedDays,
        granularity,
        start_time: granularity === 'hourly' ? startTime : null,
        end_time: granularity === 'hourly' ? endTime : null,
        duration_hours: granularity === 'hourly' ? computedHours : null,
        reason: reason.trim() || undefined,
        auto_approve: autoApprove,
      })
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(autoApprove ? 'Arret enregistre et valide' : 'Demande creee, en attente')
        reset()
        setOpen(false)
        router.refresh()
      }
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold
          bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Saisir un arret / conge
      </button>
    )
  }

  return (
    <div className="bg-surface rounded-xl border border-border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-text flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          Saisie admin d&apos;un arret / conge
        </h3>
        <button
          onClick={() => { reset(); setOpen(false) }}
          className="text-muted hover:text-text text-xs"
        >
          Fermer
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
            Collaborateur
          </label>
          <select
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            className="w-full px-3 py-2 bg-surface-dark border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary"
          >
            <option value="">— Choisir —</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {memberLabel(m)} ({m.contract_type})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
            Type
          </label>
          <select
            value={leaveTypeId}
            onChange={(e) => setLeaveTypeId(e.target.value)}
            className="w-full px-3 py-2 bg-surface-dark border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary"
          >
            {leaveTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1.5">
          Granularite
        </label>
        <div className="flex gap-2 flex-wrap">
          {([
            { v: 'full_day', l: 'Jour(s) complet(s)' },
            { v: 'half_day', l: 'Demi-journee' },
            { v: 'hourly', l: 'Heures' },
          ] as const).map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => setGranularity(o.v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                granularity === o.v
                  ? 'bg-primary text-white'
                  : 'bg-surface-dark text-muted hover:text-text'
              }`}
            >
              {o.l}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
            Date debut
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value)
              if (granularity === 'hourly') setEndDate(e.target.value)
              else if (!endDate || endDate < e.target.value) setEndDate(e.target.value)
            }}
            className="w-full px-3 py-2 bg-surface-dark border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
            Date fin
          </label>
          <input
            type="date"
            value={endDate}
            min={startDate}
            disabled={granularity === 'hourly'}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 bg-surface-dark border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
          />
        </div>
      </div>

      {granularity === 'half_day' && (
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
            <input type="checkbox" checked={halfStart} onChange={(e) => setHalfStart(e.target.checked)} className="accent-primary" />
            Demi-jour le matin (debut)
          </label>
          <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
            <input type="checkbox" checked={halfEnd} onChange={(e) => setHalfEnd(e.target.checked)} className="accent-primary" />
            Demi-jour l&apos;apres-midi (fin)
          </label>
        </div>
      )}

      {granularity === 'hourly' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
              Heure debut
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2 bg-surface-dark border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
              Heure fin
            </label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3 py-2 bg-surface-dark border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      )}

      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
          Motif / commentaire (facultatif)
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="Ex : RDV medical, formation, ..."
          className="w-full px-3 py-2 bg-surface-dark border border-border rounded-lg text-sm resize-y focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-muted/50"
        />
      </div>

      <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
        <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
          <input type="checkbox" checked={autoApprove} onChange={(e) => setAutoApprove(e.target.checked)} className="accent-primary" />
          Valider automatiquement (saisie admin)
        </label>
        <div className="text-xs text-muted">
          {granularity === 'hourly'
            ? `${computedHours.toFixed(2)} h`
            : `${computedDays} jour${computedDays > 1 ? 's' : ''}`}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSubmit}
          disabled={isPending}
          className="flex-1 px-3 py-2 rounded-lg font-semibold text-white text-sm bg-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isPending ? 'Enregistrement...' : 'Enregistrer'}
        </button>
        <button
          onClick={() => { reset(); setOpen(false) }}
          disabled={isPending}
          className="px-3 py-2 rounded-lg font-semibold text-sm text-muted bg-surface-dark hover:bg-surface-hover transition-colors"
        >
          Annuler
        </button>
      </div>
    </div>
  )
}
