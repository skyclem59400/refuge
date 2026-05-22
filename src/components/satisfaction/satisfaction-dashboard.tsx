'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, RotateCcw, Mail, Clock } from 'lucide-react'
import { resolveSurvey, unresolveSurvey } from '@/lib/actions/satisfaction'
import { SATISFACTION_KIND_LABELS, npsBucketOf } from '@/lib/types/database'
import type { SatisfactionSurvey, SatisfactionSurveyKind } from '@/lib/types/database'

interface DashboardStats {
  total_completed: number
  total_sent: number
  nps: number | null
  promoter_pct: number
  passive_pct: number
  detractor_pct: number
  avg_score: number | null
}

interface Props {
  initialStats: DashboardStats | null
  initialSurveys: SatisfactionSurvey[]
}

type FilterKind = 'all' | SatisfactionSurveyKind
type FilterStatus = 'all' | 'completed' | 'pending' | 'unresolved'

export function SatisfactionDashboard({ initialStats, initialSurveys }: Props) {
  const [filterKind, setFilterKind] = useState<FilterKind>('all')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('completed')
  const [surveys] = useState<SatisfactionSurvey[]>(initialSurveys)
  const stats = initialStats

  const filtered = surveys.filter((s) => {
    if (filterKind !== 'all' && s.kind !== filterKind) return false
    if (filterStatus === 'completed' && !s.completed_at) return false
    if (filterStatus === 'pending' && s.completed_at) return false
    if (filterStatus === 'unresolved' && (!s.completed_at || s.resolved_at)) return false
    return true
  })

  return (
    <>
      {/* Stats KPI */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <KpiCard
            label="Score NPS"
            value={stats.nps !== null ? String(stats.nps) : '—'}
            subline={
              stats.nps === null
                ? 'Pas encore de retour'
                : stats.nps >= 50 ? 'Excellent' : stats.nps >= 0 ? 'Correct' : 'À améliorer'
            }
            accent={stats.nps === null ? 'muted' : stats.nps >= 50 ? 'emerald' : stats.nps >= 0 ? 'teal' : 'orange'}
          />
          <KpiCard
            label="Note moyenne"
            value={stats.avg_score !== null ? `${stats.avg_score} / 10` : '—'}
            accent="teal"
          />
          <KpiCard
            label="Promoteurs (9-10)"
            value={`${stats.promoter_pct}%`}
            accent="emerald"
          />
          <KpiCard
            label="Détracteurs (0-6)"
            value={`${stats.detractor_pct}%`}
            accent="orange"
          />
          <KpiCard
            label="Taux de réponse"
            value={
              stats.total_sent > 0
                ? `${Math.round((stats.total_completed / stats.total_sent) * 100)}%`
                : '—'
            }
            subline={`${stats.total_completed} / ${stats.total_sent} envois`}
            accent="primary"
          />
        </div>
      )}

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <FilterPill
          options={[
            { value: 'all', label: 'Tous types' },
            { value: 'adoption', label: 'Adoptions' },
            { value: 'donation', label: 'Dons' },
            { value: 'foster', label: 'Familles d\'accueil' },
          ]}
          value={filterKind}
          onChange={(v) => setFilterKind(v as FilterKind)}
        />
        <FilterPill
          options={[
            { value: 'completed', label: 'Avec réponse' },
            { value: 'unresolved', label: 'À traiter' },
            { value: 'pending', label: 'En attente' },
            { value: 'all', label: 'Tous' },
          ]}
          value={filterStatus}
          onChange={(v) => setFilterStatus(v as FilterStatus)}
        />
      </div>

      {/* Liste */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted text-sm">
            Aucune enquête ne correspond à ces filtres.
          </div>
        ) : (
          filtered.map((s) => <SurveyRow key={s.id} survey={s} />)
        )}
      </div>
    </>
  )
}

function KpiCard({
  label,
  value,
  subline,
  accent,
}: {
  label: string
  value: string
  subline?: string
  accent: 'primary' | 'teal' | 'emerald' | 'orange' | 'muted'
}) {
  const cls =
    accent === 'primary' ? 'border-primary/30 bg-primary/5' :
    accent === 'teal' ? 'border-teal-500/30 bg-teal-500/5' :
    accent === 'emerald' ? 'border-emerald-500/30 bg-emerald-500/5' :
    accent === 'orange' ? 'border-orange-500/30 bg-orange-500/5' :
    'border-border bg-surface-dark/30'
  return (
    <div className={`p-4 rounded-xl border ${cls}`}>
      <p className="text-[10px] uppercase tracking-wider text-muted/70 font-semibold mb-1">{label}</p>
      <p className="text-2xl font-bold text-text">{value}</p>
      {subline && <p className="text-[11px] text-muted mt-1">{subline}</p>}
    </div>
  )
}

function FilterPill({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-surface overflow-hidden">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
            value === opt.value
              ? 'bg-primary/15 text-primary-light'
              : 'text-muted hover:text-text hover:bg-surface-hover'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function SurveyRow({ survey }: { survey: SatisfactionSurvey }) {
  const [resolveOpen, setResolveOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const [isPending, startTransition] = useTransition()

  const bucket = npsBucketOf(survey.nps_score)
  const bucketColor = bucket === 'promoter' ? 'emerald' : bucket === 'passive' ? 'yellow' : bucket === 'detractor' ? 'orange' : 'muted'

  function handleResolve() {
    startTransition(async () => {
      const res = await resolveSurvey(survey.id, notes)
      if (res.error) toast.error(res.error)
      else {
        toast.success('Marqué comme traité')
        setResolveOpen(false)
        window.location.reload()
      }
    })
  }

  function handleUnresolve() {
    startTransition(async () => {
      const res = await unresolveSurvey(survey.id)
      if (res.error) toast.error(res.error)
      else {
        toast.success('Ré-ouvert')
        window.location.reload()
      }
    })
  }

  return (
    <div className={`rounded-xl border bg-surface p-4 ${survey.resolved_at ? 'opacity-70' : ''} ${
      bucket === 'detractor' && !survey.resolved_at ? 'border-orange-500/40' : 'border-border'
    }`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-surface-dark text-muted">
            {SATISFACTION_KIND_LABELS[survey.kind]}
          </span>
          {survey.nps_score !== null && (
            <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
              bucketColor === 'emerald' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' :
              bucketColor === 'yellow' ? 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30' :
              bucketColor === 'orange' ? 'bg-orange-500/10 text-orange-300 border-orange-500/30' :
              'bg-surface-dark text-muted border-border'
            }`}>
              {survey.nps_score} / 10
            </span>
          )}
          {!survey.completed_at && survey.sent_at && (
            <span className="text-[11px] text-muted flex items-center gap-1">
              <Mail className="w-3 h-3" /> envoyé le {new Date(survey.sent_at).toLocaleDateString('fr-FR')}
            </span>
          )}
          {!survey.sent_at && (
            <span className="text-[11px] text-muted flex items-center gap-1">
              <Clock className="w-3 h-3" /> en attente d&apos;envoi
            </span>
          )}
          {survey.resolved_at && (
            <span className="text-[11px] text-emerald-300 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> traité
            </span>
          )}
        </div>
        <div className="text-[11px] text-muted">
          {survey.completed_at
            ? `Répondu le ${new Date(survey.completed_at).toLocaleDateString('fr-FR')}`
            : `Programmé pour ${new Date(survey.scheduled_for).toLocaleDateString('fr-FR')}`}
        </div>
      </div>

      <div className="mt-2 text-sm">
        <span className="text-muted">De </span>
        <span className="text-text font-medium">{survey.recipient_name || survey.recipient_email}</span>
        <span className="text-muted"> — </span>
        <a href={`mailto:${survey.recipient_email}`} className="text-primary-light hover:underline text-xs">
          {survey.recipient_email}
        </a>
      </div>

      {survey.verbatim && (
        <blockquote className="mt-3 px-3 py-2 border-l-2 border-teal-500/40 bg-teal-500/5 text-sm text-text/90 italic">
          « {survey.verbatim} »
        </blockquote>
      )}

      {survey.send_error && (
        <p className="mt-2 text-xs text-orange-400">
          Erreur d&apos;envoi : {survey.send_error}
        </p>
      )}

      {survey.resolved_at && survey.resolution_notes && (
        <p className="mt-2 text-xs text-muted italic">
          Note interne : {survey.resolution_notes}
        </p>
      )}

      {survey.completed_at && !survey.resolved_at && !resolveOpen && (
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => setResolveOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Marquer comme traité
          </button>
        </div>
      )}

      {resolveOpen && (
        <div className="mt-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
          <label className="text-xs text-muted mb-1 block">Note interne (optionnel)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Ex : appel passé, problème résolu, etc."
            className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm focus:border-primary focus:ring-1 focus:ring-primary"
          />
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={handleResolve}
              disabled={isPending}
              className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-semibold transition-colors disabled:opacity-50"
            >
              Confirmer
            </button>
            <button
              onClick={() => setResolveOpen(false)}
              className="px-3 py-1.5 rounded-lg border border-border text-muted hover:text-text text-xs transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {survey.resolved_at && (
        <button
          onClick={handleUnresolve}
          disabled={isPending}
          className="mt-3 px-2 py-1 rounded text-[10px] text-muted hover:text-text border border-border transition-colors flex items-center gap-1"
        >
          <RotateCcw className="w-3 h-3" />
          Ré-ouvrir
        </button>
      )}
    </div>
  )
}
