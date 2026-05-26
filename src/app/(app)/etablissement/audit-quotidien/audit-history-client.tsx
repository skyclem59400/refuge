'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  RefreshCw, FileText, Send, Bot, AlertOctagon, AlertTriangle, CheckCircle2,
  Sparkles, Clock, User, Loader2, Eye,
} from 'lucide-react'
import { generateAuditNow, getAuditPdfSignedUrl, type AuditHistoryRow } from '@/lib/actions/audit-history'

interface Props {
  readonly initialRuns: AuditHistoryRow[]
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-500 border-emerald-500/40 bg-emerald-500/10'
  if (score >= 60) return 'text-amber-500 border-amber-500/40 bg-amber-500/10'
  if (score >= 40) return 'text-orange-500 border-orange-500/40 bg-orange-500/10'
  return 'text-red-500 border-red-500/40 bg-red-500/10'
}

export function AuditHistoryClient({ initialRuns }: Props) {
  const router = useRouter()
  const [runs, setRuns] = useState(initialRuns)
  const [isPending, startTransition] = useTransition()
  const [openSummary, setOpenSummary] = useState<string | null>(null)

  function handleGenerate(withEmail: boolean) {
    if (!confirm(withEmail
      ? "Générer un nouvel audit MAINTENANT et l'envoyer par mail ?"
      : "Générer un nouvel audit MAINTENANT (sans envoi mail) ?"
    )) return

    startTransition(async () => {
      const t = toast.loading('Génération en cours… (calcul + IA + PDF, ~30s)')
      const res = await generateAuditNow({ sendEmail: withEmail })
      toast.dismiss(t)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(
        `Audit généré (${res.data!.criticalCount} critique${res.data!.criticalCount > 1 ? 's' : ''})` +
        (res.data!.aiOk ? ' — Analyse IA ✓' : ' — Analyse IA ✗') +
        (withEmail ? (res.data!.emailSent ? ' — Mail envoyé ✓' : ' — Mail échec') : ''),
      )
      router.refresh()
    })
  }

  function handleOpenPdf(runId: string) {
    startTransition(async () => {
      const res = await getAuditPdfSignedUrl(runId)
      if (res.error || !res.data?.url) {
        toast.error(res.error || 'PDF introuvable')
        return
      }
      window.open(res.data.url, '_blank', 'noopener,noreferrer')
    })
  }

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="bg-surface rounded-xl border border-border p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Générer maintenant
          </h2>
          <p className="text-xs text-muted mt-1">
            Lance un audit immédiat (J-1) avec analyse IA. ~30s de calcul + génération PDF.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleGenerate(false)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-border hover:bg-surface-hover disabled:opacity-50"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Générer (sans mail)
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleGenerate(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold gradient-primary text-white hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Générer + envoyer
          </button>
        </div>
      </div>

      {/* Historique */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted" />
            Historique des audits ({runs.length})
          </h2>
        </div>

        {runs.length === 0 ? (
          <div className="p-8 text-center text-muted text-sm">
            Aucun audit généré pour le moment. Clique sur « Générer maintenant » pour produire le premier.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-dark/40">
              <tr className="text-left">
                <th className="px-4 py-2 font-semibold text-muted text-xs uppercase">Date audit</th>
                <th className="px-4 py-2 font-semibold text-muted text-xs uppercase">Généré</th>
                <th className="px-4 py-2 font-semibold text-muted text-xs uppercase">Source</th>
                <th className="px-4 py-2 font-semibold text-muted text-xs uppercase">Score</th>
                <th className="px-4 py-2 font-semibold text-muted text-xs uppercase">Alertes</th>
                <th className="px-4 py-2 font-semibold text-muted text-xs uppercase">IA</th>
                <th className="px-4 py-2 font-semibold text-muted text-xs uppercase">Envoi</th>
                <th className="px-4 py-2 font-semibold text-muted text-xs uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {runs.map((r) => {
                const totalCritical = r.stats.reduce((acc, s) => acc + s.critical, 0)
                const totalWarn = r.stats.reduce((acc, s) => acc + s.warnings, 0)
                const avgScore = r.stats.length > 0
                  ? Math.round(r.stats.reduce((acc, s) => acc + s.score, 0) / r.stats.length)
                  : 0
                return (
                  <tr key={r.id} className="hover:bg-surface-hover/40 transition-colors">
                    <td className="px-4 py-2 whitespace-nowrap">{formatDate(r.audit_date)}</td>
                    <td className="px-4 py-2 text-xs text-muted whitespace-nowrap">
                      <Clock className="inline w-3 h-3 mr-1" />
                      {formatDateTime(r.generated_at)}
                    </td>
                    <td className="px-4 py-2">
                      {r.trigger_source === 'cron' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-primary/10 text-primary border border-primary/30">
                          <Clock className="w-3 h-3" /> Cron
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-amber-500/10 text-amber-500 border border-amber-500/30">
                          <User className="w-3 h-3" /> Manuel
                          {r.generated_by_name && ` (${r.generated_by_name})`}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold border ${scoreColor(avgScore)}`}>
                        {avgScore}/100
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        {totalCritical > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs text-error font-semibold">
                            <AlertOctagon className="w-3 h-3" />{totalCritical}
                          </span>
                        )}
                        {totalWarn > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-500 font-semibold">
                            <AlertTriangle className="w-3 h-3" />{totalWarn}
                          </span>
                        )}
                        {totalCritical === 0 && totalWarn === 0 && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      {r.ai_summary ? (
                        <button
                          type="button"
                          onClick={() => setOpenSummary(openSummary === r.id ? null : r.id)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-cyan-500/10 text-cyan-600 border border-cyan-500/30 hover:bg-cyan-500/20"
                          title="Voir la synthèse IA"
                        >
                          <Bot className="w-3 h-3" /> Voir
                        </button>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {r.sent_at ? (
                        r.send_error ? (
                          <span className="text-error" title={r.send_error}>✗ Erreur</span>
                        ) : (
                          <span className="text-emerald-500">✓ {formatDateTime(r.sent_at).split(' ').pop()}</span>
                        )
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {r.pdf_storage_path ? (
                        <button
                          type="button"
                          onClick={() => handleOpenPdf(r.id)}
                          disabled={isPending}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 disabled:opacity-50"
                        >
                          <Eye className="w-3 h-3" /> PDF
                        </button>
                      ) : (
                        <span className="text-xs text-muted">PDF absent</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {/* Modale synthèse IA */}
        {openSummary && (() => {
          const run = runs.find((r) => r.id === openSummary)
          if (!run?.ai_summary) return null
          return (
            <div
              className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => setOpenSummary(null)}
            >
              <div
                className="bg-surface rounded-2xl border border-border max-w-3xl w-full max-h-[85vh] overflow-y-auto p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Bot className="w-5 h-5 text-cyan-500" />
                    Synthèse IA — {formatDate(run.audit_date)}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setOpenSummary(null)}
                    className="px-2 py-1 text-sm text-muted hover:text-text"
                  >
                    ✕
                  </button>
                </div>
                <div className="text-sm whitespace-pre-wrap leading-relaxed">{run.ai_summary}</div>
                {run.ai_tokens_input && (
                  <div className="mt-4 pt-3 border-t border-border text-xs text-muted">
                    Modèle : claude-haiku-4-5 — {run.ai_tokens_input} tokens in
                    {run.ai_tokens_cache_read ? ` (${run.ai_tokens_cache_read} cachés)` : ''} /{' '}
                    {run.ai_tokens_output} tokens out
                  </div>
                )}
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
