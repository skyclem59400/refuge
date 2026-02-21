'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createDonation, updateDonation } from '@/lib/actions/donations'
import type { Donation, DonationPaymentMethod, DonationNature } from '@/lib/types/database'

interface DonationFormProps {
  donation?: Donation
}

const paymentMethods: { value: DonationPaymentMethod; label: string }[] = [
  { value: 'cheque', label: 'Cheque' },
  { value: 'virement', label: 'Virement bancaire' },
  { value: 'especes', label: 'Especes' },
  { value: 'cb', label: 'Carte bancaire' },
  { value: 'prelevement', label: 'Prelevement' },
  { value: 'autre', label: 'Autre' },
]

export function DonationForm({ donation }: DonationFormProps) {
  const isEdit = !!donation
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [donorName, setDonorName] = useState(donation?.donor_name || '')
  const [donorEmail, setDonorEmail] = useState(donation?.donor_email || '')
  const [donorPhone, setDonorPhone] = useState(donation?.donor_phone || '')
  const [donorAddress, setDonorAddress] = useState(donation?.donor_address || '')
  const [donorPostalCode, setDonorPostalCode] = useState(donation?.donor_postal_code || '')
  const [donorCity, setDonorCity] = useState(donation?.donor_city || '')
  const [amount, setAmount] = useState(donation?.amount?.toString() || '')
  const [date, setDate] = useState(donation?.date || new Date().toISOString().split('T')[0])
  const [paymentMethod, setPaymentMethod] = useState<DonationPaymentMethod>(donation?.payment_method || 'cheque')
  const [nature, setNature] = useState<DonationNature>(donation?.nature || 'numeraire')
  const [notes, setNotes] = useState(donation?.notes || '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!donorName.trim()) {
      toast.error('Le nom du donateur est obligatoire')
      return
    }
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('Le montant doit etre superieur a 0')
      return
    }

    const formData = {
      donor_name: donorName.trim(),
      donor_email: donorEmail.trim() || null,
      donor_phone: donorPhone.trim() || null,
      donor_address: donorAddress.trim() || null,
      donor_postal_code: donorPostalCode.trim() || null,
      donor_city: donorCity.trim() || null,
      amount: parsedAmount,
      date,
      payment_method: paymentMethod,
      nature,
      notes: notes.trim() || null,
    }

    startTransition(async () => {
      const result = isEdit
        ? await updateDonation(donation.id, formData)
        : await createDonation(formData)

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(isEdit ? 'Don modifie' : 'Don enregistre')
        router.push('/donations')
        router.refresh()
      }
    })
  }

  const inputClass = 'w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50'
  const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5'

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Donor info section */}
      <div className="bg-surface rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted mb-4">
          Informations du donateur
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className={labelClass}>Nom / Raison sociale *</label>
            <input
              type="text"
              value={donorName}
              onChange={(e) => setDonorName(e.target.value)}
              required
              placeholder="Nom complet ou raison sociale"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Email</label>
            <input
              type="email"
              value={donorEmail}
              onChange={(e) => setDonorEmail(e.target.value)}
              placeholder="email@exemple.fr"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Telephone</label>
            <input
              type="tel"
              value={donorPhone}
              onChange={(e) => setDonorPhone(e.target.value)}
              placeholder="06 12 34 56 78"
              className={inputClass}
            />
          </div>

          <div className="md:col-span-2">
            <label className={labelClass}>Adresse</label>
            <input
              type="text"
              value={donorAddress}
              onChange={(e) => setDonorAddress(e.target.value)}
              placeholder="Rue, numero..."
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Code postal</label>
            <input
              type="text"
              value={donorPostalCode}
              onChange={(e) => setDonorPostalCode(e.target.value)}
              placeholder="59000"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Ville</label>
            <input
              type="text"
              value={donorCity}
              onChange={(e) => setDonorCity(e.target.value)}
              placeholder="Lille"
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Donation details section */}
      <div className="bg-surface rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted mb-4">
          Details du don
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Montant (EUR) *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              placeholder="0.00"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Date du don *</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Mode de paiement</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as DonationPaymentMethod)}
              className={inputClass}
            >
              {paymentMethods.map((pm) => (
                <option key={pm.value} value={pm.value}>{pm.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Nature du don</label>
            <select
              value={nature}
              onChange={(e) => setNature(e.target.value as DonationNature)}
              className={inputClass}
            >
              <option value="numeraire">Numeraire (argent)</option>
              <option value="nature">En nature</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className={labelClass}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes complementaires..."
              rows={3}
              className={`${inputClass} resize-y`}
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-surface-hover transition-colors"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="gradient-primary hover:opacity-90 transition-opacity text-white px-6 py-2 rounded-lg font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? 'Enregistrement...' : isEdit ? 'Modifier le don' : 'Enregistrer le don'}
        </button>
      </div>
    </form>
  )
}
