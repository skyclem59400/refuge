'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { deleteDonation, generateCerfa } from '@/lib/actions/donations'
import { formatCurrency, formatDateShort } from '@/lib/utils'
import type { Donation } from '@/lib/types/database'
import { Trash2, FileText, Download, Plus } from 'lucide-react'

interface DonationListProps {
  donations: Donation[]
  canManage: boolean
}

const paymentMethodLabels: Record<string, string> = {
  cheque: 'Cheque',
  virement: 'Virement',
  especes: 'Especes',
  cb: 'CB',
  prelevement: 'Prelevement',
  autre: 'Autre',
}

export function DonationList({ donations, canManage }: DonationListProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [pendingAction, setPendingAction] = useState<string | null>(null)

  function handleDelete(id: string, donorName: string) {
    if (!confirm(`Supprimer le don de ${donorName} ?`)) return

    setPendingAction(id + '-delete')
    startTransition(async () => {
      const result = await deleteDonation(id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Don supprime')
        router.refresh()
      }
      setPendingAction(null)
    })
  }

  function handleGenerateCerfa(id: string) {
    setPendingAction(id + '-cerfa')
    startTransition(async () => {
      const result = await generateCerfa(id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Recu CERFA ${result.data?.cerfa_number} genere`)
        router.refresh()
      }
      setPendingAction(null)
    })
  }

  if (donations.length === 0) {
    return (
      <div className="bg-surface rounded-xl border border-border p-8 text-center">
        <FileText className="w-10 h-10 text-muted mx-auto mb-3" />
        <p className="text-muted text-sm">Aucun don enregistre</p>
        {canManage && (
          <Link
            href="/donations/nouveau"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg font-semibold text-white text-sm gradient-primary hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Enregistrer un don
          </Link>
        )}
      </div>
    )
  }

  return (
    <div className="bg-surface rounded-xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 font-semibold text-muted">Donateur</th>
              <th className="px-4 py-3 font-semibold text-muted text-right">Montant</th>
              <th className="px-4 py-3 font-semibold text-muted">Date</th>
              <th className="px-4 py-3 font-semibold text-muted">Paiement</th>
              <th className="px-4 py-3 font-semibold text-muted">CERFA</th>
              <th className="px-4 py-3 font-semibold text-muted text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {donations.map((donation) => (
              <tr key={donation.id} className="hover:bg-surface-hover transition-colors">
                {/* Donor */}
                <td className="px-4 py-3">
                  <div className="font-medium">{donation.donor_name}</div>
                  {donation.donor_email && (
                    <div className="text-xs text-muted">{donation.donor_email}</div>
                  )}
                </td>

                {/* Amount */}
                <td className="px-4 py-3 text-right font-semibold text-primary">
                  {formatCurrency(Number(donation.amount))}
                </td>

                {/* Date */}
                <td className="px-4 py-3 text-muted">
                  {formatDateShort(donation.date)}
                </td>

                {/* Payment method */}
                <td className="px-4 py-3">
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-info/15 text-info">
                    {paymentMethodLabels[donation.payment_method] || donation.payment_method}
                  </span>
                </td>

                {/* CERFA */}
                <td className="px-4 py-3">
                  {donation.cerfa_generated && donation.cerfa_number ? (
                    <div className="flex items-center gap-2">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-success/15 text-success">
                        {donation.cerfa_number}
                      </span>
                      <a
                        href={`/api/pdf/cerfa/${donation.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary-light transition-colors"
                        title="Telecharger le recu CERFA"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  ) : canManage ? (
                    <button
                      onClick={() => handleGenerateCerfa(donation.id)}
                      disabled={isPending && pendingAction === donation.id + '-cerfa'}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                    >
                      <FileText className="w-3 h-3" />
                      {pendingAction === donation.id + '-cerfa' ? 'Generation...' : 'Generer CERFA'}
                    </button>
                  ) : (
                    <span className="text-muted/50">&mdash;</span>
                  )}
                </td>

                {/* Actions */}
                <td className="px-4 py-3 text-right">
                  {canManage && (
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/donations/nouveau?edit=${donation.id}`}
                        className="text-muted hover:text-primary transition-colors"
                        title="Modifier"
                      >
                        <FileText className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => handleDelete(donation.id, donation.donor_name)}
                        disabled={isPending && pendingAction === donation.id + '-delete'}
                        className="text-muted hover:text-error transition-colors disabled:opacity-50"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
