import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

/**
 * GET /api/cra/change-request/latest?member=<uuid>&year=<n>&month=<n>
 * Retourne l'ID de la dernière demande de modification ouverte pour ce (member, year, month).
 * Utilisé par le banner "Marquer comme pris en compte" dans la saisie CRA.
 */
export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })

    const url = new URL(req.url)
    const memberId = url.searchParams.get('member')
    const year = url.searchParams.get('year')
    const month = url.searchParams.get('month')
    if (!memberId || !year || !month) {
      return NextResponse.json({ error: 'Params manquants' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: status } = await admin
      .from('cra_monthly_status')
      .select('id, establishment_id')
      .eq('member_id', memberId)
      .eq('year', parseInt(year, 10))
      .eq('month', parseInt(month, 10))
      .maybeSingle()
    if (!status) return NextResponse.json({ id: null })

    const { data: cr } = await admin
      .from('cra_change_requests')
      .select('id')
      .eq('cra_status_id', status.id)
      .is('resolved_at', null)
      .order('requested_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return NextResponse.json({ id: cr?.id || null })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
