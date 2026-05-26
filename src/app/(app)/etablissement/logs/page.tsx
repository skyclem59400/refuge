import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { getActivityLogs } from '@/lib/actions/activity-log'
import { getEstablishmentMembers } from '@/lib/actions/establishments'
import { ActivityLogList, type MemberKind } from '@/components/establishment/activity-log-list'

export const dynamic = 'force-dynamic'

export default async function EtablissementLogsPage() {
  const ctx = await getEstablishmentContext()
  if (!ctx) redirect('/login')
  if (!ctx.permissions.isAdmin) redirect('/dashboard')

  const admin = createAdminClient()

  const [activityResult, { data: members }, animalsRes, clientsRes] = await Promise.all([
    getActivityLogs({ limit: 1000 }),
    getEstablishmentMembers(),
    admin
      .from('animals')
      .select('id, name')
      .eq('establishment_id', ctx.establishment.id)
      .limit(5000),
    admin
      .from('clients')
      .select('id, name, first_name')
      .eq('establishment_id', ctx.establishment.id)
      .limit(5000),
  ])

  const activityLogs = activityResult.data || []
  const allUserNames: Record<string, string> = {}
  const allUserKinds: Record<string, MemberKind> = {}
  const parentNames: Record<string, string> = {}

  if (members) {
    for (const m of members) {
      allUserNames[m.user_id] = m.full_name || m.pseudo || m.email || m.user_id
      // Mapping parent_id (member.id, pas user_id) -> nom pour les CRA/astreintes/horaires
      parentNames[m.id] = m.full_name || m.pseudo || m.email || m.id
      // Priorite : si role_type === 'admin' on filtre comme admin, sinon contract_type
      allUserKinds[m.user_id] = m.role_type === 'admin' ? 'admin' : (m.contract_type as MemberKind)
    }
  }

  for (const a of (animalsRes.data || []) as Array<{ id: string; name: string }>) {
    parentNames[a.id] = a.name
  }
  for (const c of (clientsRes.data || []) as Array<{ id: string; name: string; first_name: string | null }>) {
    parentNames[c.id] = c.first_name ? `${c.first_name} ${c.name}` : c.name
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Journal d&apos;activité</h1>
        <p className="text-sm text-muted mt-1">
          Toutes les actions tracées sur l&apos;établissement (1000 dernières). Visible par les administrateurs uniquement.
        </p>
      </div>

      <ActivityLogList
        logs={activityLogs}
        userNames={allUserNames}
        userKinds={allUserKinds}
        parentNames={parentNames}
      />
    </div>
  )
}
