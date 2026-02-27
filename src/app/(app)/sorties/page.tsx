import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Footprints, Calendar, AlertTriangle, PawPrint, BarChart3 } from 'lucide-react'
import { getOutings, getAnimalOutingPriority, getOutingStats, getOutingLeaderboard } from '@/lib/actions/outings'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { createAdminClient } from '@/lib/supabase/server'
import { OutingPriorityList } from '@/components/outings/outing-priority-list'
import { OutingHistory } from '@/components/outings/outing-history'
import { OutingStats } from '@/components/outings/outing-stats'

const views = [
  { key: 'promenades', label: 'Promenades', Icon: Footprints },
  { key: 'statistiques', label: 'Statistiques', Icon: BarChart3 },
] as const

type ViewKey = (typeof views)[number]['key']

export default async function SortiesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const params = await searchParams
  const ctx = await getEstablishmentContext()
  if (!ctx) redirect('/login')
  const canManageOutings = ctx.permissions.canManageOutings
  const isAdmin = ctx.permissions.isAdmin
  const currentUserId = ctx.membership.user_id

  const view: ViewKey = params.view === 'statistiques' ? 'statistiques' : 'promenades'

  // Fetch data based on active view
  const [statsResult, priorityResult, outingsResult, leaderboardResult] = await Promise.all([
    getOutingStats(),
    view === 'promenades' ? getAnimalOutingPriority() : Promise.resolve({ data: [] }),
    view === 'promenades' ? getOutings({ limit: 50 }) : Promise.resolve({ data: [] }),
    view === 'statistiques' ? getOutingLeaderboard() : Promise.resolve({ data: null }),
  ])

  const stats = statsResult.data || { outingsToday: 0, outingsThisWeek: 0, totalActiveAnimals: 0 }
  const priorityAnimals = priorityResult.data || []
  const outings = outingsResult.data || []

  // Count animals needing a walk (3+ days or never)
  const animalsInNeed = view === 'promenades'
    ? priorityAnimals.filter(
        (a: { days_since_last_outing: number | null }) => a.days_since_last_outing === null || a.days_since_last_outing >= 3
      ).length
    : 0

  // Resolve user names (needed for both views)
  const userIdsFromOutings = outings.map((o: { walked_by: string }) => o.walked_by)
  const userIdsFromLeaderboard = leaderboardResult.data?.perPerson?.map((p: { userId: string }) => p.userId) || []
  const uniqueUserIds = [...new Set([...userIdsFromOutings, ...userIdsFromLeaderboard])]
  const userNames: Record<string, string> = {}

  if (uniqueUserIds.length > 0) {
    const admin = createAdminClient()
    const { data: usersInfo } = await admin.rpc('get_users_info', { user_ids: uniqueUserIds })
    if (usersInfo && Array.isArray(usersInfo)) {
      for (const u of usersInfo) {
        userNames[u.id] = u.full_name || u.email || u.id
      }
    }
  }

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Footprints className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Sorties</h1>
            <p className="text-sm text-muted mt-1">
              Suivi des promenades des chiens
            </p>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-surface rounded-xl border border-border p-4 text-center">
          <Footprints className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="text-2xl font-bold">{stats.outingsToday}</p>
          <p className="text-xs text-muted mt-1">Sorties aujourd&apos;hui</p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4 text-center">
          <Calendar className="w-5 h-5 text-info mx-auto mb-1" />
          <p className="text-2xl font-bold">{stats.outingsThisWeek}</p>
          <p className="text-xs text-muted mt-1">Cette semaine</p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4 text-center">
          <AlertTriangle className="w-5 h-5 text-warning mx-auto mb-1" />
          <p className="text-2xl font-bold">{animalsInNeed}</p>
          <p className="text-xs text-muted mt-1">En besoin de sortie</p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4 text-center">
          <PawPrint className="w-5 h-5 text-success mx-auto mb-1" />
          <p className="text-2xl font-bold">{stats.totalActiveAnimals}</p>
          <p className="text-xs text-muted mt-1">Chiens actifs</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-border">
        {views.map((v) => (
          <Link
            key={v.key}
            href={`/sorties?view=${v.key}`}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              view === v.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-text'
            }`}
          >
            <v.Icon className="w-4 h-4" />
            {v.label}
          </Link>
        ))}
      </div>

      {/* Tab content */}
      {view === 'promenades' && (
        <>
          <OutingPriorityList animals={priorityAnimals} canManageOutings={canManageOutings} />
          <OutingHistory outings={outings} userNames={userNames} isAdmin={isAdmin} currentUserId={currentUserId} />
        </>
      )}

      {view === 'statistiques' && leaderboardResult.data && (
        <OutingStats
          perPerson={leaderboardResult.data.perPerson}
          perAnimal={leaderboardResult.data.perAnimal}
          dailyTrend={leaderboardResult.data.dailyTrend}
          weeklyTrend={leaderboardResult.data.weeklyTrend}
          monthlyTrend={leaderboardResult.data.monthlyTrend}
          totalDuration={leaderboardResult.data.totalDuration}
          totalOutings={leaderboardResult.data.totalOutings}
          avgDuration={leaderboardResult.data.avgDuration}
          userNames={userNames}
        />
      )}
    </div>
  )
}
