import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { getMonthlySaisie } from '@/lib/actions/cra-saisie'
import { CraMemberView } from '@/components/cra/cra-member-view'

export const dynamic = 'force-dynamic'

export default async function CraMemberDetailPage(props: {
  params: Promise<{ year: string; month: string }>
}) {
  const params = await props.params
  const year = parseInt(params.year, 10)
  const month = parseInt(params.month, 10)

  const ctx = await getEstablishmentContext()
  if (!ctx) throw new Error('Establishment context required')

  const { data, error } = await getMonthlySaisie(ctx.membership.id, year, month)
  if (error) throw new Error(error)
  if (!data) throw new Error('CRA introuvable')

  return (
    <div className="animate-fade-up max-w-4xl mx-auto">
      <Link
        href="/espace-collaborateur/cra"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-text mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour à la liste
      </Link>

      <CraMemberView view={data} />
    </div>
  )
}
