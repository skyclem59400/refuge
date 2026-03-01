import { redirect } from 'next/navigation'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { getAllCalls, getCallStats, getAgentSessions, getCallCategories, seedDefaultCategories } from '@/lib/actions/calls'
import { CallStats } from '@/components/calls/call-stats'
import { ActiveAgents } from '@/components/calls/active-agents'
import { CallFilters } from '@/components/calls/call-filters'
import { CategoryChart } from '@/components/calls/category-chart'
import { CallList } from '@/components/calls/call-list'
import type { CallStatus } from '@/lib/types/database'

export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string }>
}) {
  const params = await searchParams
  const ctx = await getEstablishmentContext()
  if (!ctx) redirect('/login')

  // Seed default categories (no-op if already exist)
  await seedDefaultCategories()

  // Build filters
  const filters: { status?: CallStatus; category_id?: string } = {}
  if (params.status) {
    filters.status = params.status as CallStatus
  }
  if (params.category) {
    filters.category_id = params.category
  }

  // Fetch data in parallel
  const [statsResult, callsResult, agentsResult, categoriesResult] = await Promise.all([
    getCallStats(),
    getAllCalls(filters),
    getAgentSessions(),
    getCallCategories(),
  ])

  const stats = statsResult.data || { total: 0, inProgress: 0, avgDuration: 0, callbackNeeded: 0 }
  const calls = callsResult.data || []
  const agents = agentsResult.data || []
  const categories = categoriesResult.data || []

  return (
    <div>
      {/* Stats */}
      <div className="mb-6">
        <CallStats stats={stats} />
      </div>

      {/* Active agents */}
      <div className="mb-6">
        <ActiveAgents initialAgents={agents} establishmentId={ctx.establishment.id} />
      </div>

      {/* Filters + Category chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <CallFilters categories={categories} />
        <CategoryChart calls={calls} categories={categories} />
      </div>

      {/* Call list */}
      <CallList initialCalls={calls} categories={categories} establishmentId={ctx.establishment.id} />
    </div>
  )
}
