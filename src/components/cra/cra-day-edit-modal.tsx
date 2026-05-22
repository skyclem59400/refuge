'use client'

import { useState, useTransition } from 'react'
import { X, Check, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import type { CraDay } from '@/lib/types/database'
import { upsertCraEntry, deleteCraEntry } from '@/lib/actions/cra-saisie'

interface Props {
  memberId: string
  day: CraDay
  onClose: () => void
  onSaved: () => void
}

function hours(start: string | null, end: string | null): number {
  if (!start || !end) return 0
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return (eh * 60 + em - (sh * 60 + sm)) / 60
}

export function CraDayEditModal({ memberId, day, onClose, onSaved }: Props) {
  const [isRest, setIsRest] = useState(day.is_rest_day)
  const [startAm, setStartAm] = useState(day.start_am?.slice(0, 5) || '08:00')
  const [endAm, setEndAm] = useState(day.end_am?.slice(0, 5) || '12:00')
  const [startPm, setStartPm] = useState(day.start_pm?.slice(0, 5) || '14:00')
  const [endPm, setEndPm] = useState(day.end_pm?.slice(0, 5) || '17:00')
  const [notes, setNotes] = useState(day.notes || '')
  const [isPending, startTransition] = useTransition()

  const isLocked = day.source === 'leave' || day.source === 'holiday' || day.source === 'extended_leave'
  const total = isRest ? 0 : hours(startAm, endAm) + hours(startPm, endPm)

  function save() {
    if (!isRest) {
      for (const t of [endAm, endPm]) {
        if (t > '17:00') {
          toast.error('Aucun horaire ne peut dépasser 17h00.')
          return
        }
      }
    }
    startTransition(async () => {
      const r = await upsertCraEntry(memberId, day.date, {
        is_rest_day: isRest,
        start_am: isRest ? null : startAm,
        end_am: isRest ? null : endAm,
        start_pm: isRest ? null : startPm,
        end_pm: isRest ? null : endPm,
        notes: notes || null,
      })
      if (r.error) toast.error(r.error)
      else { toast.success('Journée enregistrée'); onSaved() }
    })
  }

  function reset() {
    if (!confirm('Supprimer la surcharge et revenir au template ?')) return
    startTransition(async () => {
      const r = await deleteCraEntry(memberId, day.date)
      if (r.error) toast.error(r.error)
      else { toast.success('Retour au template'); onSaved() }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-surface rounded-2xl border border-border max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-text">{new Date(day.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h2>
            <p className="text-xs text-muted">Source actuelle : {day.source}{day.source === 'override' && ' (modifié)'}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-lg hover:bg-surface-dark flex items-center justify-center">
            <X className="w-5 h-5 text-muted" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {isLocked ? (
            <div className="p-4 rounded-xl border border-orange-500/40 bg-orange-500/10 text-sm text-orange-200">
              {day.source === 'leave' && `Ce jour est un congé (${day.leave_label}). Modifiez la demande de congé directement si besoin.`}
              {day.source === 'holiday' && `Jour férié : ${day.holiday_name}.`}
              {day.source === 'extended_leave' && `Arrêt longue durée.`}
            </div>
          ) : (
            <>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isRest} onChange={(e) => setIsRest(e.target.checked)} />
                <span className="text-sm font-semibold">Jour de repos</span>
              </label>

              {!isRest && (
                <div className="grid grid-cols-2 gap-3">
                  <TimeInput label="Début matin" value={startAm} onChange={setStartAm} />
                  <TimeInput label="Fin matin" value={endAm} onChange={setEndAm} />
                  <TimeInput label="Début aprem" value={startPm} onChange={setStartPm} />
                  <TimeInput label="Fin aprem" value={endPm} onChange={setEndPm} />
                </div>
              )}

              {!isRest && (
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
                  <strong className="text-primary">Total :</strong> {Math.round(total * 100) / 100}h
                </div>
              )}

              <div>
                <label className="text-xs text-muted mb-1 block">Notes (optionnel)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Ex : intervention astreinte 6h-8h"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-surface-dark/40 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-3">
          {day.source === 'override' && (
            <button
              onClick={reset}
              disabled={isPending}
              className="text-xs px-3 py-2 rounded-lg border border-border hover:bg-surface-dark flex items-center gap-1 disabled:opacity-50"
            >
              <RotateCcw className="w-3 h-3" />
              Retour au template
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted hover:bg-surface-dark transition-colors">
              Annuler
            </button>
            {!isLocked && (
              <button
                onClick={save}
                disabled={isPending}
                className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                {isPending ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function TimeInput(props: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted">{props.label}</span>
      <input
        type="time"
        step={900}
        max="17:00"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="px-3 py-2 rounded-lg border border-border bg-surface-dark/40 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
      />
    </label>
  )
}
