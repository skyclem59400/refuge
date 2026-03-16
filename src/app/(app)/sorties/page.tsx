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

type HasOutingPriority = { days_since_last_outing: number | null }

function sortByOutingPriority<T extends HasOutingPriority>(animals: T[]): T[] {
  return [...animals].sort((a, b) => {
    const aToday = a.days_since_last_outing === 0
    const bToday = b.days_since_last_outing === 0
    if (aToday !== bToday) return aToday ? 1 : -1

    const aNull = a.days_since_last_outing === null
    const bNull = b.days_since_last_outing === null
    if (aNull !== bNull) return aNull ? -1 : 1

    return (b.days_since_last_outing ?? 0) - (a.days_since_last_outing ?? 0)
  })
}

function countAnimalsInNeed(animals: HasOutingPriority[]): number {
  return animals.filter(
    (a) => a.days_since_last_outing === null || a.days_since_last_outing >= 3
  ).length
}

const isValidUUID = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

function collectUserIds(
  outings: { walked_by: string }[],
  leaderboardData: { perPerson?: { userId: string }[] } | null | undefined,
  allAssignments: { assigned_to: string; assigned_by: string }[],
  members: { user_id: string }[]
): string[] {
  const userIdsFromOutings = outings.map((o) => o.walked_by).filter(isValidUUID)
  const userIdsFromLeaderboard = (leaderboardData?.perPerson?.map((p) => p.userId) || []).filter(isValidUUID)
  const userIdsFromAssignments = allAssignments.flatMap((a) => [a.assigned_to, a.assigned_by]).filter(isValidUUID)
  const userIdsFromMembers = members.map((m) => m.user_id).filter(isValidUUID)
  return [...new Set([...userIdsFromOutings, ...userIdsFromLeaderboard, ...userIdsFromAssignments, ...userIdsFromMembers])]
}

async function resolveUserNames(userIds: string[]): Promise<Record<string, string>> {
  const names: Record<string, string> = {}
  if (userIds.length === 0) return names

  const admin = createAdminClient()
  const { data: usersInfo } = await admin.rpc('get_users_info', { user_ids: userIds })
  if (usersInfo && Array.isArray(usersInfo)) {
    for (const u of usersInfo) {
      names[u.id] = u.full_name || u.email || u.id
    }
  }
  return names
}

function transformAssignmentStats(
  raw: { perPerson: { userId: string; assigned: number; completed: number; completionRate: number }[]; perDay: { date: string; assigned: number; completed: number }[]; totalAssigned: number; totalCompleted: number } | null
) {
  if (!raw) return null
  return {
    perPerson: raw.perPerson.map((p) => ({
      userId: p.userId,
      assigned: p.assigned,
      completed: p.completed,
      rate: p.completionRate,
    })),
    perDay: raw.perDay.map((d) => ({
      date: d.date,
      assigned: d.assigned,
      completed: d.completed,
      delta: d.completed - d.assigned,
    })),
    totalAssigned: raw.totalAssigned,
    totalCompleted: raw.totalCompleted,
    completionRate: raw.totalAssigned > 0
      ? Math.round((raw.totalCompleted / raw.totalAssigned) * 100)
      : 0,
  }
}

// ---------------------------------------------------------------------------
// Data fetching helper -- gathers all parallel data for the page
// ---------------------------------------------------------------------------

async function fetchPageData(view: ViewKey, canManageAssignments: boolean, page: number = 1) {
  const isPromenades = view === 'promenades'
  const isStatistiques = view === 'statistiques'
  const offset = (page - 1) * OUTINGS_PER_PAGE

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
    isPromenades ? getAnimalOutingPriority() : Promise.resolve({ data: [] }),
    isPromenades ? getOutings({ limit: OUTINGS_PER_PAGE, offset }) : Promise.resolve({ data: [], count: 0 }),
    isStatistiques ? getOutingLeaderboard() : Promise.resolve({ data: null }),
    isPromenades ? getAssignments() : Promise.resolve({ data: [] }),
    isStatistiques && canManageAssignments ? getAssignmentStats() : Promise.resolve({ data: null }),
    isPromenades && canManageAssignments ? getEstablishmentMembers() : Promise.resolve({ data: [] }),
  ])

  return {
    statsResult,
    priorityResult,
    outingsResult,
    leaderboardResult,
    assignmentsResult,
    assignmentStatsResult,
    membersResult,
  }
}

// ---------------------------------------------------------------------------
// Data processing helper -- transforms raw results into component-ready data
// ---------------------------------------------------------------------------

type MemberRow = { user_id: string; full_name?: string | null; email?: string; pseudo: string | null }

function processPageData(
  raw: Awaited<ReturnType<typeof fetchPageData>>,
  view: ViewKey,
  currentUserId: string,
) {
  const stats = raw.statsResult.data || { outingsToday: 0, outingsThisWeek: 0, totalActiveAnimals: 0 }
  const priorityAnimals = raw.priorityResult.data || []
  const outings = raw.outingsResult.data || []
  const totalOutingsCount = (raw.outingsResult as { count?: number }).count ?? 0
  const allAssignments = raw.assignmentsResult.data || []
  const myAssignments = allAssignments.filter((a: { assigned_to: string }) => a.assigned_to === currentUserId)
  const members = ((raw.membersResult as { data?: MemberRow[] }).data || [])

  const sortedPriorityAnimals = view === 'promenades'
    ? sortByOutingPriority(priorityAnimals)
    : priorityAnimals
  const animalsInNeed = view === 'promenades' ? countAnimalsInNeed(priorityAnimals) : 0

  const assignmentStatsData = transformAssignmentStats(raw.assignmentStatsResult?.data ?? null)

  const animalOptions = priorityAnimals.map((a: { id: string; name: string; species: string }) => ({
    id: a.id,
    name: a.name,
    species: a.species,
  }))

  const memberInfos = members.map((m) => ({
    user_id: m.user_id,
    full_name: m.full_name ?? null,
    email: m.email,
    pseudo: m.pseudo,
  }))

  return {
    stats,
    priorityAnimals,
    outings,
    totalOutingsCount,
    allAssignments,
    myAssignments,
    members,
    sortedPriorityAnimals,
    animalsInNeed,
    assignmentStatsData,
    animalOptions,
    memberInfos,
  }
}

// ---------------------------------------------------------------------------
// Sub-components for the two view tabs
// ---------------------------------------------------------------------------

function PromenadeStatsCards({ stats, animalsInNeed }: {
  stats: { outingsToday: number; outingsThisWeek: number; totalActiveAnimals: number }
  animalsInNeed: number
}) {
  return (
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
  )
}

function PromenadeViewContent({
  myAssignments,
  canManageOutings,
  canManageAssignments,
  allAssignments,
  memberInfos,
  animalOptions,
  userNames,
  outings,
  isAdmin,
  currentUserId,
  sortedPriorityAnimals,
  currentPage,
  totalPages,
}: {
  myAssignments: typeof allAssignments
  canManageOutings: boolean
  canManageAssignments: boolean
  allAssignments: ReturnType<typeof processPageData>['allAssignments']
  memberInfos: ReturnType<typeof processPageData>['memberInfos']
  animalOptions: ReturnType<typeof processPageData>['animalOptions']
  userNames: Record<string, string>
  outings: ReturnType<typeof processPageData>['outings']
  isAdmin: boolean
  currentUserId: string
  sortedPriorityAnimals: ReturnType<typeof processPageData>['sortedPriorityAnimals']
  currentPage: number
  totalPages: number
}) {
  return (
    <>
      <MyDailyAssignments assignments={myAssignments} canManageOutings={canManageOutings} />

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

      <OutingHistory outings={outings} userNames={userNames} isAdmin={isAdmin} canManageAssignments={canManageAssignments} currentUserId={currentUserId} currentPage={currentPage} totalPages={totalPages} />

      <OutingPriorityList animals={sortedPriorityAnimals} canManageOutings={canManageOutings} canCreateTig={canManageAssignments || isAdmin} />
    </>
  )
}

function StatistiquesViewContent({
  leaderboardData,
  userNames,
  canManageAssignments,
  assignmentStatsData,
}: {
  leaderboardData: Awaited<ReturnType<typeof getOutingLeaderboard>>['data'] | null
  userNames: Record<string, string>
  canManageAssignments: boolean
  assignmentStatsData: ReturnType<typeof transformAssignmentStats>
}) {
  return (
    <>
      {leaderboardData && (
        <OutingStats
          perPerson={leaderboardData.perPerson}
          perAnimal={leaderboardData.perAnimal}
          dailyTrend={leaderboardData.dailyTrend}
          weeklyTrend={leaderboardData.weeklyTrend}
          monthlyTrend={leaderboardData.monthlyTrend}
          totalDuration={leaderboardData.totalDuration}
          totalOutings={leaderboardData.totalOutings}
          avgDuration={leaderboardData.avgDuration}
          tigTotal={leaderboardData.tigTotal}
          userNames={userNames}
        />
      )}

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
  )
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

const OUTINGS_PER_PAGE = 15

export default async function SortiesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; page?: string }>
}) {
  const params = await searchParams
  const ctx = await getEstablishmentContext()
  if (!ctx) redirect('/login')

  const { canManageOutings, canManageOutingAssignments: canManageAssignments, isAdmin } = ctx.permissions
  const canViewStats = isAdmin || canManageAssignments
  const currentUserId = ctx.membership.user_id
  const view: ViewKey = params.view === 'statistiques' && canViewStats ? 'statistiques' : 'promenades'
  const currentPage = Math.max(1, parseInt(params.page || '1', 10) || 1)

  const raw = await fetchPageData(view, canManageAssignments, currentPage)
  const data = processPageData(raw, view, currentUserId)
  const totalPages = Math.max(1, Math.ceil(data.totalOutingsCount / OUTINGS_PER_PAGE))

  const uniqueUserIds = collectUserIds(data.outings, raw.leaderboardResult.data, data.allAssignments, data.members)
  const userNames = await resolveUserNames(uniqueUserIds)

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
        {views.filter((v) => v.key !== 'statistiques' || canViewStats).map((v) => (
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

      {view === 'promenades' && (
        <PromenadeStatsCards stats={data.stats} animalsInNeed={data.animalsInNeed} />
      )}

      {view === 'promenades' && (
        <PromenadeViewContent
          myAssignments={data.myAssignments}
          canManageOutings={canManageOutings}
          canManageAssignments={canManageAssignments}
          allAssignments={data.allAssignments}
          memberInfos={data.memberInfos}
          animalOptions={data.animalOptions}
          userNames={userNames}
          outings={data.outings}
          isAdmin={isAdmin}
          currentUserId={currentUserId}
          sortedPriorityAnimals={data.sortedPriorityAnimals}
          currentPage={currentPage}
          totalPages={totalPages}
        />
      )}

      {view === 'statistiques' && canViewStats && (
        <StatistiquesViewContent
          leaderboardData={raw.leaderboardResult.data}
          userNames={userNames}
          canManageAssignments={canManageAssignments}
          assignmentStatsData={data.assignmentStatsData}
        />
      )}
    </div>
  )
}
