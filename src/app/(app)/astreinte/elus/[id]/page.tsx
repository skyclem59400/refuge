import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { getEluById } from '@/lib/actions/elus'
import { EluForm } from '@/components/elus/elu-form'

export const dynamic = 'force-dynamic'

export default async function EluEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getEstablishmentContext()
  if (!ctx) redirect('/setup')
  if (!ctx.permissions.isAdmin) {
    return <div className="p-8"><h1 className="text-2xl font-display">Permissions insuffisantes — accès admin uniquement.</h1></div>
  }

  const res = await getEluById(id)
  if (res.error || !res.data) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <Link href="/astreinte/elus" className="inline-flex items-center gap-1 text-sm text-muted hover:text-text">
          <ArrowLeft className="w-4 h-4" /> Retour
        </Link>
        <h1 className="text-2xl font-display mt-4">Élu introuvable</h1>
        <p className="text-muted mt-2">{res.error || 'Identifiant inconnu.'}</p>
      </div>
    )
  }

  const elu = res.data

  return (
    <div className="animate-fade-up p-4 md:p-8 max-w-3xl mx-auto">
      <Link href="/astreinte/elus" className="inline-flex items-center gap-1 text-sm text-muted hover:text-text mb-4">
        <ArrowLeft className="w-4 h-4" /> Retour à l&apos;annuaire
      </Link>
      <h1 className="text-2xl md:text-3xl font-display text-text mb-1">
        {elu.civility ? `${elu.civility} ` : ''}{elu.first_name} {elu.last_name}
      </h1>
      <p className="text-sm text-muted mb-6">{elu.role}{elu.collectivity_name ? ` · ${elu.collectivity_name}` : ''}</p>
      <EluForm mode="edit" initial={elu} />
    </div>
  )
}
