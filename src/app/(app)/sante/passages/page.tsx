import { redirect } from 'next/navigation'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { getPassagesVeto, getPassagesVetoStats } from '@/lib/actions/passages-veto'
import { getVeterinaryClinics } from '@/lib/actions/veterinarians'
import { PassagesVetoClient } from '@/components/passages-veto/passages-veto-client'

interface SearchParams {
  start?: string
  end?: string
  vet?: string
  clinic?: string
  type?: string
  judicial?: string
}

export default async function PassagesVetoPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const ctx = await getEstablishmentContext()
  if (!ctx) return null
  if (!ctx.permissions.canManageHealth && !ctx.permissions.isAdmin) redirect('/dashboard')

  const sp = await searchParams
  const filters = {
    startDate: sp.start || '',
    endDate: sp.end || '',
    vetId: sp.vet || '',
    clinicId: sp.clinic || '',
    type: sp.type || '',
    judicialOnly: sp.judicial === '1',
  }

  const [passagesRes, statsRes, clinicsRes] = await Promise.all([
    getPassagesVeto({
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined,
      vetId: filters.vetId || undefined,
      clinicId: filters.clinicId || undefined,
      type: filters.type || undefined,
      judicialOnly: filters.judicialOnly,
    }),
    getPassagesVetoStats({
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined,
      vetId: filters.vetId || undefined,
      clinicId: filters.clinicId || undefined,
      type: filters.type || undefined,
      judicialOnly: filters.judicialOnly,
    }),
    getVeterinaryClinics(true),
  ])

  const passages = passagesRes.data || []
  const stats = statsRes.data || { count: 0, totalCost: 0, byVet: {}, byType: {} }
  const clinics = clinicsRes.data || []

  return (
    <>
      <p className="text-sm text-muted max-w-2xl mb-6">
        Liste de toutes les visites vétérinaires (consolidé multi-animaux). Exportable pour partage avec les cabinets.
      </p>

      <PassagesVetoClient
        passages={passages}
        stats={stats}
        clinics={clinics}
        initialFilters={filters}
      />
    </>
  )
}
