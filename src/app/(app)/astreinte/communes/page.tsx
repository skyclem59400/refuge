import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/server'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { redirect } from 'next/navigation'
import { CommunesList } from '@/components/astreinte/communes-list'

export const dynamic = 'force-dynamic'

interface SearchParams {
  epci?: string
  status?: string
  q?: string
}

export default async function CommunesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const ctx = await getEstablishmentContext()
  if (!ctx?.permissions.canManageEstablishment) {
    redirect('/dashboard')
  }

  const params = await searchParams
  const admin = createAdminClient()

  const [{ data: epcis }, { data: communes }] = await Promise.all([
    admin
      .from('astreinte_epci')
      .select('code_siren, short_name, full_name, member_count, department')
      .order('short_name'),
    admin
      .from('astreinte_municipalities')
      .select(
        'code_insee, name, postal_codes, epci_code_siren, department, population, convention_status, convention_yearly_fee, updated_at'
      )
      .order('name'),
  ])

  // Filtres côté serveur
  let filtered = communes ?? []
  if (params.epci) {
    filtered = filtered.filter((c) => c.epci_code_siren === params.epci)
  }
  if (params.status) {
    filtered = filtered.filter((c) => c.convention_status === params.status)
  }
  if (params.q) {
    const q = params.q.toLowerCase()
    filtered = filtered.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code_insee.includes(q) ||
        c.postal_codes.some((p: string) => p.includes(q))
    )
  }

  // Stats globales
  const stats = {
    total: communes?.length ?? 0,
    active: communes?.filter((c) => c.convention_status === 'active').length ?? 0,
    pending: communes?.filter((c) => c.convention_status === 'pending').length ?? 0,
    none: communes?.filter((c) => c.convention_status === 'none').length ?? 0,
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Communes &amp; conventions</h1>
        <p className="text-sm text-muted mt-1">
          {stats.total} communes du territoire SDA · {stats.active} sous convention active ·{' '}
          {stats.pending} en cours · {stats.none} hors convention
        </p>
      </div>

      <CommunesList
        epcis={epcis ?? []}
        communes={filtered}
        currentFilters={params}
        stats={stats}
      />
    </div>
  )
}
