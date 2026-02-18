import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { getEstablishmentMembers } from '@/lib/actions/establishments'
import { EstablishmentForm } from '@/components/establishment/establishment-form'
import { MembersList } from '@/components/establishment/members-list'
import { AddMemberForm } from '@/components/establishment/add-member-form'

export default async function EtablissementPage() {
  const ctx = await getEstablishmentContext()
  if (!ctx || !ctx.permissions.canManageEstablishment) {
    redirect('/dashboard')
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: members } = await getEstablishmentMembers()

  return (
    <div className="animate-fade-up space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Etablissement</h1>
        <p className="text-sm text-muted mt-1">Gerez les informations et les membres</p>
      </div>

      <EstablishmentForm establishment={ctx.establishment} />

      <div className="bg-surface rounded-xl border border-border p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Membres</h2>
          <span className="text-xs text-muted bg-surface-dark px-2 py-1 rounded-lg">
            {members?.length || 0} membre{(members?.length || 0) > 1 ? 's' : ''}
          </span>
        </div>

        <MembersList members={members || []} currentUserId={user.id} />

        <div className="pt-2 border-t border-border">
          <h3 className="text-sm font-semibold mb-3 mt-4">Ajouter un membre</h3>
          <AddMemberForm />
        </div>
      </div>
    </div>
  )
}
