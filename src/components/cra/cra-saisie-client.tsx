'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Send, CheckCircle2, AlertCircle, Mail, ShieldCheck, Shield } from 'lucide-react'
import { toast } from 'sonner'
import type { CraDay, CraMonthlyView, CraStatus } from '@/lib/types/database'
import { CRA_STATUS_LABELS } from '@/lib/types/database'
import { submitCraToMember, resolveChangeRequest, validateCraAsAdmin } from '@/lib/actions/cra-saisie'
import { CraDayEditModal } from '@/components/cra/cra-day-edit-modal'
import { sendCraToAccountant } from '@/lib/actions/cra-send'
import { toggleAstreinteWeek } from '@/lib/actions/cra-astreintes'

const MONTH_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

interface MemberLite {
  id: string
  label: string
  contract_type: string
}

interface Props {
  members: MemberLite[]
  initialMemberId: string
  year: number
  month: number
  view: CraMonthlyView | null
  isAdmin: boolean
}

const STATUS_BADGE_CLASS: Record<CraStatus, string> = {
  draft: 'bg-gray-500/10 text-gray-300 border-gray-500/30',
  submitted: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
  validated_by_member: 'bg-teal-500/10 text-teal-300 border-teal-500/30',
  validated_by_admin: 'bg-green-500/10 text-green-300 border-green-500/30',
  change_requested: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
  sent: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
}

export function CraSaisieClient({ members, initialMemberId, year, month, view, isAdmin }: Props) {
  const router = useRouter()
  const [selectedDay, setSelectedDay] = useState<CraDay | null>(null)
  const [isPending, startTransition] = useTransition()

  function navigate(nextMember: string, nextYear: number, nextMonth: number) {
    const params = new URLSearchParams()
    params.set('member', nextMember)
    params.set('year', String(nextYear))
    params.set('month', String(nextMonth))
    router.push(`/admin/cra/saisie?${params.toString()}`)
  }

  function prevMonth() {
    let y = year, m = month - 1
    if (m < 1) { m = 12; y -= 1 }
    navigate(view?.member_id || initialMemberId, y, m)
  }
  function nextMonth() {
    let y = year, m = month + 1
    if (m > 12) { m = 1; y += 1 }
    navigate(view?.member_id || initialMemberId, y, m)
  }

  function handleSubmitToMember() {
    if (!view) return
    if (!confirm(`Soumettre le CRA de ${view.member_name} pour ${MONTH_FR[month - 1]} ${year} ?`)) return
    startTransition(async () => {
      const r = await submitCraToMember(view.member_id, year, month)
      if (r.error) toast.error(r.error)
      else {
        toast.success('CRA soumis au collaborateur')
        router.refresh()
      }
    })
  }

  function handleSendToAccountant() {
    if (!view) return
    if (!confirm(`Envoyer le CRA validé au comptable ?`)) return
    startTransition(async () => {
      const r = await sendCraToAccountant(view.member_id, year, month)
      if (r.error) toast.error(r.error)
      else {
        toast.success('CRA envoyé au comptable')
        router.refresh()
      }
    })
  }

  function handleAdminValidate() {
    if (!view) return
    if (!confirm(`Valider ce CRA en tant qu'administrateur ?\nUne fois validé, il pourra être envoyé au comptable.`)) return
    startTransition(async () => {
      const r = await validateCraAsAdmin(view.member_id, year, month)
      if (r.error) toast.error(r.error)
      else {
        toast.success('CRA validé en tant qu\'administrateur')
        router.refresh()
      }
    })
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-6 p-4 rounded-xl border border-border bg-surface">
        <select
          value={initialMemberId}
          onChange={(e) => navigate(e.target.value, year, month)}
          className="px-3 py-2 rounded-lg border border-border bg-surface-dark/40 text-sm focus:border-primary focus:ring-1 focus:ring-primary min-w-[200px]"
        >
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>

        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="w-9 h-9 rounded-lg border border-border hover:bg-surface-dark flex items-center justify-center">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="px-3 py-2 text-sm font-semibold min-w-[140px] text-center">
            {MONTH_FR[month - 1]} {year}
          </div>
          <button onClick={nextMonth} className="w-9 h-9 rounded-lg border border-border hover:bg-surface-dark flex items-center justify-center">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {view && (
          <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${STATUS_BADGE_CLASS[view.status]}`}>
            {CRA_STATUS_LABELS[view.status]}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {view?.status === 'draft' && (
            <button
              onClick={handleSubmitToMember}
              disabled={isPending}
              className="px-4 py-2 rounded-lg bg-blue-500/10 text-blue-300 border border-blue-500/30 text-sm font-semibold hover:bg-blue-500/20 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              Soumettre au collaborateur
            </button>
          )}
          {view?.status === 'validated_by_member' && isAdmin && (
            <button
              onClick={handleAdminValidate}
              disabled={isPending}
              className="px-4 py-2 rounded-lg bg-green-500/10 text-green-300 border border-green-500/30 text-sm font-semibold hover:bg-green-500/20 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" />
              Valider en tant qu&apos;admin
            </button>
          )}
          {view?.status === 'validated_by_member' && !isAdmin && (
            <span className="px-3 py-1.5 rounded-lg bg-teal-500/10 text-teal-300 text-xs border border-teal-500/30">
              En attente de validation admin (Clément/Céline)
            </span>
          )}
          {view?.status === 'validated_by_admin' && (
            <button
              onClick={handleSendToAccountant}
              disabled={isPending}
              className="px-4 py-2 rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/30 text-sm font-semibold hover:bg-purple-500/20 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Mail className="w-4 h-4" />
              Envoyer au comptable
            </button>
          )}
        </div>
      </div>

      {/* Banner demande de modification */}
      {view?.status === 'change_requested' && view.change_request_comment && (
        <ChangeRequestBanner
          memberId={view.member_id}
          year={year}
          month={month}
          comment={view.change_request_comment}
          onResolved={() => router.refresh()}
        />
      )}

      {/* Totaux */}
      {view && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <StatCard label="Heures travaillées" value={`${view.total_worked_hours}h`} accent="primary" />
          <StatCard label="Heures de congé" value={`${view.total_leave_hours}h`} accent="orange" />
          <StatCard label="Jours de repos" value={String(view.total_rest_days)} accent="muted" />
          <StatCard label="Astreintes" value={`${view.astreinte_weeks.length} sem.`} accent="purple" />
          <StatCard label="Statut" value={CRA_STATUS_LABELS[view.status]} accent="default" />
        </div>
      )}

      {/* Bandeau Astreintes */}
      {view && (
        <AstreintesBar
          view={view}
          locked={view.status === 'sent' || view.status === 'validated_by_admin'}
          onChanged={() => router.refresh()}
        />
      )}

      {/* Grille mensuelle */}
      {view && <MonthGrid view={view} onDayClick={(day) => view.status === 'sent' ? null : setSelectedDay(day)} />}

      {selectedDay && view && (
        <CraDayEditModal
          memberId={view.member_id}
          day={selectedDay}
          onClose={() => setSelectedDay(null)}
          onSaved={() => {
            setSelectedDay(null)
            router.refresh()
          }}
        />
      )}
    </>
  )
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: 'primary' | 'orange' | 'muted' | 'purple' | 'default' }) {
  const cls =
    accent === 'primary' ? 'border-primary/30 bg-primary/5' :
    accent === 'orange'  ? 'border-orange-500/30 bg-orange-500/5' :
    accent === 'muted'   ? 'border-border bg-surface-dark/40' :
    accent === 'purple'  ? 'border-purple-500/30 bg-purple-500/5' :
    'border-border bg-surface'
  return (
    <div className={`p-4 rounded-xl border ${cls}`}>
      <p className="text-xs text-muted mb-1">{label}</p>
      <p className="text-xl font-bold text-text">{value}</p>
    </div>
  )
}

/** Bandeau de gestion des semaines d'astreinte du mois affiché.
 * Une chip par lundi du mois. Cliquer active/désactive l'astreinte pour le membre courant. */
function AstreintesBar({
  view,
  locked,
  onChanged,
}: {
  view: CraMonthlyView
  locked: boolean
  onChanged: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [pendingWeek, setPendingWeek] = useState<string | null>(null)

  // Lister les lundis du mois affiché
  const mondays: string[] = []
  for (const day of view.days) {
    if (day.weekday === 1) mondays.push(day.date)
  }
  if (mondays.length === 0) return null

  const activeSet = new Set(view.astreinte_weeks)

  function handleToggle(weekStart: string) {
    if (locked) return
    setPendingWeek(weekStart)
    startTransition(async () => {
      const r = await toggleAstreinteWeek(view.member_id, weekStart)
      setPendingWeek(null)
      if (r.error) {
        toast.error(r.error)
        return
      }
      if (r.data?.created) toast.success('Semaine d\'astreinte ajoutée')
      else if (r.data?.deleted) toast.success('Semaine d\'astreinte retirée')
      onChanged()
    })
  }

  return (
    <div className="mb-6 p-4 rounded-xl border border-purple-500/20 bg-purple-500/5">
      <div className="flex items-center gap-2 mb-3">
        <Shield className="w-4 h-4 text-purple-300" />
        <p className="text-sm font-semibold text-text">Astreintes du mois</p>
        <p className="text-xs text-muted">— forfait hebdo (lundi → lundi) géré par le comptable</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {mondays.map((m) => {
          const active = activeSet.has(m)
          const isPendingThis = pending && pendingWeek === m
          const d = new Date(m + 'T00:00:00Z')
          const label = `Sem. du ${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`
          return (
            <button
              key={m}
              onClick={() => handleToggle(m)}
              disabled={locked || pending}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors disabled:opacity-50 ${
                active
                  ? 'bg-purple-500/20 text-purple-200 border-purple-500/40 hover:bg-purple-500/30'
                  : 'bg-surface text-muted border-border hover:bg-surface-dark/40'
              }`}
            >
              {isPendingThis ? '…' : `${active ? '✓ ' : '+ '}${label}`}
            </button>
          )
        })}
      </div>
      {locked && (
        <p className="text-[11px] text-muted mt-2 italic">
          CRA validé/envoyé — les astreintes ne peuvent plus être modifiées.
        </p>
      )}
    </div>
  )
}

function MonthGrid({ view, onDayClick }: { view: CraMonthlyView; onDayClick: (d: CraDay) => void }) {
  const first = new Date(view.year, view.month - 1, 1)
  const leadingEmpty = (first.getDay() + 6) % 7 // ISO : lundi premier

  const cells: (CraDay | null)[] = []
  for (let i = 0; i < leadingEmpty; i++) cells.push(null)
  for (const d of view.days) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <div className="grid grid-cols-7 bg-surface-dark/40 text-xs uppercase text-muted">
        {['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map((d) => (
          <div key={d} className="px-2 py-2 text-center font-semibold">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((c, i) => (
          <DayCell key={i} day={c} onClick={onDayClick} />
        ))}
      </div>
    </div>
  )
}

function DayCell({ day, onClick }: { day: CraDay | null; onClick: (d: CraDay) => void }) {
  if (!day) return <div className="aspect-square border-t border-l border-border bg-surface-dark/20" />

  const dayNum = parseInt(day.date.slice(-2), 10)
  const isWeekend = day.weekday === 0 || day.weekday === 6

  let label = ''
  let bg = 'bg-surface'
  let ring = 'border-border'

  if (day.source === 'holiday') {
    label = day.holiday_name || 'Férié'
    bg = 'bg-orange-500/10'
    ring = 'border-orange-500/30'
  } else if (day.source === 'extended_leave') {
    label = 'Arrêt long'
    bg = 'bg-purple-500/10'
    ring = 'border-purple-500/30'
  } else if (day.source === 'leave') {
    label = day.leave_label || 'Congé'
    bg = day.leave_status === 'pending' ? 'bg-orange-500/10' : 'bg-violet-500/10'
    ring = day.leave_status === 'pending' ? 'border-orange-500/30' : 'border-violet-500/30'
  } else if (day.is_rest_day) {
    label = 'Repos'
    bg = 'bg-surface-dark/40'
  } else if (day.source === 'override') {
    label = `${day.hours_total}h`
    bg = 'bg-blue-500/10'
    ring = 'border-blue-500/30'
  } else {
    label = `${day.hours_total}h`
    bg = day.hours_total > 0 ? 'bg-emerald-500/5' : 'bg-surface'
  }

  return (
    <button
      onClick={() => onClick(day)}
      className={`aspect-square min-h-[80px] border-t border-l border-border p-2 text-left transition-colors hover:bg-surface-dark/30 ${bg} ${isWeekend ? 'opacity-90' : ''}`}
    >
      <div className="text-xs font-bold text-text mb-1">{dayNum}</div>
      <div className={`text-[10px] leading-tight ${day.is_rest_day ? 'text-muted italic' : 'text-text/80'}`}>
        {label}
      </div>
      {!day.is_rest_day && day.source !== 'leave' && day.source !== 'holiday' && day.source !== 'extended_leave' && day.start_am && (
        <div className="text-[9px] text-muted mt-1">
          {day.start_am.slice(0, 5)}-{day.end_am?.slice(0, 5)}
          {day.start_pm && <><br />{day.start_pm.slice(0, 5)}-{day.end_pm?.slice(0, 5)}</>}
        </div>
      )}
      {day.source === 'override' && (
        <div className="text-[9px] text-blue-300 mt-1">● modifié</div>
      )}
    </button>
  )
}

function ChangeRequestBanner(props: {
  memberId: string
  year: number
  month: number
  comment: string
  onResolved: () => void
}) {
  const [notes, setNotes] = useState('')
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function resolve() {
    if (!confirm('Marquer cette demande comme prise en compte ? Le mois repassera en brouillon.')) return
    startTransition(async () => {
      // On a besoin du changeRequestId — récupéré dynamiquement via une action dédiée
      const res = await fetch(`/api/cra/change-request/latest?member=${props.memberId}&year=${props.year}&month=${props.month}`)
      const json = await res.json()
      if (!json.id) { toast.error('Demande introuvable'); return }
      const r = await resolveChangeRequest(json.id, notes || 'Pris en compte')
      if (r.error) toast.error(r.error)
      else {
        toast.success('Demande résolue, vous pouvez modifier le mois.')
        props.onResolved()
      }
    })
  }

  return (
    <div className="mb-6 p-4 rounded-xl border border-orange-500/40 bg-orange-500/10">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-orange-300 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="font-semibold text-orange-100 mb-1">Demande de modification du collaborateur</p>
          <p className="text-sm text-orange-200/90 mb-3">{props.comment}</p>
          {!open ? (
            <button
              onClick={() => setOpen(true)}
              className="text-xs px-3 py-1.5 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 text-orange-100 transition-colors font-semibold"
            >
              Marquer comme pris en compte
            </button>
          ) : (
            <div className="space-y-2">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Note interne (optionnelle) : ce que vous avez modifié"
                className="w-full px-3 py-2 rounded-lg border border-orange-500/30 bg-surface-dark/60 text-sm"
                rows={2}
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={resolve}
                  disabled={isPending}
                  className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-100 font-semibold flex items-center gap-1 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  Confirmer
                </button>
                <button onClick={() => setOpen(false)} className="text-xs text-muted hover:text-text">
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
