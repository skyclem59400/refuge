import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { buildEngagementCertificatePdf } from '@/lib/pdf/engagement-certificate-pdf'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Si le certificat a déjà un PDF signé, on le sert directement.
    // Sinon on régénère le PDF non-signé (preview avant ou pendant signature).
    const admin = createAdminClient()
    const { data: certificate } = await admin
      .from('engagement_certificates')
      .select('signed_pdf_url')
      .eq('id', id)
      .maybeSingle()

    if (certificate?.signed_pdf_url) {
      return NextResponse.redirect(certificate.signed_pdf_url, 302)
    }

    const { buffer, filename } = await buildEngagementCertificatePdf(id)

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('Engagement certificate PDF generation error:', err)
    const msg = err instanceof Error ? err.message : 'Erreur génération certificat'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
