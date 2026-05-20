'use client'

import { useState, useTransition } from 'react'
import { Clock, X, Check } from 'lucide-react'
import { toast } from 'sonner'
import type { DayOfWeek, MemberWorkSchedule } from '@/lib/types/database'
import { DAY_OF_WEEK_LABELS_SHORT } from '@/lib/types/database'
import { upsertWorkScheduleDay, applyStandardSchedule } from '@/lib/actions/work-schedules'
import type { MemberWithSchedule } from '@/lib/actions/work-schedules'

interface Props {
  readonly members: MemberWithSchedule[]
}

const DAYS_ORDER: DayOfWeek[] = [1, 2, 3, 4, 5, 6, 0] // Lundi → Dimanche

function memberLabel(m: MemberWithSchedule['member']): string {
  return m.full_name || m.pseudo || m.email || 'Membre'
}

function dayCell(schedule: MemberWorkSchedule[], dow: DayOfWeek): { label: string; isRest: boolean } {
  const s = schedule.find((x) => x.day_of_week === dow)
  if (!s) return { label: '—', isRest: false }
  if (s.is_rest_day) return { label: 'Repos', isRest: true }
  const am = s.start_am && s.end_am ? `${s.start_am.slice(0, 5)}-${s.end_am.slice(0, 5)}` : ''
  const pm = s.start_pm && s.end_pm ? `${s.start_pm.slice(0, 5)}-${s.end_pm.slice(0, 5)}` : ''
  return { label: [am, pm].filter(Boolean).join(' / '), isRest: false }
}

export function WorkSchedulesEditor({ members }: Props) {
  const [editing, setEditing] = useState<MemberWithSchedule | null>(null)
  const [isPending, startTransition] = useTransition()

  if (members.length === 0) {
    return (
      <div className="p-6 rounded-xl border border-border bg-surface-dark/40 text-sm text-muted">
        Aucun salarié ou auto-entrepreneur configuré dans l&apos;établissement.
      </div>
    )
  }

  function refresh() {
    // Server Component reload via revalidate ; simple : recharger la page
    window.location.reload()
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-surface-dark/40 text-xs uppercase text-muted">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Collaborateur</th>
              {DAYS_ORDER.map((d) => (
                <th key={d} className="px-3 py-3 font-semibold">{DAY_OF_WEEK_LABELS_SHORT[d]}</th>
              ))}
              <th className="px-4 py-3 font-semibold text-right">h/sem</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {members.map((row) => (
              <tr key={row.member.id} className="border-t border-border hover:bg-surface-dark/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-semibold text-text">{memberLabel(row.member)}</div>
                  <div className="text-xs text-muted capitalize">{row.member.contract_type.replace('_', ' ')}</div>
                </td>
                {DAYS_ORDER.map((d) => {
                  const cell = dayCell(row.schedule, d)
                  return (
                    <td key={d} className={`px-3 py-3 text-center text-xs ${cell.isRest ? 'text-muted italic' : 'text-text'}`}>
                      {cell.label}
                    </td>
                  )
                })}
                <td className="px-4 py-3 text-right font-semibold text-primary">{row.weekly_hours}h</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setEditing(row)}
                    className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-xs font-semibold transition-colors"
                  >
                    Modifier
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 p-4 rounded-xl border border-border bg-surface-dark/30 text-xs text-muted">
        <p className="font-semibold mb-1">Règles SDA</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>Horaire standard : 8h00-12h00 / 14h00-17h00 = 7h/jour</li>
          <li>Aucun horaire ne dépasse 17h00 (validation au save)</li>
          <li>Granularité de saisie : quart d&apos;heure</li>
        </ul>
      </div>

      {editing && (
        <ScheduleEditModal
          member={editing}
          isPending={isPending}
          onClose={() => setEditing(null)}
          onSave={(updates) => {
            startTransition(async () => {
              for (const u of updates) {
                const r = await upsertWorkScheduleDay(editing.member.id, u.day_of_week, u.payload)
                if (r.error) {
                  toast.error(`Erreur jour ${u.day_of_week} : ${r.error}`)
                  return
                }
              }
              toast.success('Horaires enregistrés')
              setEditing(null)
              refresh()
            })
          }}
          onApplyStandard={(restDays) => {
            startTransition(async () => {
              const r = await applyStandardSchedule(editing.member.id, restDays)
              if (r.error) {
                toast.error(r.error)
                return
              }
              toast.success('Horaires standard appliqués')
              setEditing(null)
              refresh()
            })
          }}
        />
      )}
    </>
  )
}

interface DayPayload {
  is_rest_day: boolean
  start_am: string | null
  end_am: string | null
  start_pm: string | null
  end_pm: string | null
}

function defaultDayPayload(schedule: MemberWorkSchedule[], dow: DayOfWeek): DayPayload {
  const s = schedule.find((x) => x.day_of_week === dow)
  if (!s) return { is_rest_day: false, start_am: '08:00', end_am: '12:00', start_pm: '14:00', end_pm: '17:00' }
  return {
    is_rest_day: s.is_rest_day,
    start_am: s.start_am?.slice(0, 5) || null,
    end_am: s.end_am?.slice(0, 5) || null,
    start_pm: s.start_pm?.slice(0, 5) || null,
    end_pm: s.end_pm?.slice(0, 5) || null,
  }
}

function ScheduleEditModal(props: {
  member: MemberWithSchedule
  isPending: boolean
  onClose: () => void
  onSave: (updates: { day_of_week: DayOfWeek; payload: DayPayload }[]) => void
  onApplyStandard: (restDays: DayOfWeek[]) => void
}) {
  const { member, isPending, onClose, onSave, onApplyStandard } = props
  const [state, setState] = useState<Record<DayOfWeek, DayPayload>>(() => {
    const init = {} as Record<DayOfWeek, DayPayload>
    for (const d of [0, 1, 2, 3, 4, 5, 6] as DayOfWeek[]) init[d] = defaultDayPayload(member.schedule, d)
    return init
  })

  function updateDay(d: DayOfWeek, partial: Partial<DayPayload>) {
    setState((prev) => ({ ...prev, [d]: { ...prev[d], ...partial } }))
  }

  function dayHours(d: DayOfWeek): number {
    const p = state[d]
    if (p.is_rest_day) return 0
    const h = (s: string | null, e: string | null) => {
      if (!s || !e) return 0
      const [sh, sm] = s.split(':').map(Number)
      const [eh, em] = e.split(':').map(Number)
      return (eh * 60 + em - (sh * 60 + sm)) / 60
    }
    return h(p.start_am, p.end_am) + h(p.start_pm, p.end_pm)
  }

  const totalWeek = DAYS_ORDER.reduce<number>((s, d) => s + dayHours(d), 0)

  function applyAllStandard() {
    const restDays = DAYS_ORDER.filter((d) => state[d].is_rest_day)
    onApplyStandard(restDays)
  }

  function save() {
    // Validation max 17h
    for (const d of DAYS_ORDER) {
      const p = state[d]
      for (const t of [p.end_am, p.end_pm]) {
        if (t && t > '17:00') {
          toast.error('Aucun horaire ne peut dépasser 17h00.')
          return
        }
      }
    }
    const updates = DAYS_ORDER.map((d) => ({ day_of_week: d, payload: state[d] }))
    onSave(updates)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-surface rounded-2xl border border-border max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-surface border-b border-border px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-primary" />
            <div>
              <h2 className="text-lg font-bold text-text">Horaires — {member.member.full_name || member.member.pseudo}</h2>
              <p className="text-xs text-muted">Total semaine : {Math.round(totalWeek * 100) / 100}h</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-lg hover:bg-surface-dark flex items-center justify-center transition-colors">
            <X className="w-5 h-5 text-muted" />
          </button>
        </div>

        <div className="p-6 space-y-3">
          {DAYS_ORDER.map((d) => {
            const p = state[d]
            const h = dayHours(d)
            return (
              <div key={d} className={`p-4 rounded-xl border ${p.is_rest_day ? 'border-border bg-surface-dark/40' : 'border-border bg-surface'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-text w-24">{['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'][d]}</span>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={p.is_rest_day}
                        onChange={(e) => updateDay(d, { is_rest_day: e.target.checked })}
                      />
                      <span className="text-sm text-muted">Jour de repos</span>
                    </label>
                  </div>
                  {!p.is_rest_day && <span className="text-sm font-semibold text-primary">{Math.round(h * 100) / 100}h</span>}
                </div>
                {!p.is_rest_day && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <TimeInput label="Début matin" value={p.start_am} onChange={(v) => updateDay(d, { start_am: v })} />
                    <TimeInput label="Fin matin" value={p.end_am} onChange={(v) => updateDay(d, { end_am: v })} />
                    <TimeInput label="Début aprem" value={p.start_pm} onChange={(v) => updateDay(d, { start_pm: v })} />
                    <TimeInput label="Fin aprem" value={p.end_pm} onChange={(v) => updateDay(d, { end_pm: v })} />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="sticky bottom-0 bg-surface border-t border-border px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={applyAllStandard}
            disabled={isPending}
            className="text-xs px-3 py-2 rounded-lg border border-border hover:bg-surface-dark transition-colors"
          >
            Appliquer 8-12 / 14-17 (avec les repos cochés)
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted hover:bg-surface-dark transition-colors">
              Annuler
            </button>
            <button
              onClick={save}
              disabled={isPending}
              className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              {isPending ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function TimeInput(props: { label: string; value: string | null; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted">{props.label}</span>
      <input
        type="time"
        step={900}
        value={props.value || ''}
        max="17:00"
        onChange={(e) => props.onChange(e.target.value)}
        className="px-3 py-2 rounded-lg border border-border bg-surface-dark/40 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
      />
    </label>
  )
}
