import { Footprints, Calendar, TrendingUp, AlertTriangle, PawPrint } from 'lucide-react'
import { getOutings, getAnimalOutingPriority, getOutingStats } from '@/lib/actions/outings'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { createAdminClient } from '@/lib/supabase/server'
import { OutingPriorityList } from '@/components/outings/outing-priority-list'
import { OutingHistory } from '@/components/outings/outing-history'

export default async function SortiesPage() {
  const ctx = await getEstablishmentContext()
  const canManageOutings = ctx!.permissions.canManageOutings

  const [statsResult, priorityResult, outingsResult] = await Promise.all([
    getOutingStats(),
    getAnimalOutingPriority(),
    getOutings({ limit: 50 }),
  ])

  const stats = statsResult.data || { outingsToday: 0, outingsThisWeek: 0, totalActiveAnimals: 0 }
  const priorityAnimals = priorityResult.data || []
  const outings = outingsResult.data || []

  // Count animals needing a walk (3+ days or never)
  const animalsInNeed = priorityAnimals.filter(
    (a) => a.days_since_last_outing === null || a.days_since_last_outing >= 3
  ).length

  // Resolve user names for outing history
  const uniqueUserIds = [...new Set(outings.map((o: { walked_by: string }) => o.walked_by))]
  const userNames: Record<string, string> = {}

  if (uniqueUserIds.length > 0) {
    const admin = createAdminClient()
    const { data: usersInfo } = await admin.rpc('get_users_info', { user_ids: uniqueUserIds })
    if (usersInfo && Array.isArray(usersInfo)) {
      for (const u of usersInfo) {
        userNames[u.id] = u.raw_user_meta_data?.name || u.email || u.id
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
              Suivi des promenades et sorties des animaux
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
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
          <p className="text-xs text-muted mt-1">Animaux actifs</p>
        </div>
      </div>

      {/* Priority list */}
      <OutingPriorityList animals={priorityAnimals} canManageOutings={canManageOutings} />

      {/* History */}
      <OutingHistory outings={outings} userNames={userNames} canManageOutings={canManageOutings} />
    </div>
  )
}
