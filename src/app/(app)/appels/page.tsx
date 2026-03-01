import { redirect } from 'next/navigation'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { getRingoverConnection } from '@/lib/actions/ringover'
import {
  getRingoverAccueilStats,
  getRingoverAccueilCalls,
  getRingoverHourlyDistribution,
  getRingoverDailyTrend,
  getRingoverTopCallers,
} from '@/lib/actions/ringover-sync'
import { AccueilStats } from '@/components/calls/accueil/accueil-stats'
import { PeriodFilter } from '@/components/calls/accueil/period-filter'
import { SyncControls } from '@/components/calls/accueil/sync-controls'
import { HourlyChart } from '@/components/calls/accueil/hourly-chart'
import { DailyTrendChart } from '@/components/calls/accueil/daily-trend-chart'
import { AccueilCallList } from '@/components/calls/accueil/accueil-call-list'
import { TopCallers } from '@/components/calls/accueil/top-callers'

export default async function AppelsAccueilPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const params = await searchParams
  const ctx = await getEstablishmentContext()
  if (!ctx) redirect('/login')

  const period = (params.period as 'today' | '7d' | '30d' | 'all') || '7d'

  // Get Ringover connection
  const connResult = await getRingoverConnection()
  const connection = connResult.data || null

  // If no connection at all, show config panel only
  if (!connection) {
    return (
      <div>
        <SyncControls connection={connection} />
      </div>
    )
  }

  // Fetch all dashboard data in parallel
  const [statsResult, callsResult, hourlyResult, dailyResult, topCallersResult] =
    await Promise.all([
      getRingoverAccueilStats(period),
      getRingoverAccueilCalls({ limit: 200 }),
      getRingoverHourlyDistribution(period === 'today' ? '7d' : period === 'all' ? '30d' : period),
      getRingoverDailyTrend(period === 'today' ? 7 : period === '7d' ? 7 : 30),
      getRingoverTopCallers(10),
    ])

  const stats = statsResult.data || {
    totalCalls: 0, answeredCalls: 0, missedCalls: 0, voicemailCalls: 0,
    outboundCalls: 0, answerRate: 0, missedRate: 0, avgDuration: 0,
    avgWaitTime: 0, totalDuration: 0, callbacksPending: 0,
  }
  const calls = callsResult.data || []
  const hourly = hourlyResult.data || []
  const daily = dailyResult.data || []
  const topCallers = topCallersResult.data || []

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <PeriodFilter />
        <SyncControls connection={connection} />
      </div>

      {/* KPI Stats */}
      <AccueilStats stats={stats} />

      {/* Charts + Top callers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          <HourlyChart data={hourly} />
          <DailyTrendChart data={daily} />
        </div>
        <TopCallers callers={topCallers} />
      </div>

      {/* Two call lists side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AccueilCallList
          initialCalls={calls}
          establishmentId={ctx.establishment.id}
          filter="no-audio"
          title="Appels sans message"
          icon="phone"
        />
        <AccueilCallList
          initialCalls={calls}
          establishmentId={ctx.establishment.id}
          filter="with-audio"
          title="Messages vocaux & enregistrements"
          icon="headphones"
        />
      </div>
    </div>
  )
}
