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
  // Les cases "Matin" / "Après-midi" permettent les demi-journées (intervention
  // astreinte 7h30-10h30 sans après-midi par exemple).
  // Cas 1 : le jour avait deja des horaires saisis → on respecte ce qui existe
  // Cas 2 : le jour etait en repos (dimanche, ferie) → on pre-coche SEULEMENT
  //   le matin (cas typique : intervention astreinte courte). L'user pourra
  //   cocher l'apres-midi en plus si besoin.
  const [hasMorning, setHasMorning] = useState(
    day.is_rest_day ? true : !!(day.start_am && day.end_am)
  )
  const [hasAfternoon, setHasAfternoon] = useState(
    day.is_rest_day ? false : !!(day.start_pm && day.end_pm)
  )
  const [startAm, setStartAm] = useState(day.start_am?.slice(0, 5) || '08:00')
  const [endAm, setEndAm] = useState(day.end_am?.slice(0, 5) || '12:00')
  const [startPm, setStartPm] = useState(day.start_pm?.slice(0, 5) || '14:00')
  const [endPm, setEndPm] = useState(day.end_pm?.slice(0, 5) || '17:00')
  const [notes, setNotes] = useState(day.notes || '')
  const [isPending, startTransition] = useTransition()

  // Seuls les congés validés et les arrêts longue durée bloquent vraiment la saisie.
  // Les jours fériés restent éditables : on peut travailler exceptionnellement
  // un férié (astreinte, intervention urgente, etc.) et il faut pouvoir le saisir.
  const isLocked = day.source === 'leave' || day.source === 'extended_leave'
  const isHoliday = day.source === 'holiday' || !!day.holiday_name
  const total = isRest
    ? 0
    : (hasMorning ? hours(startAm, endAm) : 0) + (hasAfternoon ? hours(startPm, endPm) : 0)

  function save() {
    if (!isRest && !hasMorning && !hasAfternoon) {
      toast.error('Cochez au moins une demi-journée, ou activez "Jour de repos".')
      return
    }
    if (!isRest) {
      if (hasMorning && endAm > '17:00') {
        toast.error('Aucun horaire ne peut dépasser 17h00.')
        return
      }
      if (hasAfternoon && endPm > '17:00') {
        toast.error('Aucun horaire ne peut dépasser 17h00.')
        return
      }
      if (hasMorning && endAm <= startAm) {
        toast.error('Matin : l\'heure de fin doit être après l\'heure de début.')
        return
      }
      if (hasAfternoon && endPm <= startPm) {
        toast.error('Après-midi : l\'heure de fin doit être après l\'heure de début.')
        return
      }
      if (hasMorning && hasAfternoon && startPm < endAm) {
        toast.error(`L'après-midi (${startPm}) ne peut pas commencer avant la fin du matin (${endAm}). Ajustez les horaires ou décochez une demi-journée.`)
        return
      }
    }
    startTransition(async () => {
      const r = await upsertCraEntry(memberId, day.date, {
        is_rest_day: isRest,
        start_am: isRest || !hasMorning ? null : startAm,
        end_am: isRest || !hasMorning ? null : endAm,
        start_pm: isRest || !hasAfternoon ? null : startPm,
        end_pm: isRest || !hasAfternoon ? null : endPm,
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
              {day.source === 'extended_leave' && `Arrêt longue durée.`}
            </div>
          ) : (
            <>
              {isHoliday && (
                <div className="p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-xs text-amber-200">
                  <strong>Jour férié : {day.holiday_name}.</strong> Si vous avez travaillé exceptionnellement
                  ce jour (astreinte, intervention urgente, etc.), saisissez vos horaires ci-dessous.
                  Sinon laissez en jour de repos.
                </div>
              )}

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isRest}
                  onChange={(e) => {
                    const next = e.target.checked
                    setIsRest(next)
                    // Quand on DECOCHE "Jour de repos" (= on commence une saisie),
                    // on force "matin seul" coche par defaut. C'est le cas le plus
                    // frequent (demi-journee Matthieu, intervention astreinte courte).
                    // L'utilisateur peut toujours cocher l'apres-midi en plus.
                    if (!next) {
                      setHasMorning(true)
                      setHasAfternoon(false)
                    }
                  }}
                />
                <span className="text-sm font-semibold">Jour de repos</span>
              </label>

              {isRest && (
                <div className="p-3 rounded-xl border border-primary/30 bg-primary/5 text-xs text-primary-light">
                  💡 <strong>Décochez « Jour de repos »</strong> ci-dessus pour saisir vos horaires
                  (ex : intervention astreinte un dimanche de 7h30 à 10h30).
                </div>
              )}

              {!isRest && (
                <div className="space-y-4">
                  {/* Matin */}
                  <div className={`rounded-lg border p-3 ${hasMorning ? 'border-primary/40 bg-primary/5' : 'border-border bg-surface-dark/30'}`}>
                    <label className="flex items-center gap-2 cursor-pointer mb-2">
                      <input
                        type="checkbox"
                        checked={hasMorning}
                        onChange={(e) => setHasMorning(e.target.checked)}
                      />
                      <span className="text-sm font-semibold">Matin</span>
                    </label>
                    {hasMorning && (
                      <div className="grid grid-cols-2 gap-3">
                        <TimeInput label="Début" value={startAm} onChange={setStartAm} />
                        <TimeInput label="Fin" value={endAm} onChange={setEndAm} />
                      </div>
                    )}
                  </div>

                  {/* Après-midi */}
                  <div className={`rounded-lg border p-3 ${hasAfternoon ? 'border-primary/40 bg-primary/5' : 'border-border bg-surface-dark/30'}`}>
                    <label className="flex items-center gap-2 cursor-pointer mb-2">
                      <input
                        type="checkbox"
                        checked={hasAfternoon}
                        onChange={(e) => setHasAfternoon(e.target.checked)}
                      />
                      <span className="text-sm font-semibold">Après-midi</span>
                    </label>
                    {hasAfternoon && (
                      <div className="grid grid-cols-2 gap-3">
                        <TimeInput label="Début" value={startPm} onChange={setStartPm} />
                        <TimeInput label="Fin" value={endPm} onChange={setEndPm} />
                      </div>
                    )}
                  </div>
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
