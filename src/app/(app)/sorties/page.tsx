import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Footprints, Calendar, AlertTriangle, PawPrint, BarChart3, Info } from 'lucide-react'
import { getOutings, getAnimalOutingPriority, getOutingStats, getOutingLeaderboard, getAssignments, getAssignmentStats } from '@/lib/actions/outings'
import { getEstablishmentMembers } from '@/lib/actions/establishments'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { createAdminClient } from '@/lib/supabase/server'
import { OutingPriorityList } from '@/components/outings/outing-priority-list'
import { OutingHistory } from '@/components/outings/outing-history'
import { OutingStats } from '@/components/outings/outing-stats'
import { MyDailyAssignments } from '@/components/outings/my-daily-assignments'
import AssignmentPanel from '@/components/outings/assignment-panel'
import { AssignmentStats } from '@/components/outings/assignment-stats'

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
  const canManageAssignments = ctx.permissions.canManageOutingAssignments
  const isAdmin = ctx.permissions.isAdmin
  const currentUserId = ctx.membership.user_id

  const view: ViewKey = params.view === 'statistiques' ? 'statistiques' : 'promenades'

  // Fetch data based on active view
  const [
    statsResult,
    priorityResult,
    outingsResult,
    leaderboardResult,
    assignmentsResult,
    assignmentStatsResult,
    membersResult,
  ] = await Promise.all([
    getOutingStats(),
    view === 'promenades' ? getAnimalOutingPriority() : Promise.resolve({ data: [] }),
    view === 'promenades' ? getOutings({ limit: 50 }) : Promise.resolve({ data: [] }),
    view === 'statistiques' ? getOutingLeaderboard() : Promise.resolve({ data: null }),
    view === 'promenades' ? getAssignments() : Promise.resolve({ data: [] }),
    view === 'statistiques' && canManageAssignments ? getAssignmentStats() : Promise.resolve({ data: null }),
    view === 'promenades' && canManageAssignments ? getEstablishmentMembers() : Promise.resolve({ data: [] }),
  ])

  const stats = statsResult.data || { outingsToday: 0, outingsThisWeek: 0, totalActiveAnimals: 0 }
  const priorityAnimals = priorityResult.data || []
  const outings = outingsResult.data || []
  const allAssignments = assignmentsResult.data || []
  const myAssignments = allAssignments.filter((a: { assigned_to: string }) => a.assigned_to === currentUserId)
  const members = ((membersResult as { data?: { user_id: string; full_name?: string | null; email?: string; pseudo: string | null }[] }).data || [])

  // Sort priority: dogs walked today (days=0) first, then by urgency (null=never walked first, then descending)
  const sortedPriorityAnimals = view === 'promenades'
    ? [...priorityAnimals].sort((a: { days_since_last_outing: number | null }, b: { days_since_last_outing: number | null }) => {
        const aToday = a.days_since_last_outing === 0
        const bToday = b.days_since_last_outing === 0
        if (aToday && !bToday) return -1
        if (!aToday && bToday) return 1
        // Both walked today or both not: sort by urgency (null first, then descending)
        if (a.days_since_last_outing === null && b.days_since_last_outing !== null) return -1
        if (a.days_since_last_outing !== null && b.days_since_last_outing === null) return 1
        return (b.days_since_last_outing ?? 0) - (a.days_since_last_outing ?? 0)
      })
    : priorityAnimals

  // Count animals needing a walk (3+ days or never)
  const animalsInNeed = view === 'promenades'
    ? priorityAnimals.filter(
        (a: { days_since_last_outing: number | null }) => a.days_since_last_outing === null || a.days_since_last_outing >= 3
      ).length
    : 0

  // Resolve user names (needed for both views)
  // Helper to validate UUID format
  const isValidUUID = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

  const userIdsFromOutings = outings.map((o: { walked_by: string }) => o.walked_by).filter(isValidUUID)
  const userIdsFromLeaderboard = (leaderboardResult.data?.perPerson?.map((p: { userId: string }) => p.userId) || []).filter(isValidUUID)
  const userIdsFromAssignments = allAssignments.flatMap((a: { assigned_to: string; assigned_by: string }) => [a.assigned_to, a.assigned_by]).filter(isValidUUID)
  const userIdsFromMembers = members.map((m: { user_id: string }) => m.user_id).filter(isValidUUID)
  const uniqueUserIds = [...new Set([...userIdsFromOutings, ...userIdsFromLeaderboard, ...userIdsFromAssignments, ...userIdsFromMembers])]
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

  // Transform assignment stats for the component
  const assignmentStatsData = assignmentStatsResult?.data ? {
    perPerson: assignmentStatsResult.data.perPerson.map((p: { userId: string; assigned: number; completed: number; completionRate: number }) => ({
      userId: p.userId,
      assigned: p.assigned,
      completed: p.completed,
      rate: p.completionRate,
    })),
    perDay: assignmentStatsResult.data.perDay.map((d: { date: string; assigned: number; completed: number }) => ({
      date: d.date,
      assigned: d.assigned,
      completed: d.completed,
      delta: d.completed - d.assigned,
    })),
    totalAssigned: assignmentStatsResult.data.totalAssigned,
    totalCompleted: assignmentStatsResult.data.totalCompleted,
    completionRate: assignmentStatsResult.data.totalAssigned > 0
      ? Math.round((assignmentStatsResult.data.totalCompleted / assignmentStatsResult.data.totalAssigned) * 100)
      : 0,
  } : null

  // Prepare animal options for assignment panel
  const animalOptions = priorityAnimals.map((a: { id: string; name: string; species: string }) => ({
    id: a.id,
    name: a.name,
    species: a.species,
  }))

  // Prepare member info for assignment panel
  const memberInfos = members.map((m: { user_id: string; full_name?: string | null; email?: string; pseudo: string | null }) => ({
    user_id: m.user_id,
    full_name: m.full_name ?? null,
    email: m.email,
    pseudo: m.pseudo,
  }))

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

      {/* Explanatory note */}
      <div className="flex gap-3 p-4 mb-6 bg-info/5 border border-info/20 rounded-xl">
        <Info className="w-5 h-5 text-info shrink-0 mt-0.5" />
        <div className="text-sm text-muted">
          <p className="font-medium text-text mb-1">Qu&apos;est-ce qu&apos;une sortie ?</p>
          <p>
            Une sortie correspond a une promenade <strong>a l&apos;exterieur du refuge</strong> ou dans un <strong>fouloir</strong> (espace cloture de detente),
            d&apos;une duree <strong>minimale de 15 minutes</strong>. En dessous de cette duree, l&apos;activite n&apos;est pas comptabilisee comme une sortie.
          </p>
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

      {/* Stats cards (top, always visible on promenades) */}
      {view === 'promenades' && (
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
      )}

      {/* Tab content — Promenades */}
      {view === 'promenades' && (
        <>
          {/* 1. My daily assignments (all users) */}
          <MyDailyAssignments assignments={myAssignments} canManageOutings={canManageOutings} />

          {/* 2. Assignment panel (managers/admin only) */}
          {canManageAssignments && (
            <div className="mb-6">
              <AssignmentPanel
                assignments={allAssignments}
                members={memberInfos}
                animals={animalOptions}
                userNames={userNames}
              />
            </div>
          )}

          {/* 3. History */}
          <OutingHistory outings={outings} userNames={userNames} isAdmin={isAdmin} currentUserId={currentUserId} />

          {/* 4. Priority list */}
          <OutingPriorityList animals={sortedPriorityAnimals} canManageOutings={canManageOutings} canCreateTig={canManageAssignments || isAdmin} />
        </>
      )}

      {/* Tab content — Statistiques */}
      {view === 'statistiques' && (
        <>
          {leaderboardResult.data && (
            <OutingStats
              perPerson={leaderboardResult.data.perPerson}
              perAnimal={leaderboardResult.data.perAnimal}
              dailyTrend={leaderboardResult.data.dailyTrend}
              weeklyTrend={leaderboardResult.data.weeklyTrend}
              monthlyTrend={leaderboardResult.data.monthlyTrend}
              totalDuration={leaderboardResult.data.totalDuration}
              totalOutings={leaderboardResult.data.totalOutings}
              avgDuration={leaderboardResult.data.avgDuration}
              tigTotal={leaderboardResult.data.tigTotal}
              userNames={userNames}
            />
          )}

          {/* Assignment stats (managers/admin only) */}
          {canManageAssignments && assignmentStatsData && (
            <div className="mt-6">
              <h2 className="text-lg font-semibold mb-4">Assignations</h2>
              <AssignmentStats
                perPerson={assignmentStatsData.perPerson}
                perDay={assignmentStatsData.perDay}
                totalAssigned={assignmentStatsData.totalAssigned}
                totalCompleted={assignmentStatsData.totalCompleted}
                completionRate={assignmentStatsData.completionRate}
                userNames={userNames}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
