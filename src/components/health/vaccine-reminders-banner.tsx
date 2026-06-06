// components/health/vaccine-reminders-banner.tsx
//
// Affiché en haut de la fiche animal, ce bandeau récapitule les rappels
// de vaccin imminents et en retard, en se basant sur animal_health_records
// dont next_due_date est non-null.
//
// Ces dates sont remplies automatiquement lorsqu'une ligne de passage
// véto est validée avec un des 6 sous-types vaccin (cf.
// lib/health/vaccine-schedule.ts et lib/actions/vet-visits.ts).

import { AlertCircle, CalendarClock, CheckCircle2 } from 'lucide-react'
import type { AnimalHealthRecord } from '@/lib/types/database'
import { getReminderStatus } from '@/lib/health/vaccine-schedule'

interface Props {
  records: AnimalHealthRecord[]
}

interface UpcomingReminder {
  recordId: string
  date: string // ISO YYYY-MM-DD
  description: string | null
  status: 'overdue' | 'due_soon' | 'upcoming'
  daysFromNow: number
}

function buildUpcoming(records: AnimalHealthRecord[]): UpcomingReminder[] {
  const now = new Date()
  // On s'intéresse aux vaccins avec next_due_date renseigné. Pour éviter
  // les doublons (un animal a plusieurs vaccins, on garde le plus proche
  // dans le futur ou le plus en retard pour chaque acte).
  const out: UpcomingReminder[] = []
  for (const r of records) {
    if (r.type !== 'vaccination') continue
    if (!r.next_due_date) continue
    const due = new Date(r.next_due_date)
    const diffDays = Math.floor((due.getTime() - now.getTime()) / 86400000)
    // On ignore les rappels qui sont déjà couverts par un vaccin plus
    // récent (date >= next_due_date d'un autre record du même type).
    // L'égalité couvre le cas usuel : un rappel saisi exactement à la
    // date d'échéance théorique (ex. Orka — primo 02/03/2026 due le
    // 30/03/2026, rappel saisi pile le 30/03/2026 → l'alerte primo doit
    // s'éteindre, pas rester "en retard depuis 0 jour").
    const supersededBy = records.find(
      (other) =>
        other.id !== r.id &&
        other.type === 'vaccination' &&
        new Date(other.date) >= due,
    )
    if (supersededBy) continue
    out.push({
      recordId: r.id,
      date: r.next_due_date,
      description: r.description,
      status: getReminderStatus(r.next_due_date, now),
      daysFromNow: diffDays,
    })
  }
  // Trier : en retard d'abord (le plus en retard en haut), puis à venir
  out.sort((a, b) => a.daysFromNow - b.daysFromNow)
  return out
}

function formatRelative(days: number): string {
  if (days < 0) {
    const n = Math.abs(days)
    if (n === 0) return "aujourd'hui"
    if (n === 1) return 'depuis hier'
    return `en retard depuis ${n} jours`
  }
  if (days === 0) return "aujourd'hui"
  if (days === 1) return 'demain'
  if (days <= 7) return `dans ${days} jours`
  if (days <= 30) return `dans ${days} jours`
  const weeks = Math.round(days / 7)
  if (weeks <= 8) return `dans ${weeks} semaines`
  const months = Math.round(days / 30)
  return `dans ${months} mois`
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

export function VaccineRemindersBanner({ records }: Props) {
  const upcoming = buildUpcoming(records)

  // On affiche seulement les rappels overdue + due_soon (< 30j).
  // Les upcoming purs (> 30j) restent visibles dans l'onglet santé.
  const actionable = upcoming.filter(
    (r) => r.status === 'overdue' || r.status === 'due_soon',
  )

  if (actionable.length === 0) {
    // Pas d'alerte à montrer. On affiche une petite confirmation discrète
    // si on a au moins un rappel "upcoming" (vaccins à jour, prochain
    // rappel dans plus d'un mois).
    if (upcoming.length === 0) return null
    const next = upcoming[0]
    return (
      <div className="mb-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        <span>
          Vaccins à jour — prochain rappel{' '}
          <span className="font-medium">{formatRelative(next.daysFromNow)}</span> ({formatDate(next.date)})
        </span>
      </div>
    )
  }

  const hasOverdue = actionable.some((r) => r.status === 'overdue')
  const wrapperClass = hasOverdue
    ? 'bg-rose-500/10 border-rose-500/40 text-rose-700 dark:text-rose-300'
    : 'bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-300'
  const Icon = hasOverdue ? AlertCircle : CalendarClock

  return (
    <div className={`mb-4 px-4 py-3 rounded-xl border ${wrapperClass}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 shrink-0" />
        <span className="text-sm font-semibold uppercase tracking-wider">
          {hasOverdue ? 'Rappel vaccin en retard' : 'Rappel vaccin imminent'}
        </span>
      </div>
      <ul className="space-y-1 text-sm">
        {actionable.map((r) => (
          <li key={r.recordId} className="flex items-baseline gap-2 flex-wrap">
            <span className="font-medium">{r.description ?? 'Vaccin'}</span>
            <span className="opacity-80">— {formatRelative(r.daysFromNow)}</span>
            <span className="text-xs opacity-60">({formatDate(r.date)})</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
