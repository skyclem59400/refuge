import { computeDailyAudit } from '@/lib/actions/daily-audit'
import { buildDailyAuditHtml } from './daily-audit-template'
import { renderHtmlToPdf } from './render'

/**
 * Genere le PDF de l'audit quotidien (multi-etablissement, agrege).
 * Le PDF couvre l'activite de la veille (J-1) + etats critiques.
 */
export async function buildDailyAuditPdf(): Promise<{ buffer: Buffer; filename: string; auditDate: string; criticalCount: number }> {
  const sections = await computeDailyAudit()
  const html = buildDailyAuditHtml(sections)
  const buffer = await renderHtmlToPdf(html, { landscape: false })

  const auditDate = sections[0]?.auditDate || new Date().toISOString().slice(0, 10)
  const criticalCount = sections.reduce((acc, s) => acc + s.critical.filter((c) => c.level === 'critical').length, 0)
  const filename = `audit-quotidien-${auditDate}.pdf`

  return { buffer, filename, auditDate, criticalCount }
}
