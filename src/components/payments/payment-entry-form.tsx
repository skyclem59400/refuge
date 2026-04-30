'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createPaymentEntry, updatePaymentEntry } from '@/lib/actions/payment-entries'
import { searchClientsByCategory } from '@/lib/actions/clients'
import type {
  PaymentEntry,
  PaymentEntryMethod,
  PaymentEntryType,
  PaymentEntryInstallment,
  Client,
} from '@/lib/types/database'

const METHODS: { value: PaymentEntryMethod; label: string }[] = [
  { value: 'cheque', label: 'Chèque' },
  { value: 'virement', label: 'Virement bancaire' },
  { value: 'especes', label: 'Espèces' },
  { value: 'cb', label: 'Carte bancaire' },
  { value: 'prelevement', label: 'Prélèvement' },
  { value: 'helloasso', label: 'HelloAsso' },
  { value: 'autre', label: 'Autre' },
]

const TYPES: { value: PaymentEntryType; label: string }[] = [
  { value: 'pension', label: 'Pension' },
  { value: 'adoption', label: 'Adoption' },
  { value: 'don', label: 'Don' },
  { value: 'fourriere', label: 'Fourrière' },
  { value: 'autre', label: 'Autre' },
]

const INSTALLMENTS: { value: PaymentEntryInstallment; label: string }[] = [
  { value: 'total', label: 'Total' },
  { value: 'acompte', label: 'Acompte' },
  { value: 'solde', label: 'Solde' },
]

interface PaymentEntryFormProps {
  entry?: PaymentEntry
}

type ClientSearchResult = Pick<Client, 'id' | 'name' | 'email' | 'phone' | 'city'>

export function PaymentEntryForm({ entry }: Readonly<PaymentEntryFormProps>) {
  const isEdit = !!entry
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [amount, setAmount] = useState(entry?.amount?.toString() || '')
  const [paymentDate, setPaymentDate] = useState(entry?.payment_date || new Date().toISOString().split('T')[0])
  const [method, setMethod] = useState<PaymentEntryMethod>(entry?.method || 'cheque')
  const [paymentType, setPaymentType] = useState<PaymentEntryType>(entry?.payment_type || 'pension')
  const [installment, setInstallment] = useState<PaymentEntryInstallment>(entry?.installment || 'total')
  const [payerName, setPayerName] = useState(entry?.payer_name || '')
  const [payerPhone, setPayerPhone] = useState(entry?.payer_phone || '')
  const [payerEmail, setPayerEmail] = useState(entry?.payer_email || '')
  const [reference, setReference] = useState(entry?.reference || '')
  const [notes, setNotes] = useState(entry?.notes || '')
  const [clientId, setClientId] = useState<string | null>(entry?.related_client_id || null)
  const [clientSearch, setClientSearch] = useState('')
  const [clientResults, setClientResults] = useState<ClientSearchResult[]>([])

  // Client search
  useEffect(() => {
    if (clientSearch.trim().length < 2) {
      setClientResults([])
      return
    }
    const timer = setTimeout(async () => {
      const res = await searchClientsByCategory('client', clientSearch)
      if (res.data) setClientResults(res.data.slice(0, 5))
    }, 250)
    return () => clearTimeout(timer)
  }, [clientSearch])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = parseFloat(amount)
    if (isNaN(parsed) || parsed <= 0) {
      toast.error('Montant invalide')
      return
    }

    startTransition(async () => {
      const data = {
        amount: parsed,
        payment_date: paymentDate,
        method,
        payment_type: paymentType,
        installment,
        payer_name: payerName.trim() || null,
        payer_phone: payerPhone.trim() || null,
        payer_email: payerEmail.trim() || null,
        reference: reference.trim() || null,
        notes: notes.trim() || null,
        related_client_id: clientId || null,
      }

      const res = isEdit
        ? await updatePaymentEntry(entry!.id, data)
        : await createPaymentEntry(data)

      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(isEdit ? 'Règlement modifié' : 'Règlement enregistré')
        router.push('/reglements')
        router.refresh()
      }
    })
  }

  const inputClass = 'w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50'
  const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5'

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      <div className="bg-surface rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted mb-4">Règlement</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="pe-amount" className={labelClass}>Montant (€) *</label>
            <input
              id="pe-amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="pe-date" className={labelClass}>Date *</label>
            <input
              id="pe-date"
              type="date"
              required
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="pe-type" className={labelClass}>Type *</label>
            <select
              id="pe-type"
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value as PaymentEntryType)}
              className={inputClass}
              required
            >
              {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="pe-method" className={labelClass}>Mode de règlement *</label>
            <select
              id="pe-method"
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentEntryMethod)}
              className={inputClass}
              required
            >
              {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="pe-installment" className={labelClass}>Acompte / Solde *</label>
            <select
              id="pe-installment"
              value={installment}
              onChange={(e) => setInstallment(e.target.value as PaymentEntryInstallment)}
              className={inputClass}
              required
            >
              {INSTALLMENTS.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="pe-reference" className={labelClass}>Référence</label>
            <input
              id="pe-reference"
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="N° chèque, ref. virement..."
              className={inputClass}
            />
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted mb-4">Payeur</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="pe-payer-name" className={labelClass}>Nom</label>
            <input
              id="pe-payer-name"
              type="text"
              value={payerName}
              onChange={(e) => setPayerName(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="pe-payer-phone" className={labelClass}>Téléphone</label>
            <input
              id="pe-payer-phone"
              type="tel"
              value={payerPhone}
              onChange={(e) => setPayerPhone(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="pe-payer-email" className={labelClass}>Email</label>
            <input
              id="pe-payer-email"
              type="email"
              value={payerEmail}
              onChange={(e) => setPayerEmail(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="pe-client" className={labelClass}>Lier à un contact existant (optionnel)</label>
          <input
            id="pe-client"
            type="text"
            value={clientSearch}
            onChange={(e) => {
              setClientSearch(e.target.value)
              if (!e.target.value) setClientId(null)
            }}
            placeholder="Rechercher un contact..."
            className={inputClass}
          />
          {clientResults.length > 0 && (
            <ul className="mt-1 border border-border rounded-lg max-h-48 overflow-y-auto bg-surface">
              {clientResults.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setClientId(c.id)
                      setClientSearch(c.name)
                      setPayerName(c.name)
                      if (c.phone) setPayerPhone(c.phone)
                      if (c.email) setPayerEmail(c.email)
                      setClientResults([])
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-surface-hover"
                  >
                    {c.name}
                    {c.city && <span className="text-muted text-xs ml-2">{c.city}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {clientId && (
            <p className="text-xs text-success mt-1">✓ Contact lié</p>
          )}
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-border p-5">
        <label htmlFor="pe-notes" className={labelClass}>Notes</label>
        <textarea
          id="pe-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className={`${inputClass} resize-y`}
          placeholder="Détails complémentaires..."
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-3 rounded-lg text-sm font-medium text-muted border border-border hover:bg-surface-dark transition-colors"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 py-3 rounded-lg font-semibold text-white text-sm gradient-primary hover:opacity-90 transition-opacity disabled:opacity-50 shadow-lg shadow-primary/25"
        >
          {isPending ? 'Enregistrement...' : (isEdit ? 'Mettre à jour' : 'Enregistrer le règlement')}
        </button>
      </div>
    </form>
  )
}
