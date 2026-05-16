'use client'

import { useState, useTransition } from 'react'
import { CalendarCog, Check, Loader2, AlertCircle } from 'lucide-react'
import {
  DEFAULT_ADOPTION_APPOINTMENT_SETTINGS,
  type AdoptionAppointmentSettings,
  type WeekDayKey,
} from '@/lib/types/database'
import { updateAdoptionAppointmentSettings } from '@/lib/actions/adoption-appointments'

interface Member {
  user_id: string
  full_name?: string | null
  pseudo: string | null
  email?: string
}

interface Props {
  initial: AdoptionAppointmentSettings
  members: Member[]
}

const DAY_LABELS: Record<WeekDayKey, string> = {
  mon: 'Lundi',
  tue: 'Mardi',
  wed: 'Mercredi',
  thu: 'Jeudi',
  fri: 'Vendredi',
  sat: 'Samedi',
  sun: 'Dimanche',
}

const DAYS_ORDER: WeekDayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

function memberLabel(m: Member): string {
  return m.full_name || m.pseudo || m.email || m.user_id
}

export function AdoptionAppointmentSettingsForm({ initial, members }: Props) {
  const [settings, setSettings] = useState<AdoptionAppointmentSettings>({
    ...DEFAULT_ADOPTION_APPOINTMENT_SETTINGS,
    ...initial,
  })
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  function toggleUser(userId: string) {
    setSettings((prev) => ({
      ...prev,
      allowed_user_ids: prev.allowed_user_ids.includes(userId)
        ? prev.allowed_user_ids.filter((u) => u !== userId)
        : [...prev.allowed_user_ids, userId],
    }))
  }

  function toggleDayOpen(day: WeekDayKey, open: boolean) {
    setSettings((prev) => ({
      ...prev,
      opening_hours: {
        ...prev.opening_hours,
        [day]: open ? [{ start: '14:00', end: '17:00' }] : [],
      },
    }))
  }

  function updateDayRange(day: WeekDayKey, field: 'start' | 'end', value: string) {
    setSettings((prev) => {
      const ranges = prev.opening_hours[day]
      if (ranges.length === 0) return prev
      const first = { ...ranges[0], [field]: value }
      return {
        ...prev,
        opening_hours: { ...prev.opening_hours, [day]: [first, ...ranges.slice(1)] },
      }
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFeedback(null)
    startTransition(async () => {
      const res = await updateAdoptionAppointmentSettings(settings)
      if (res?.error) setFeedback({ kind: 'error', msg: res.error })
      else setFeedback({ kind: 'success', msg: 'Paramétrage enregistré.' })
    })
  }

  const slotsPreviewPerDay = previewSlotsCount(settings)

  return (
    <form onSubmit={handleSubmit} className="bg-surface rounded-xl border border-border p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <CalendarCog className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold">Prise de RDV adoption (portail public)</h2>
          <p className="text-sm text-muted">
            Configurez qui peut recevoir les demandes de RDV adoption et les créneaux d'ouverture.
          </p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
            className="w-4 h-4 accent-primary"
          />
          <span className="text-sm font-medium">{settings.enabled ? 'Activé' : 'Désactivé'}</span>
        </label>
      </div>

      {/* Collaborateurs habilités */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Collaborateurs habilités à recevoir un RDV adoption</h3>
        <p className="text-xs text-muted mb-3">
          Au moins un de ces collaborateurs doit être planifié sur le créneau pour qu'il soit proposé au public.
        </p>
        {members.length === 0 ? (
          <p className="text-sm text-muted italic">Aucun membre disponible.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {members.map((m) => {
              const checked = settings.allowed_user_ids.includes(m.user_id)
              return (
                <label
                  key={m.user_id}
                  className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                    checked ? 'bg-primary/10 border-primary' : 'bg-surface-hover border-border hover:border-primary/40'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleUser(m.user_id)}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-sm">{memberLabel(m)}</span>
                </label>
              )
            })}
          </div>
        )}
      </div>

      {/* Horaires */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Horaires d'ouverture aux RDV</h3>
        <div className="space-y-2">
          {DAYS_ORDER.map((day) => {
            const ranges = settings.opening_hours[day]
            const isOpen = ranges.length > 0
            const first = ranges[0]
            return (
              <div
                key={day}
                className="flex items-center gap-3 p-3 bg-surface-hover rounded-lg border border-border"
              >
                <label className="flex items-center gap-2 w-28">
                  <input
                    type="checkbox"
                    checked={isOpen}
                    onChange={(e) => toggleDayOpen(day, e.target.checked)}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-sm font-medium">{DAY_LABELS[day]}</span>
                </label>
                {isOpen ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="time"
                      value={first.start}
                      step="900"
                      onChange={(e) => updateDayRange(day, 'start', e.target.value)}
                      className="bg-surface border border-border rounded px-2 py-1 text-sm"
                    />
                    <span className="text-muted">→</span>
                    <input
                      type="time"
                      value={first.end}
                      step="900"
                      onChange={(e) => updateDayRange(day, 'end', e.target.value)}
                      className="bg-surface border border-border rounded px-2 py-1 text-sm"
                    />
                    <span className="text-xs text-muted ml-auto">
                      {slotsPreviewPerDay[day]} créneau{slotsPreviewPerDay[day] > 1 ? 'x' : ''}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-muted italic">Fermé</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Paramètres avancés */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Durée d'un créneau (min)</label>
          <input
            type="number"
            min={15}
            max={240}
            step={15}
            value={settings.slot_duration_minutes}
            onChange={(e) => setSettings({ ...settings, slot_duration_minutes: Number(e.target.value) })}
            className="w-full bg-surface border border-border rounded px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">RDV au plus tôt (J+)</label>
          <input
            type="number"
            min={0}
            max={60}
            value={settings.min_advance_days}
            onChange={(e) => setSettings({ ...settings, min_advance_days: Number(e.target.value) })}
            className="w-full bg-surface border border-border rounded px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">RDV au plus tard (J+)</label>
          <input
            type="number"
            min={1}
            max={180}
            value={settings.max_advance_days}
            onChange={(e) => setSettings({ ...settings, max_advance_days: Number(e.target.value) })}
            className="w-full bg-surface border border-border rounded px-2 py-1 text-sm"
          />
        </div>
      </div>

      {/* Jours fermés */}
      <div>
        <label className="block text-xs font-medium text-muted mb-1">
          Jours fermés ponctuels (ex : jours fériés) — 1 date par ligne, format YYYY-MM-DD
        </label>
        <textarea
          rows={3}
          value={settings.closed_dates.join('\n')}
          onChange={(e) =>
            setSettings({
              ...settings,
              closed_dates: e.target.value
                .split('\n')
                .map((s) => s.trim())
                .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s)),
            })
          }
          className="w-full bg-surface border border-border rounded px-2 py-1 text-sm font-mono"
          placeholder="2026-12-25&#10;2026-12-26&#10;2027-01-01"
        />
      </div>

      {feedback && (
        <div
          className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
            feedback.kind === 'success'
              ? 'bg-success/10 text-success border border-success/20'
              : 'bg-destructive/10 text-destructive border border-destructive/20'
          }`}
        >
          {feedback.kind === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {feedback.msg}
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
        <a
          href="/planning/disponibilites"
          className="text-sm text-primary hover:underline"
        >
          Voir les créneaux générés →
        </a>
        <button
          type="submit"
          disabled={isPending}
          className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
        >
          {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          Enregistrer
        </button>
      </div>
    </form>
  )
}

function previewSlotsCount(s: AdoptionAppointmentSettings): Record<WeekDayKey, number> {
  const out = {} as Record<WeekDayKey, number>
  for (const day of DAYS_ORDER) {
    let count = 0
    for (const r of s.opening_hours[day]) {
      const [sh, sm] = r.start.split(':').map(Number)
      const [eh, em] = r.end.split(':').map(Number)
      const duration = eh * 60 + em - (sh * 60 + sm)
      if (duration > 0 && s.slot_duration_minutes > 0) {
        count += Math.floor(duration / s.slot_duration_minutes)
      }
    }
    out[day] = count
  }
  return out
}
