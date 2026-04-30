import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, Wallet } from 'lucide-react'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { getPaymentEntry } from '@/lib/actions/payment-entries'
import { PaymentEntryForm } from '@/components/payments/payment-entry-form'

export default async function EditReglementPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getEstablishmentContext()
  if (!ctx) return null
  if (!ctx.permissions.canManageDocuments) redirect('/dashboard')

  const { id } = await params
  const result = await getPaymentEntry(id)
  if (!result.data) notFound()

  return (
    <div className="animate-fade-up max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/reglements" className="text-muted hover:text-text transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2">
          <Wallet className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">Modifier le règlement</h1>
        </div>
      </div>
      <PaymentEntryForm entry={result.data} />
    </div>
  )
}
