import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { EluForm } from '@/components/elus/elu-form'

export const dynamic = 'force-dynamic'

export default async function NouvelEluPage() {
  const ctx = await getEstablishmentContext()
  if (!ctx) redirect('/setup')
  if (!ctx.permissions.isAdmin) {
    return <div className="p-8"><h1 className="text-2xl font-display">Permissions insuffisantes — accès admin uniquement.</h1></div>
  }

  return (
    <div className="animate-fade-up p-4 md:p-8 max-w-3xl mx-auto">
      <Link href="/astreinte/elus" className="inline-flex items-center gap-1 text-sm text-muted hover:text-text mb-4">
        <ArrowLeft className="w-4 h-4" /> Retour à l&apos;annuaire
      </Link>
      <h1 className="text-2xl md:text-3xl font-display text-text mb-6">Ajouter un élu</h1>
      <EluForm mode="create" />
    </div>
  )
}
