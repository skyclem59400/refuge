import { getMonthlyCra } from '@/lib/actions/cra'
import { createAdminClient } from '@/lib/supabase/server'
import { buildCraHtml } from './cra-template'
import { renderHtmlToPdf, fetchLogoBase64 } from './render'

function safeFileName(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
}

export async function buildMonthlyCraPdf(
  memberId: string,
  year: number,
  month: number
): Promise<{ buffer: Buffer; filename: string }> {
  const result = await getMonthlyCra(memberId, year, month)
  if (result.error || !result.data) {
    throw new Error(result.error || 'Impossible de generer le CRA')
  }
  const cra = result.data

  const admin = createAdminClient()
  const { data: est } = await admin
    .from('establishments')
    .select('logo_url')
    .eq('id', cra.establishment.id)
    .single()

  const logoBase64 = await fetchLogoBase64(est?.logo_url ?? null)
  const html = buildCraHtml(cra, logoBase64)
  const buffer = await renderHtmlToPdf(html, { landscape: true })

  const monthStr = String(month).padStart(2, '0')
  const memberSlug = safeFileName(cra.member.full_name || cra.member.pseudo || cra.member.id)
  const filename = `CRA_${memberSlug}_${year}-${monthStr}.pdf`

  return { buffer, filename }
}
