'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { buildDailyAuditPdf, markAuditRunSent } from '@/lib/pdf/daily-audit-pdf'
import { sendEmail } from '@/lib/email/client'

export interface AuditHistoryRow {
  id: string
  audit_date: string
  generated_at: string
  trigger_source: 'cron' | 'manual'
  pdf_storage_path: string | null
  pdf_file_name: string | null
  pdf_size_bytes: number | null
  ai_summary: string | null
  ai_tokens_input: number | null
  ai_tokens_output: number | null
  ai_tokens_cache_read: number | null
  ai_error: string | null
  stats: Array<{
    establishment: string
    score: number
    critical: number
    warnings: number
    overdue_health: number
    cra_gaps: number
    judicial_incomplete: number
    animals_to_review: number
    actions_yesterday: number
  }>
  sent_to: string | null
  sent_at: string | null
  send_error: string | null
  generated_by_user_id: string | null
  generated_by_name?: string | null
}

async function requireAdmin(): Promise<{ userId: string; establishmentId: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')

  const ctx = await getEstablishmentContext()
  if (!ctx?.permissions.isAdmin) throw new Error('Réservé aux administrateurs')

  return { userId: user.id, establishmentId: ctx.establishment.id }
}

export async function listAuditRuns(limit = 30): Promise<{ data?: AuditHistoryRow[]; error?: string }> {
  try {
    await requireAdmin()
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('daily_audit_runs')
      .select('*')
      .order('generated_at', { ascending: false })
      .limit(limit)
    if (error) return { error: error.message }

    const rows = (data || []) as AuditHistoryRow[]
    const userIds = Array.from(new Set(rows.map((r) => r.generated_by_user_id).filter((v): v is string => !!v)))
    if (userIds.length > 0) {
      const { data: usersInfo } = await admin.rpc('get_users_info', { user_ids: userIds })
      const namesMap = new Map<string, string>()
      for (const u of (usersInfo || []) as Array<{ id: string; full_name: string | null; email: string | null }>) {
        namesMap.set(u.id, u.full_name || u.email || u.id.slice(0, 8))
      }
      for (const r of rows) {
        if (r.generated_by_user_id) r.generated_by_name = namesMap.get(r.generated_by_user_id) ?? null
      }
    }

    return { data: rows }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function getAuditPdfSignedUrl(runId: string): Promise<{ data?: { url: string }; error?: string }> {
  try {
    await requireAdmin()
    const admin = createAdminClient()
    const { data: row } = await admin
      .from('daily_audit_runs')
      .select('pdf_storage_path')
      .eq('id', runId)
      .maybeSingle()
    if (!row?.pdf_storage_path) return { error: 'PDF introuvable pour ce run' }

    const { data: signed, error } = await admin.storage
      .from('audit-reports')
      .createSignedUrl(row.pdf_storage_path, 60 * 30) // 30 min
    if (error) return { error: error.message }
    return { data: { url: signed.signedUrl } }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function generateAuditNow(options?: { sendEmail?: boolean }): Promise<{
  data?: { runId: string; criticalCount: number; aiOk: boolean; emailSent: boolean }
  error?: string
}> {
  try {
    const { userId, establishmentId } = await requireAdmin()
    const run = await buildDailyAuditPdf({
      triggerSource: 'manual',
      generatedByUserId: userId,
      establishmentIds: [establishmentId],
    })

    let emailSent = false
    if (options?.sendEmail) {
      const dateLabel = new Date(run.auditDate + 'T00:00:00').toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })
      const subject = `[Manuel] Audit Optimus du ${dateLabel}${run.criticalCount > 0 ? ` — ${run.criticalCount} alerte(s) critique(s)` : ''}`
      let sendError: string | null = null
      try {
        await sendEmail({
          to: 'clement.scailteux@gmail.com',
          toName: 'Clément Scailteux',
          subject,
          html: `<p>Bonjour Clément,</p><p>Audit déclenché manuellement pour le <strong>${dateLabel}</strong>. PDF en pièce jointe.</p>`,
          attachments: [{ filename: run.filename, content: run.buffer, contentType: 'application/pdf' }],
        })
        emailSent = true
      } catch (e) {
        sendError = (e as Error).message
      }
      await markAuditRunSent(run.runId, 'clement.scailteux@gmail.com', sendError)
    }

    revalidatePath('/etablissement/audit-quotidien')
    return {
      data: {
        runId: run.runId,
        criticalCount: run.criticalCount,
        aiOk: !!run.aiAnalysis,
        emailSent,
      },
    }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
