import { ArrowLeft, Heart } from 'lucide-react'
import Link from 'next/link'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { getDonation } from '@/lib/actions/donations'
import { DonationForm } from '@/components/donations/donation-form'
import type { Donation } from '@/lib/types/database'

export default async function NewDonationPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>
}) {
  const params = await searchParams
  const ctx = await getEstablishmentContext()

  let donation: Donation | undefined
  if (params.edit) {
    const result = await getDonation(params.edit)
    if (result.data) {
      donation = result.data
    }
  }

  const isEdit = !!donation

  return (
    <div className="animate-fade-up max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/donations"
          className="p-2 rounded-lg hover:bg-surface-hover transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Heart className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              {isEdit ? 'Modifier le don' : 'Nouveau don'}
            </h1>
            <p className="text-sm text-muted mt-1">
              {isEdit
                ? `Modification du don de ${donation?.donor_name}`
                : 'Enregistrer un nouveau don'}
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <DonationForm donation={donation} />
    </div>
  )
}
