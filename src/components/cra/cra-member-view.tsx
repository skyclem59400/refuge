'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, AlertCircle, FileText, X, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import type { CraDay, CraMonthlyView, CraStatus } from '@/lib/types/database'
import { CRA_STATUS_LABELS } from '@/lib/types/database'
import { validateCraAsMember, requestCraChange } from '@/lib/actions/cra-saisie'

const MONTH_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

const STATUS_BADGE_CLASS: Record<CraStatus, string> = {
  draft: 'bg-gray-500/10 text-gray-300 border-gray-500/30',
  submitted: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
  validated_by_member: 'bg-teal-500/10 text-teal-300 border-teal-500/30',
  validated_by_admin: 'bg-green-500/10 text-green-300 border-green-500/30',
  change_requested: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
  sent: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
}

export function CraMemberView({ view }: { view: CraMonthlyView }) {
  const router = useRouter()
  const [changeOpen, setChangeOpen] = useState(false)
  const [comment, setComment] = useState('')
  const [isPending, startTransition] = useTransition()

  function validate() {
    if (!confirm('Valider ce CRA ? Vous confirmez que les heures saisies sont correctes.')) return
    startTransition(async () => {
      const r = await validateCraAsMember(view.member_id, view.year, view.month)
      if (r.error) toast.error(r.error)
      else {
        toast.success('CRA validé — il passe à l\'administrateur pour contrôle final.')
        router.refresh()
      }
    })
  }

  function requestChange() {
    if (comment.trim().length < 5) {
      toast.error('Merci de préciser ce qui doit être modifié.')
      return
    }
    startTransition(async () => {
      const r = await requestCraChange(view.member_id, view.year, view.month, comment.trim())
      if (r.error) toast.error(r.error)
      else {
        toast.success('Demande envoyée à Mary et à l\'administrateur.')
        setChangeOpen(false)
        setComment('')
        router.refresh()
      }
    })
  }

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-text">
              {MONTH_FR[view.month - 1]} {view.year}
            </h1>
            <p className="text-sm text-muted">Compte-rendu d&apos;activité — {view.member_name}</p>
          </div>
          <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${STATUS_BADGE_CLASS[view.status]}`}>
            {CRA_STATUS_LABELS[view.status]}
          </span>
        </div>
      </div>

      {/* Workflow indicator */}
      <WorkflowSteps status={view.status} />

      {/* Totaux */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Heures travaillées" value={`${view.total_worked_hours}h`} accent="primary" />
        <StatCard label="Heures de congé" value={`${view.total_leave_hours}h`} accent="orange" />
        <StatCard label="Jours de repos" value={String(view.total_rest_days)} accent="muted" />
        <StatCard label="Astreintes" value={`${view.astreinte_weeks.length} sem.`} accent="purple" />
      </div>

      {/* Détail astreintes */}
      {view.astreinte_weeks.length > 0 && (
        <div className="mb-6 p-4 rounded-xl border border-purple-500/20 bg-purple-500/5">
          <p className="text-xs uppercase tracking-wider text-purple-200 font-semibold mb-2">
            Vos semaines d&apos;astreinte ce mois
          </p>
          <div className="flex flex-wrap gap-2">
            {view.astreinte_weeks.map((w) => {
              const d = new Date(w + 'T00:00:00Z')
              return (
                <span
                  key={w}
                  className="px-3 py-1 rounded-full bg-purple-500/15 text-purple-100 text-xs font-semibold border border-purple-500/30"
                >
                  Sem. du {String(d.getUTCDate()).padStart(2, '0')}/{String(d.getUTCMonth() + 1).padStart(2, '0')}
                </span>
              )
            })}
          </div>
          <p className="text-[11px] text-muted mt-2 italic">
            Forfait hebdomadaire (lundi → lundi) — le montant est calculé par le comptable.
          </p>
        </div>
      )}

      {/* Grille */}
      <MonthGridReadonly view={view} />

      {/* Actions */}
      {view.status === 'submitted' && !changeOpen && (
        <div className="mt-6 p-5 rounded-2xl border border-border bg-surface flex flex-wrap items-center gap-3 justify-between">
          <div>
            <p className="font-semibold text-text mb-1">Vérifiez vos heures</p>
            <p className="text-sm text-muted">Si tout est correct, validez. Sinon, demandez une modification.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setChangeOpen(true)}
              className="px-4 py-2 rounded-lg border border-orange-500/30 bg-orange-500/10 text-orange-300 text-sm font-semibold hover:bg-orange-500/20 transition-colors flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4" />
              Demander une modification
            </button>
            <button
              onClick={validate}
              disabled={isPending}
              className="px-4 py-2 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-sm font-semibold hover:bg-emerald-500/20 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isPending ? 'Validation…' : 'Valider mon CRA'}
            </button>
          </div>
        </div>
      )}

      {/* Modal demande de modification */}
      {changeOpen && (
        <div className="mt-6 p-5 rounded-2xl border border-orange-500/40 bg-orange-500/5">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-orange-300" />
            <p className="font-semibold text-orange-100">Demander une modification</p>
          </div>
          <p className="text-sm text-muted mb-3">
            Précisez ce qui doit être corrigé. Mary sera notifiée, ainsi que l&apos;administrateur (Clément).
          </p>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="Ex : Le mardi 12 j'ai travaillé jusqu'à 17h, pas 16h."
            className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm focus:border-primary focus:ring-1 focus:ring-primary"
          />
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={requestChange}
              disabled={isPending || comment.trim().length < 5}
              className="px-4 py-2 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 text-orange-100 text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4" />
              {isPending ? 'Envoi…' : 'Envoyer ma demande'}
            </button>
            <button
              onClick={() => { setChangeOpen(false); setComment('') }}
              className="px-3 py-2 rounded-lg text-sm text-muted hover:bg-surface-dark transition-colors flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* États finaux */}
      {view.status === 'validated_by_member' && (
        <div className="mt-6 p-5 rounded-2xl border border-teal-500/30 bg-teal-500/5 text-teal-200">
          <p className="font-semibold mb-1 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            CRA validé de votre côté
          </p>
          <p className="text-sm">
            Le CRA est en attente de validation par l&apos;administrateur (Clément ou Céline) avant envoi au comptable.
          </p>
          {view.validated_at && (
            <p className="text-xs text-muted mt-2">
              Validé le {new Date(view.validated_at).toLocaleDateString('fr-FR')}.
            </p>
          )}
        </div>
      )}
      {view.status === 'validated_by_admin' && (
        <div className="mt-6 p-5 rounded-2xl border border-green-500/30 bg-green-500/5 text-green-200">
          <p className="font-semibold mb-1 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            Validé par l&apos;administrateur
          </p>
          <p className="text-sm">
            Le CRA peut maintenant être envoyé au comptable.
            {view.admin_validated_at && ` Validé admin le ${new Date(view.admin_validated_at).toLocaleDateString('fr-FR')}.`}
          </p>
        </div>
      )}
      {view.status === 'sent' && (
        <div className="mt-6 p-5 rounded-2xl border border-purple-500/30 bg-purple-500/5 text-purple-200">
          <p className="font-semibold mb-1">CRA envoyé au comptable</p>
          {view.sent_at && (
            <p className="text-sm">
              Envoyé le {new Date(view.sent_at).toLocaleDateString('fr-FR')}
              {view.sent_to ? ` à ${view.sent_to}` : ''}.
            </p>
          )}
        </div>
      )}
      {view.status === 'change_requested' && (
        <div className="mt-6 p-5 rounded-2xl border border-orange-500/30 bg-orange-500/5 text-orange-200">
          <p className="font-semibold mb-1">Demande de modification envoyée</p>
          <p className="text-sm">
            Mary est en train de corriger. Vous recevrez une notification quand ce sera prêt.
          </p>
          {view.change_request_comment && (
            <p className="text-xs mt-2 italic">Votre message : &laquo; {view.change_request_comment} &raquo;</p>
          )}
        </div>
      )}
    </>
  )
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: 'primary' | 'orange' | 'muted' | 'purple' }) {
  const cls =
    accent === 'primary' ? 'border-primary/30 bg-primary/5' :
    accent === 'orange'  ? 'border-orange-500/30 bg-orange-500/5' :
    accent === 'purple'  ? 'border-purple-500/30 bg-purple-500/5' :
    'border-border bg-surface-dark/40'
  return (
    <div className={`p-4 rounded-xl border ${cls}`}>
      <p className="text-xs text-muted mb-1">{label}</p>
      <p className="text-xl font-bold text-text">{value}</p>
    </div>
  )
}

function MonthGridReadonly({ view }: { view: CraMonthlyView }) {
  const first = new Date(view.year, view.month - 1, 1)
  const leadingEmpty = (first.getDay() + 6) % 7

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
        {cells.map((c, i) => <DayCellRO key={i} day={c} />)}
      </div>
    </div>
  )
}

function DayCellRO({ day }: { day: CraDay | null }) {
  if (!day) return <div className="aspect-square border-t border-l border-border bg-surface-dark/20" />

  const dayNum = parseInt(day.date.slice(-2), 10)
  let label = ''
  let bg = 'bg-surface'

  if (day.source === 'holiday') { label = day.holiday_name || 'Férié'; bg = 'bg-orange-500/10' }
  else if (day.source === 'extended_leave') { label = 'Arrêt long'; bg = 'bg-purple-500/10' }
  else if (day.source === 'leave') { label = day.leave_label || 'Congé'; bg = 'bg-violet-500/10' }
  else if (day.is_rest_day) { label = 'Repos'; bg = 'bg-surface-dark/40' }
  else { label = `${day.hours_total}h`; bg = 'bg-emerald-500/5' }

  return (
    <div className={`aspect-square min-h-[70px] border-t border-l border-border p-2 ${bg}`}>
      <div className="text-xs font-bold text-text mb-1">{dayNum}</div>
      <div className={`text-[10px] leading-tight ${day.is_rest_day ? 'text-muted italic' : 'text-text/80'}`}>
        {label}
      </div>
      {!day.is_rest_day && day.source !== 'leave' && day.source !== 'holiday' && day.start_am && (
        <div className="text-[9px] text-muted mt-1">
          {day.start_am.slice(0, 5)}-{day.end_am?.slice(0, 5)}
          {day.start_pm && <><br />{day.start_pm.slice(0, 5)}-{day.end_pm?.slice(0, 5)}</>}
        </div>
      )}
    </div>
  )
}

function WorkflowSteps({ status }: { status: CraStatus }) {
  const steps: { key: CraStatus[]; label: string }[] = [
    { key: ['draft'], label: 'Saisie' },
    { key: ['submitted'], label: 'Validation collab.' },
    { key: ['validated_by_member'], label: 'Validation admin' },
    { key: ['validated_by_admin'], label: 'Prêt envoi' },
    { key: ['sent'], label: 'Envoyé comptable' },
  ]
  const currentIdx = steps.findIndex((s) => s.key.includes(status))
  const isChange = status === 'change_requested'

  return (
    <div className="mb-6 p-4 rounded-xl border border-border bg-surface">
      <div className="flex items-center gap-2 text-xs">
        {steps.map((s, i) => {
          const reached = !isChange && currentIdx >= i
          return (
            <div key={s.label} className="flex items-center gap-2 flex-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                reached ? 'bg-primary text-white' : 'bg-surface-dark text-muted'
              }`}>{i + 1}</div>
              <span className={reached ? 'text-text font-semibold' : 'text-muted'}>{s.label}</span>
              {i < steps.length - 1 && <div className={`flex-1 h-px ${reached ? 'bg-primary/40' : 'bg-border'}`} />}
            </div>
          )
        })}
      </div>
      {isChange && (
        <p className="mt-3 text-xs text-orange-300">⚠ Une demande de modification est en cours, le workflow reprendra après correction par Mary.</p>
      )}
    </div>
  )
}
