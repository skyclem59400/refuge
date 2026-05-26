import { createAdminClient } from '@/lib/supabase/server'
import { computeDailyAudit, type DailyAuditSection } from '@/lib/actions/daily-audit'
import { generateAuditAnalysis } from '@/lib/ai/audit-analyzer'
import { buildDailyAuditHtml } from './daily-audit-template'
import { renderHtmlToPdf } from './render'

export interface DailyAuditRunResult {
  runId: string
  auditDate: string
  criticalCount: number
  filename: string
  buffer: Buffer
  storagePath: string
  aiAnalysis: string | null
  aiError: string | null
  aiUsage: {
    input_tokens: number
    output_tokens: number
    cache_creation_input_tokens: number
    cache_read_input_tokens: number
  } | null
  sections: DailyAuditSection[]
}

interface BuildOptions {
  triggerSource: 'cron' | 'manual'
  /** UUID du super admin qui a declenche manuellement (null pour cron). */
  generatedByUserId?: string | null
  /** Si fourni, restreint l'audit a ces etablissements. Sinon : tous. */
  establishmentIds?: string[]
}

/**
 * Genere l'audit complet du jour J-1 (calcul stats + analyse IA + PDF)
 * puis l'archive dans Supabase Storage avec une ligne d'historique.
 *
 * Utilise dans le cron quotidien ET depuis le bouton "Generer maintenant"
 * du panneau super admin.
 */
export async function buildDailyAuditPdf(opts: BuildOptions): Promise<DailyAuditRunResult> {
  const admin = createAdminClient()

  // 1. Calcul des sections (filtre etablissement si fourni)
  const sections = await computeDailyAudit(opts.establishmentIds)
  const auditDate = sections[0]?.auditDate || new Date().toISOString().slice(0, 10)
  const criticalCount = sections.reduce(
    (acc, s) => acc + s.critical.filter((c) => c.level === 'critical').length,
    0,
  )

  // 2. Analyse IA (Haiku 4.5) — graceful si echec
  const ai = await generateAuditAnalysis(sections)

  // 3. Rendu HTML + PDF
  const html = buildDailyAuditHtml(sections, ai.analysis, ai.error)
  const buffer = await renderHtmlToPdf(html, { landscape: false })

  // 4. Upload du PDF dans Supabase Storage
  const filename = `audit-quotidien-${auditDate}-${Date.now()}.pdf`
  const storagePath = `${auditDate}/${filename}`
  const { error: uploadError } = await admin.storage
    .from('audit-reports')
    .upload(storagePath, buffer, {
      contentType: 'application/pdf',
      upsert: false,
    })
  if (uploadError) {
    console.error('daily-audit: storage upload failed:', uploadError.message)
  }

  // 5. Trace dans daily_audit_runs (historique)
  const stats = sections.map((s) => ({
    establishment: s.establishmentName,
    score: s.scoreOutOf100,
    critical: s.critical.filter((c) => c.level === 'critical').length,
    warnings: s.critical.filter((c) => c.level === 'warning').length,
    overdue_health: s.overdueReminders.length,
    cra_gaps: s.craGaps.length,
    judicial_incomplete: s.judicialIncomplete.length,
    animals_to_review: s.animalsToReview.length,
    actions_yesterday: s.totalActionsYesterday,
    suspicious_changes: s.suspiciousChanges.length,
  }))

  const { data: runRow, error: insertErr } = await admin
    .from('daily_audit_runs')
    .insert({
      audit_date: auditDate,
      trigger_source: opts.triggerSource,
      generated_by_user_id: opts.generatedByUserId ?? null,
      pdf_storage_path: uploadError ? null : storagePath,
      pdf_file_name: filename,
      pdf_size_bytes: buffer.byteLength,
      ai_summary: ai.analysis,
      ai_model: ai.analysis ? 'claude-haiku-4-5' : null,
      ai_tokens_input: ai.usage?.input_tokens ?? null,
      ai_tokens_output: ai.usage?.output_tokens ?? null,
      ai_tokens_cache_read: ai.usage?.cache_read_input_tokens ?? null,
      ai_error: ai.error,
      stats,
    })
    .select('id')
    .single()

  if (insertErr || !runRow) {
    throw new Error(`Impossible d'historiser le run : ${insertErr?.message || 'unknown'}`)
  }

  return {
    runId: runRow.id as string,
    auditDate,
    criticalCount,
    filename,
    buffer,
    storagePath: uploadError ? '' : storagePath,
    aiAnalysis: ai.analysis,
    aiError: ai.error,
    aiUsage: ai.usage,
    sections,
  }
}

/** Marque le run comme envoye par email. */
export async function markAuditRunSent(runId: string, sentTo: string, sendError?: string | null): Promise<void> {
  const admin = createAdminClient()
  await admin
    .from('daily_audit_runs')
    .update({
      sent_to: sentTo,
      sent_at: new Date().toISOString(),
      send_error: sendError || null,
    })
    .eq('id', runId)
}
