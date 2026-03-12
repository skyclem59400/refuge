import { CalendarCheck } from 'lucide-react'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { getLeaveRequests, getLeaveTypes, getPendingCount } from '@/lib/actions/leaves'
import { createAdminClient } from '@/lib/supabase/server'
import { AdminLeavesView } from '@/components/leaves/admin-leaves-view'
import type { EstablishmentMember, LeaveRequest, LeaveType } from '@/lib/types/database'

export default async function AdminCongesPage() {
  const ctx = await getEstablishmentContext()
  if (!ctx) throw new Error('Establishment context required')

  if (!ctx.permissions.canManageLeaves) {
    throw new Error('Permissions insuffisantes')
  }

  // Fetch all data in parallel
  const admin = createAdminClient()
  const [requestsResult, typesResult, pendingResult, membersResult] = await Promise.all([
    getLeaveRequests(),
    getLeaveTypes(),
    getPendingCount(),
    admin
      .from('establishment_members')
      .select('*')
      .eq('establishment_id', ctx.establishment.id),
  ])

  const requests = (requestsResult.data || []) as LeaveRequest[]
  const leaveTypes = (typesResult.data || []) as LeaveType[]
  const pendingCount = (pendingResult.data ?? 0) as number
  const members = (membersResult.data || []) as EstablishmentMember[]

  // Enrich members with names from auth.users
  const userIds = members.map(m => m.user_id)
  if (userIds.length > 0) {
    const { data: usersInfo } = await admin.rpc('get_users_info', { user_ids: userIds })
    if (usersInfo && Array.isArray(usersInfo)) {
      for (const u of usersInfo) {
        const member = members.find(m => m.user_id === u.id)
        if (member) {
          member.full_name = u.full_name || null
          member.email = u.email || undefined
        }
      }
    }
  }

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <CalendarCheck className="w-6 h-6 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">Gestion des conges</h1>
              {pendingCount > 0 && (
                <span className="inline-flex items-center justify-center px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-500 text-white">
                  {pendingCount} en attente
                </span>
              )}
            </div>
            <p className="text-sm text-muted mt-1">Validation des demandes de conges</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <AdminLeavesView
        requests={requests}
        leaveTypes={leaveTypes}
        members={members}
        pendingCount={pendingCount}
      />
    </div>
  )
}
