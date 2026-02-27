import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { getEstablishmentMembers, getUnassignedUsers, getInvitableUsers, getPermissionGroups } from '@/lib/actions/establishments'
import { EstablishmentForm } from '@/components/establishment/establishment-form'
import { PermissionGroups } from '@/components/establishment/permission-groups'
import { MembersList } from '@/components/establishment/members-list'
import { PendingUsersList } from '@/components/establishment/pending-users-list'
import { InviteMemberSearch } from '@/components/establishment/invite-member-search'

export default async function EtablissementPage() {
  const ctx = await getEstablishmentContext()
  if (!ctx || !ctx.permissions.canManageEstablishment) {
    redirect('/dashboard')
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: members },
    { data: pendingUsers },
    { data: invitableUsers },
    { data: permissionGroups },
  ] = await Promise.all([
    getEstablishmentMembers(),
    getUnassignedUsers(),
    getInvitableUsers(),
    getPermissionGroups(),
  ])

  return (
    <div className="animate-fade-up space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Etablissement</h1>
        <p className="text-sm text-muted mt-1">Gerez les informations, les groupes et les membres</p>
      </div>

      <EstablishmentForm establishment={ctx.establishment} />

      <PermissionGroups groups={permissionGroups || []} />

      <div className="bg-surface rounded-xl border border-border p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Membres</h2>
          <span className="text-xs text-muted bg-surface-dark px-2 py-1 rounded-lg">
            {members?.length || 0} membre{(members?.length || 0) > 1 ? 's' : ''}
          </span>
        </div>

        <MembersList
          members={members || []}
          groups={permissionGroups || []}
          currentUserId={user.id}
        />

        <div className="pt-2 border-t border-border">
          <div className="flex items-center justify-between mt-4 mb-3">
            <h3 className="text-sm font-semibold">Utilisateurs en attente</h3>
            {pendingUsers && pendingUsers.length > 0 && (
              <span className="text-xs text-amber-500 bg-amber-500/10 px-2 py-1 rounded-lg font-medium">
                {pendingUsers.length} en attente
              </span>
            )}
          </div>
          <PendingUsersList users={pendingUsers || []} groups={permissionGroups || []} />
        </div>

        <div className="pt-2 border-t border-border">
          <h3 className="text-sm font-semibold mt-4 mb-3">Inviter un utilisateur</h3>
          <InviteMemberSearch users={invitableUsers || []} groups={permissionGroups || []} />
        </div>
      </div>
    </div>
  )
}
