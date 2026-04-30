import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { renderHtmlToPdf, fetchLogoBase64 } from '@/lib/pdf/render'
import { buildPassagesVetoHtml } from '@/lib/pdf/passages-veto-template'
import { getPassagesVeto, getPassagesVetoStats } from '@/lib/actions/passages-veto'

const TYPE_LABELS: Record<string, string> = {
  vaccination: 'Vaccination', sterilization: 'Stérilisation',
  antiparasitic: 'Antiparasitaire', consultation: 'Consultation',
  surgery: 'Chirurgie', medication: 'Médicament',
  behavioral_assessment: 'Bilan comportemental',
  identification: 'Identification', radio: 'Radio', blood_test: 'Prise de sang',
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const ctx = await getEstablishmentContext()
    if (!ctx) return NextResponse.json({ error: 'Etablissement non sélectionné' }, { status: 400 })

    const sp = req.nextUrl.searchParams
    const filters = {
      startDate: sp.get('start') || undefined,
      endDate: sp.get('end') || undefined,
      vetId: sp.get('vet') || undefined,
      clinicId: sp.get('clinic') || undefined,
      type: sp.get('type') || undefined,
      judicialOnly: sp.get('judicial') === '1',
    }

    const [passagesRes, statsRes] = await Promise.all([
      getPassagesVeto(filters),
      getPassagesVetoStats(filters),
    ])

    const passages = passagesRes.data || []
    const stats = statsRes.data || { count: 0, totalCost: 0 }

    // Resolve filter labels (vet name, clinic name)
    let vetName: string | undefined
    let clinicName: string | undefined
    const admin = createAdminClient()
    if (filters.vetId) {
      const { data } = await admin.from('veterinarians').select('first_name,last_name').eq('id', filters.vetId).single()
      if (data) {
        const v = data as { first_name: string | null; last_name: string }
        vetName = `Dr ${v.first_name ? `${v.first_name} ` : ''}${v.last_name}`
      }
    }
    if (filters.clinicId) {
      const { data } = await admin.from('veterinary_clinics').select('name').eq('id', filters.clinicId).single()
      if (data) clinicName = (data as { name: string }).name
    }

    const logoBase64 = await fetchLogoBase64(ctx.establishment.logo_url)

    const html = buildPassagesVetoHtml({
      passages,
      stats,
      filters: {
        startDate: filters.startDate,
        endDate: filters.endDate,
        vetName,
        clinicName,
        typeLabel: filters.type ? TYPE_LABELS[filters.type] || filters.type : undefined,
        judicialOnly: filters.judicialOnly,
      },
      establishmentName: ctx.establishment.name,
      establishmentAddress: ctx.establishment.address || '',
      establishmentPhone: ctx.establishment.phone || '',
      logoBase64,
      generatedAt: new Date(),
    })

    const pdf = await renderHtmlToPdf(html, { landscape: true })
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="passages-veto.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('Passages veto PDF error:', err)
    const msg = err instanceof Error ? err.message : 'Erreur génération PDF'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
