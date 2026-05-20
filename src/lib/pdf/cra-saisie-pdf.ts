import { getMonthlySaisie } from '@/lib/actions/cra-saisie'
import { createAdminClient } from '@/lib/supabase/server'
import { buildCraSaisieHtml } from './cra-saisie-template'
import { renderHtmlToPdf, fetchLogoBase64 } from './render'

function safeFileName(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
}

/**
 * Génère le PDF du CRA saisi (workflow Mary → collab → admin → comptable).
 * Différent du PDF auto-généré (`cra-pdf.ts`) qui consomme les leave_requests.
 */
export async function buildCraSaisiePdf(
  memberId: string,
  year: number,
  month: number
): Promise<{ buffer: Buffer; filename: string; establishmentName: string }> {
  const result = await getMonthlySaisie(memberId, year, month)
  if (result.error || !result.data) {
    throw new Error(result.error || 'Impossible de générer le CRA')
  }
  const view = result.data

  const admin = createAdminClient()
  const { data: est } = await admin
    .from('establishments')
    .select('name, logo_url, accountant_email, accountant_name')
    .eq('id', (await admin.from('establishment_members').select('establishment_id').eq('id', memberId).single()).data?.establishment_id || '')
    .single()

  const logoBase64 = await fetchLogoBase64(est?.logo_url ?? null)
  const html = buildCraSaisieHtml(view, est?.name || 'SDA', logoBase64)
  const buffer = await renderHtmlToPdf(html, { landscape: true })

  const monthStr = String(month).padStart(2, '0')
  const memberSlug = safeFileName(view.member_name)
  const filename = `CRA_${memberSlug}_${year}-${monthStr}.pdf`

  return { buffer, filename, establishmentName: est?.name || 'SDA' }
}
