'use client'

import { useEffect, useState, useTransition } from 'react'
import { AlertTriangle, ChevronLeft, ChevronRight, Users, BadgeCheck } from 'lucide-react'
import { getCoverageRange } from '@/lib/actions/leave-coverage'
import type { CoverageDay, CoverageRangeResult } from '@/lib/actions/leave-coverage'
import type { EstablishmentMember, LeaveType } from '@/lib/types/database'

const MONTH_NAMES = [
  'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre',
]
const WEEK_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

function toIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}
function memberLabel(m?: EstablishmentMember): string {
  if (!m) return 'Inconnu'
  return m.full_name || m.pseudo || m.email || 'Inconnu'
}
const CONTRACT_LABEL: Record<string, string> = {
  salarie: 'Salarie',
  auto_entrepreneur: 'Presta',
  benevole: 'Benevole',
  autre: 'Autre',
}

interface LeaveCoverageCalendarProps {
  readonly members: EstablishmentMember[]
  readonly leaveTypes: LeaveType[]
  readonly initialThreshold: number
}

export function LeaveCoverageCalendar({
  members,
  leaveTypes,
  initialThreshold,
}: LeaveCoverageCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState<Date>(() => startOfMonth(new Date()))
  const [includePending, setIncludePending] = useState(true)
  const [data, setData] = useState<CoverageRangeResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const memberMap = new Map(members.map((m) => [m.id, m]))
  const typeMap = new Map(leaveTypes.map((t) => [t.id, t]))
  const threshold = data?.threshold ?? initialThreshold

  useEffect(() => {
    const start = toIsoDate(startOfMonth(currentMonth))
    const end = toIsoDate(endOfMonth(currentMonth))
    setError(null)
    startTransition(async () => {
      const res = await getCoverageRange({ start_date: start, end_date: end })
      if (res.error) {
        setError(res.error)
        setData(null)
      } else if (res.data) {
        setData(res.data)
      }
    })
  }, [currentMonth])

  function shiftMonth(delta: number) {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + delta, 1))
    setSelectedDay(null)
  }
  function goToday() {
    setCurrentMonth(startOfMonth(new Date()))
    setSelectedDay(null)
  }

  // Build the calendar grid (leading empty cells from Monday)
  const first = startOfMonth(currentMonth)
  const leadingEmpty = (first.getDay() + 6) % 7 // monday-first
  const daysInMonth = endOfMonth(currentMonth).getDate()
  const cells: (CoverageDay | null)[] = []
  for (let i = 0; i < leadingEmpty; i++) cells.push(null)
  if (data) {
    for (const d of data.days) cells.push(d)
  } else {
    for (let i = 0; i < daysInMonth; i++) cells.push(null)
  }

  const selectedDayData = data?.days.find((d) => d.date === selectedDay) || null

  return (
    <div className="space-y-4">
      {/* Header / controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => shiftMonth(-1)}
            className="p-1.5 rounded-lg text-muted hover:text-text hover:bg-surface-dark transition-colors"
            aria-label="Mois precedent"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h2 className="text-base font-semibold text-text min-w-[180px] text-center">
            {MONTH_NAMES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </h2>
          <button
            onClick={() => shiftMonth(1)}
            className="p-1.5 rounded-lg text-muted hover:text-text hover:bg-surface-dark transition-colors"
            aria-label="Mois suivant"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={goToday}
            className="ml-2 px-2.5 py-1 rounded-lg text-xs font-semibold bg-surface-dark text-muted hover:text-text transition-colors"
          >
            Aujourd&apos;hui
          </button>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={includePending}
              onChange={(e) => setIncludePending(e.target.checked)}
              className="accent-primary"
            />
            Inclure les demandes en attente
          </label>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted">
            <BadgeCheck className="w-3.5 h-3.5" />
            Seuil minimum : <span className="font-semibold text-text">{threshold} salaries</span>
          </span>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 text-red-500 text-sm rounded-lg p-3 border border-red-500/20">
          {error}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/40" />
          Au-dessus du seuil
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500/40" />
          Au seuil
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-red-500/20 border border-red-500/40" />
          Sous le seuil
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" /> Salaries dispos / total sous contrat
        </span>
      </div>

      {/* Week header */}
      <div className="grid grid-cols-7 gap-1 text-[11px] font-semibold text-muted text-center">
        {WEEK_LABELS.map((w, i) => (
          <div key={i} className="py-1">{w}</div>
        ))}
      </div>

      {/* Grid */}
      <div className={`grid grid-cols-7 gap-1 ${isPending ? 'opacity-50' : ''}`}>
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="aspect-[5/4] rounded-lg bg-surface-dark/30" />
          const status = includePending ? d.status_with_pending : d.status_approved_only
          const pendingBlocking = includePending
            ? d.absent.filter((a) => a.reason === 'leave_pending').length
            : 0
          // "Dispo" = présents réels selon planning hebdo (exclut congés + repos hebdo).
          // Le filtre côté serveur dans getCoverageRange tient déjà compte des
          // restDayIds, donc on calcule simplement à partir de active_salaried
          // moins les absents (en repos hebdo si on inclut les pending) et moins
          // les repos hebdo.
          const restIds = new Set(d.members_on_rest_day)
          const avail = includePending
            ? d.active_salaried.filter(
                (id) => !d.absent.map((a) => a.member_id).includes(id) && !restIds.has(id)
              ).length
            : d.available_salaried_count
          const totalAvail = d.total_salaried_count
          const statusBg =
            status === 'below'
              ? 'bg-red-500/15 border-red-500/40 hover:bg-red-500/25'
              : status === 'tight'
                ? 'bg-amber-500/15 border-amber-500/40 hover:bg-amber-500/25'
                : 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20'
          const dayNum = parseInt(d.date.slice(-2), 10)
          const isSelected = selectedDay === d.date
          return (
            <button
              key={d.date}
              onClick={() => setSelectedDay(isSelected ? null : d.date)}
              className={`aspect-[5/4] rounded-lg border text-left p-1.5 transition-colors
                ${statusBg}
                ${d.is_weekend ? 'opacity-60' : ''}
                ${isSelected ? 'ring-2 ring-primary' : ''}
              `}
            >
              <div className="flex items-start justify-between">
                <span className="text-xs font-semibold text-text">{dayNum}</span>
                {status === 'below' && (
                  <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" />
                )}
              </div>
              <div className="mt-1.5 text-[10px] leading-tight text-text">
                <div className="font-semibold">
                  {avail}<span className="text-muted">/{totalAvail}</span>
                </div>
                {pendingBlocking > 0 && (
                  <div className="text-[9px] text-amber-500 font-semibold">
                    +{pendingBlocking} attente
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Selected day detail */}
      {selectedDayData && (
        <div className="bg-surface-dark/60 rounded-xl border border-border p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h3 className="text-sm font-bold text-text">
                Detail du {new Date(selectedDayData.date + 'T00:00:00').toLocaleDateString('fr-FR', {
                  weekday: 'long',
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </h3>
              <p className="text-xs text-muted mt-0.5">
                Salaries dispos : <span className="font-semibold text-text">
                  {(() => {
                    const restIdsDetail = new Set(selectedDayData.members_on_rest_day)
                    return includePending
                      ? selectedDayData.active_salaried.filter(
                          (id) => !selectedDayData.absent.map((a) => a.member_id).includes(id) && !restIdsDetail.has(id)
                        ).length
                      : selectedDayData.available_salaried_count
                  })()}
                </span> / seuil {selectedDayData.threshold}
              </p>
            </div>
            <button
              onClick={() => setSelectedDay(null)}
              className="text-muted hover:text-text text-xs"
            >
              Fermer
            </button>
          </div>

          {/* Présents — salariés uniquement, hors jour de repos hebdomadaire.
              Note : le ratio "4/7" affiché dans la grille reste basé sur l'effectif
              total sous contrat (logique RH historique). Cette section sert à voir
              concrètement QUI travaille ce jour selon planning, pour planifier
              autour des congés (ex : "lundi Matthieu est au repos hebdo mais
              pourrait venir si on change son planning"). */}
          <div className="space-y-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                Presents (selon planning)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(() => {
                  const absentIds = new Set(
                    selectedDayData.absent
                      .filter((a) => includePending || a.reason !== 'leave_pending')
                      .map((a) => a.member_id)
                  )
                  const restIds = new Set(selectedDayData.members_on_rest_day)
                  const presents = selectedDayData.active_salaried.filter(
                    (id) => !absentIds.has(id) && !restIds.has(id)
                  )
                  if (presents.length === 0) {
                    return <span className="text-xs text-muted italic">Aucun salarié programmé ce jour</span>
                  }
                  return presents.map((id) => {
                    const m = memberMap.get(id)
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      >
                        {memberLabel(m)}
                        {m?.contract_type && (
                          <span className="text-[9px] uppercase opacity-70">
                            {CONTRACT_LABEL[m.contract_type] ?? m.contract_type}
                          </span>
                        )}
                      </span>
                    )
                  })
                })()}
              </div>
            </div>

            {/* Au repos hebdo — membres dont la semaine type marque ce jour comme
                jour de repos. Bleu (≠ rouge absent congé) pour signaler que c'est
                un état "normal" et que ces personnes peuvent potentiellement venir
                en dépannage si nécessaire. */}
            {selectedDayData.members_on_rest_day.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                  Au repos hebdo
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedDayData.members_on_rest_day.map((id) => {
                    const m = memberMap.get(id)
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-sky-500/10 text-sky-400 border-sky-500/30"
                        title="Jour de repos selon la semaine type — peut éventuellement être sollicité"
                      >
                        {memberLabel(m)}
                        <span className="text-[9px] uppercase opacity-70">Repos</span>
                      </span>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Absents — salariés uniquement (cohérent avec la liste des présents). */}
            {(() => {
              const salariedAbsents = selectedDayData.absent.filter(
                (a) => memberMap.get(a.member_id)?.contract_type === 'salarie',
              )
              return (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                Absents
              </p>
              {salariedAbsents.length === 0 ? (
                <p className="text-xs text-muted italic">Aucun</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {salariedAbsents.map((a, idx) => {
                    const m = memberMap.get(a.member_id)
                    const lt = a.leave_type_id ? typeMap.get(a.leave_type_id) : null
                    const reasonLabel =
                      a.reason === 'extended_leave'
                        ? 'Arret long'
                        : a.reason === 'leave_approved'
                          ? lt?.name || 'Conge'
                          : `${lt?.name || 'Conge'} (en attente)`
                    const reasonClass =
                      a.reason === 'extended_leave'
                        ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                        : a.reason === 'leave_pending'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-red-500/10 text-red-400 border-red-500/30'
                    return (
                      <span
                        key={`${a.member_id}-${idx}`}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${reasonClass}`}
                      >
                        {memberLabel(m)}
                        <span className="text-[9px] uppercase opacity-70">{reasonLabel}</span>
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
