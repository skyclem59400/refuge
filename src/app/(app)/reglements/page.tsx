import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Wallet, Plus } from 'lucide-react'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { getPaymentEntries, getPaymentStats } from '@/lib/actions/payment-entries'
import { PaymentEntriesClient } from '@/components/payments/payment-entries-client'

export default async function ReglementsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const ctx = await getEstablishmentContext()
  if (!ctx) return null

  const { canManageDocuments } = ctx.permissions
  if (!canManageDocuments) redirect('/dashboard')

  const params = await searchParams
  const year = params.year ? parseInt(params.year, 10) : new Date().getFullYear()

  const [entriesRes, statsRes] = await Promise.all([
    getPaymentEntries({ year }),
    getPaymentStats(year),
  ])

  const entries = entriesRes.data || []
  const stats = statsRes.data || { total: 0, byMethod: {}, byType: {}, count: 0 }

  return (
    <div className="animate-fade-up">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Wallet className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Règlements</h1>
            <p className="text-sm text-muted mt-1">
              Saisies de règlement (pension, adoption, dons, fourrière)
            </p>
          </div>
        </div>
        <Link
          href="/reglements/nouveau"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white text-sm gradient-primary hover:opacity-90 transition-opacity shadow-lg shadow-primary/25"
        >
          <Plus className="w-4 h-4" />
          Nouveau règlement
        </Link>
      </div>

      <PaymentEntriesClient entries={entries} stats={stats} year={year} />
    </div>
  )
}
