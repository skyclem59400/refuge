import { redirect } from 'next/navigation'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { getActivityLogs } from '@/lib/actions/activity-log'
import { getEstablishmentMembers } from '@/lib/actions/establishments'
import { ActivityLogList } from '@/components/establishment/activity-log-list'

export const dynamic = 'force-dynamic'

export default async function EtablissementLogsPage() {
  const ctx = await getEstablishmentContext()
  if (!ctx) redirect('/login')
  if (!ctx.permissions.isAdmin) redirect('/dashboard')

  const [activityResult, { data: members }] = await Promise.all([
    getActivityLogs({ limit: 1000 }),
    getEstablishmentMembers(),
  ])

  const activityLogs = activityResult.data || []
  const allUserNames: Record<string, string> = {}
  if (members) {
    for (const m of members) {
      allUserNames[m.user_id] = m.full_name || m.pseudo || m.email || m.user_id
    }
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Journal d&apos;activité</h1>
        <p className="text-sm text-muted mt-1">
          Toutes les actions tracées sur l&apos;établissement (1000 dernières). Visible par les administrateurs uniquement.
        </p>
      </div>

      <ActivityLogList logs={activityLogs} userNames={allUserNames} />
    </div>
  )
}
