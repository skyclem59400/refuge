import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Wallet } from 'lucide-react'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { PaymentEntryForm } from '@/components/payments/payment-entry-form'

export default async function NewReglementPage() {
  const ctx = await getEstablishmentContext()
  if (!ctx) return null
  if (!ctx.permissions.canManageDocuments) redirect('/dashboard')

  return (
    <div className="animate-fade-up max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/reglements" className="text-muted hover:text-text transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2">
          <Wallet className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">Nouveau règlement</h1>
        </div>
      </div>
      <PaymentEntryForm />
    </div>
  )
}
