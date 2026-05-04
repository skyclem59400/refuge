import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MapPin } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/server'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { CommuneForm } from '@/components/astreinte/commune-form'

export const dynamic = 'force-dynamic'

export default async function CommuneDetailPage({
  params,
}: {
  params: Promise<{ code_insee: string }>
}) {
  const ctx = await getEstablishmentContext()
  if (!ctx?.permissions.canManageEstablishment) {
    redirect('/dashboard')
  }

  const { code_insee } = await params
  const admin = createAdminClient()

  const [{ data: commune }, { data: epcis }] = await Promise.all([
    admin
      .from('astreinte_municipalities')
      .select('*')
      .eq('code_insee', code_insee)
      .maybeSingle(),
    admin
      .from('astreinte_epci')
      .select('code_siren, short_name, full_name')
      .order('short_name'),
  ])

  if (!commune) {
    notFound()
  }

  const epci = epcis?.find((e) => e.code_siren === commune.epci_code_siren)

  return (
    <div className="animate-fade-up max-w-3xl">
      <Link
        href="/astreinte/communes"
        className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground mb-4"
      >
        <ArrowLeft size={14} />
        Retour à la liste
      </Link>

      <div className="flex items-start gap-4 mb-8">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <MapPin size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{commune.name}</h1>
          <p className="text-sm text-muted mt-1">
            INSEE {commune.code_insee} · {commune.postal_codes.join(', ')} ·{' '}
            {epci?.short_name ?? 'Sans EPCI'} · Dept {commune.department}
            {commune.population && ` · ${commune.population.toLocaleString('fr-FR')} habitants`}
          </p>
        </div>
      </div>

      <CommuneForm commune={commune} />
    </div>
  )
}
