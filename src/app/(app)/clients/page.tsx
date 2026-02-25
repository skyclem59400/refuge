import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/server'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { getEstablishmentMembers } from '@/lib/actions/establishments'
import { RepertoireTabs } from '@/components/clients/repertoire-tabs'
import type { Client } from '@/lib/types/database'

export default async function ClientsPage() {
  const ctx = await getEstablishmentContext()
  const estabId = ctx!.establishment.id
  const admin = createAdminClient()

  const [{ data: clients }, { data: members }] = await Promise.all([
    admin
      .from('clients')
      .select('*')
      .eq('establishment_id', estabId)
      .order('name'),
    getEstablishmentMembers(),
  ])

  return (
    <div className="animate-fade-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Répertoire</h1>
          <p className="text-sm text-muted mt-1">Gérez vos contacts</p>
        </div>
        {ctx!.permissions.canManageClients && (
          <Link
            href="/clients/nouveau"
            className="px-4 py-2 rounded-lg font-semibold text-white text-sm gradient-primary hover:opacity-90 transition-opacity shadow-lg shadow-primary/25"
          >
            + Nouveau contact
          </Link>
        )}
      </div>

      <RepertoireTabs
        clients={(clients as Client[]) || []}
        members={members || []}
        canEdit={ctx!.permissions.canManageClients}
        establishmentId={estabId}
      />
    </div>
  )
}
