import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { listElus } from '@/lib/actions/elus'
import { ElusListClient } from '@/components/elus/elus-list-client'

export const dynamic = 'force-dynamic'

export default async function ElusPage() {
  const ctx = await getEstablishmentContext()
  if (!ctx) redirect('/setup')
  if (!ctx.permissions.canManageEstablishment) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-display">Permissions insuffisantes</h1>
        <p className="text-muted mt-2">Seuls les administrateurs peuvent accéder à l&apos;annuaire des élus.</p>
      </div>
    )
  }

  const res = await listElus()
  if (res.error || !res.data) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-display">Annuaire des élus</h1>
        <p className="text-warning mt-4">Erreur de chargement : {res.error || 'inconnue'}</p>
      </div>
    )
  }

  return (
    <div className="animate-fade-up p-4 md:p-8 max-w-6xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display text-text">Annuaire des élus</h1>
          <p className="text-sm text-muted mt-1">
            Carnet d&apos;adresses des élus et décideurs institutionnels en contact avec la SDA. Actions rapides : envoi
            de mail avec ton/civilité pré-renseignés, ouverture des conventions liées.
          </p>
        </div>
        <Link
          href="/astreinte/elus/nouveau"
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Ajouter
        </Link>
      </div>

      <ElusListClient initialList={res.data} />
    </div>
  )
}
