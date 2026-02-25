import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/server'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { ClientList } from '@/components/clients/client-list'
import type { Client } from '@/lib/types/database'

export default async function ClientsPage() {
  const ctx = await getEstablishmentContext()
  const estabId = ctx!.establishment.id
  const admin = createAdminClient()

  const { data: clients } = await admin
    .from('clients')
    .select('*')
    .eq('establishment_id', estabId)
    .order('name')

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

      <ClientList
        initialData={(clients as Client[]) || []}
        canEdit={ctx!.permissions.canManageClients}
        establishmentId={estabId}
      />
    </div>
  )
}
