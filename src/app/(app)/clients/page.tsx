import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ClientList } from '@/components/clients/client-list'
import type { Client } from '@/lib/types/database'

export default async function ClientsPage() {
  const supabase = await createClient()
  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .order('name')

  return (
    <div className="animate-fade-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-sm text-muted mt-1">Gerez votre base clients</p>
        </div>
        <Link
          href="/clients/nouveau"
          className="px-4 py-2 rounded-lg font-semibold text-white text-sm gradient-primary hover:opacity-90 transition-opacity shadow-lg shadow-primary/25"
        >
          + Nouveau client
        </Link>
      </div>

      <ClientList initialData={(clients as Client[]) || []} />
    </div>
  )
}
