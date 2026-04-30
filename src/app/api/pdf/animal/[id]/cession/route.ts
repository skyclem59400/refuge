import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { renderHtmlToPdf } from '@/lib/pdf/render'
import { loadAnimalForPdf } from '@/lib/pdf/animal-pdf-helpers'
import { buildCessionCertificateHtml, DEFAULT_AUSCULTATION_LABELS } from '@/lib/pdf/vet-certificate-templates'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const bundle = await loadAnimalForPdf(id)
    if (!bundle) return NextResponse.json({ error: 'Animal introuvable' }, { status: 404 })

    // Build auscultation findings from latest consultation if available
    const lastConsultation = bundle.healthRecords.find((r) => r.type === 'consultation')
    const findings = DEFAULT_AUSCULTATION_LABELS.map((label) => ({
      label,
      normal: !!lastConsultation,
      observations: '',
    }))

    const html = buildCessionCertificateHtml({
      animal: bundle.animal,
      establishment: bundle.establishment,
      vet: bundle.vet,
      clinic: bundle.clinic,
      logoBase64: bundle.logoBase64,
      primaryPhoto: bundle.primaryPhoto,
      findings,
      weight: bundle.animal.weight,
      generatedAt: new Date(),
    })

    const pdf = await renderHtmlToPdf(html)
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="certificat_cession_${bundle.animal.name}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('Cession certificate PDF error:', err)
    const msg = err instanceof Error ? err.message : 'Erreur génération PDF'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
