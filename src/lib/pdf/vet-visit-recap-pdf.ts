import { createAdminClient } from '@/lib/supabase/server'
import { buildVetVisitRecapHtml } from './vet-visit-recap-template'
import { renderHtmlToPdf, fetchLogoBase64 } from './render'
import type { VetVisitWithLines, VetVisitLineWithAnimal } from '@/lib/types/database'

/**
 * Génère le PDF récap d'un passage vétérinaire.
 * Charge la visite + lignes + animaux + établissement, applique la charte SDA,
 * et retourne le buffer PDF prêt à être envoyé/stocké.
 */
export async function buildVetVisitRecapPdf(visitId: string): Promise<{
  buffer: Buffer
  filename: string
  visit: VetVisitWithLines
  establishmentName: string
} | { error: string }> {
  const admin = createAdminClient()

  // 1. Visite
  const { data: visitRow, error: visitErr } = await admin
    .from('vet_visits')
    .select('*')
    .eq('id', visitId)
    .single()
  if (visitErr || !visitRow) return { error: 'Passage véto introuvable' }

  // 2. Lignes avec animaux
  const { data: linesData, error: linesErr } = await admin
    .from('vet_visit_lines')
    .select(`
      *,
      animal:animals!animal_id(id, name, medal_number, species, breed, breed_cross, color, chip_number)
    `)
    .eq('visit_id', visitId)
    .order('line_order', { ascending: true })
  if (linesErr) return { error: linesErr.message }

  // 3. Établissement
  const { data: est } = await admin
    .from('establishments')
    .select('name, logo_url, address, phone')
    .eq('id', visitRow.establishment_id)
    .single()

  const logoBase64 = await fetchLogoBase64(est?.logo_url ?? null)

  const visit: VetVisitWithLines = {
    ...visitRow,
    lines: (linesData || []) as VetVisitLineWithAnimal[],
  }

  const html = buildVetVisitRecapHtml({
    visit,
    establishment: {
      name: est?.name || 'SDA',
      address: est?.address || null,
      phone: est?.phone || null,
    },
    logoBase64,
  })

  const buffer = await renderHtmlToPdf(html, { landscape: false })

  const dateStr = visit.visit_date.replace(/-/g, '')
  const filename = `recap-veto-${dateStr}-${visitId.slice(0, 8)}.pdf`

  return { buffer, filename, visit, establishmentName: est?.name || 'SDA' }
}
