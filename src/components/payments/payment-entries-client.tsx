'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2, Pencil, FileText, PawPrint } from 'lucide-react'
import { deletePaymentEntry } from '@/lib/actions/payment-entries'
import { formatCurrency } from '@/lib/utils'
import type { PaymentEntryWithRelations, PaymentEntryMethod, PaymentEntryType } from '@/lib/types/database'

const METHOD_LABELS: Record<PaymentEntryMethod, string> = {
  cheque: 'Chèque',
  virement: 'Virement',
  especes: 'Espèces',
  cb: 'CB',
  prelevement: 'Prélèvement',
  helloasso: 'HelloAsso',
  autre: 'Autre',
}

const TYPE_LABELS: Record<PaymentEntryType, string> = {
  pension: 'Pension',
  adoption: 'Adoption',
  don: 'Don',
  fourriere: 'Fourrière',
  autre: 'Autre',
}

const TYPE_COLORS: Record<PaymentEntryType, string> = {
  pension: 'bg-blue-500/15 text-blue-500',
  adoption: 'bg-pink-500/15 text-pink-500',
  don: 'bg-green-500/15 text-green-500',
  fourriere: 'bg-orange-500/15 text-orange-500',
  autre: 'bg-muted/15 text-muted',
}

interface Props {
  entries: PaymentEntryWithRelations[]
  stats: { total: number; byMethod: Record<string, number>; byType: Record<string, number>; count: number }
  year: number
}

export function PaymentEntriesClient({ entries, stats, year }: Readonly<Props>) {
  const router = useRouter()
  const [filterType, setFilterType] = useState<PaymentEntryType | 'all'>('all')
  const [filterMethod, setFilterMethod] = useState<PaymentEntryMethod | 'all'>('all')

  const filtered = entries.filter((e) => {
    if (filterType !== 'all' && e.payment_type !== filterType) return false
    if (filterMethod !== 'all' && e.method !== filterMethod) return false
    return true
  })

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce règlement ?')) return
    const res = await deletePaymentEntry(id)
    if (res.error) toast.error(res.error)
    else {
      toast.success('Règlement supprimé')
      router.refresh()
    }
  }

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

  return (
    <div className="space-y-6">
      {/* Year picker */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">Année :</span>
        {years.map((y) => (
          <Link
            key={y}
            href={`/reglements?year=${y}`}
            className={`px-3 py-1 rounded-lg text-sm transition-colors ${
              y === year
                ? 'bg-primary text-white'
                : 'bg-surface border border-border text-muted hover:text-text'
            }`}
          >
            {y}
          </Link>
        ))}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-surface rounded-xl border border-border p-5">
          <div className="text-xs uppercase text-muted">Total reçu {year}</div>
          <div className="text-2xl font-bold mt-1">{formatCurrency(stats.total)}</div>
          <div className="text-xs text-muted mt-1">{stats.count} règlement(s)</div>
        </div>
        <div className="bg-surface rounded-xl border border-border p-5">
          <div className="text-xs uppercase text-muted mb-2">Par type</div>
          {Object.entries(stats.byType).length === 0 ? (
            <div className="text-xs text-muted">—</div>
          ) : (
            <ul className="space-y-1 text-xs">
              {Object.entries(stats.byType).map(([t, amount]) => (
                <li key={t} className="flex justify-between">
                  <span>{TYPE_LABELS[t as PaymentEntryType] || t}</span>
                  <span className="font-medium">{formatCurrency(amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="bg-surface rounded-xl border border-border p-5 md:col-span-2">
          <div className="text-xs uppercase text-muted mb-2">Par mode de règlement</div>
          {Object.entries(stats.byMethod).length === 0 ? (
            <div className="text-xs text-muted">—</div>
          ) : (
            <div className="grid grid-cols-2 gap-2 text-xs">
              {Object.entries(stats.byMethod).map(([m, amount]) => (
                <div key={m} className="flex justify-between">
                  <span>{METHOD_LABELS[m as PaymentEntryMethod] || m}</span>
                  <span className="font-medium">{formatCurrency(amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as PaymentEntryType | 'all')}
          className="px-3 py-2 bg-surface border border-border rounded-lg text-sm"
        >
          <option value="all">Tous les types</option>
          {Object.entries(TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select
          value={filterMethod}
          onChange={(e) => setFilterMethod(e.target.value as PaymentEntryMethod | 'all')}
          className="px-3 py-2 bg-surface border border-border rounded-lg text-sm"
        >
          <option value="all">Tous les modes</option>
          {Object.entries(METHOD_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {/* List */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">
            Aucun règlement {filterType !== 'all' || filterMethod !== 'all' ? 'avec ces filtres' : `pour ${year}`}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-dark">
                <tr className="text-left text-xs uppercase text-muted">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Payeur</th>
                  <th className="px-4 py-3">Mode</th>
                  <th className="px-4 py-3">Montant</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Lié à</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((e) => (
                  <tr key={e.id} className="hover:bg-surface-hover">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {new Date(e.payment_date).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[e.payment_type]}`}>
                        {TYPE_LABELS[e.payment_type]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>{e.payer_name || '—'}</div>
                      {e.related_client && (
                        <div className="text-xs text-muted">→ {e.related_client.name}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">{METHOD_LABELS[e.method]}</td>
                    <td className="px-4 py-3 font-semibold">{formatCurrency(Number(e.amount))}</td>
                    <td className="px-4 py-3 text-xs">
                      {e.installment === 'acompte' && <span className="text-warning">Acompte</span>}
                      {e.installment === 'solde' && <span className="text-success">Solde</span>}
                      {e.installment === 'total' && <span>Total</span>}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {e.related_document && (
                        <Link href={`/documents/${e.related_document.id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                          <FileText className="w-3 h-3" />
                          {e.related_document.numero}
                        </Link>
                      )}
                      {e.related_animal && (
                        <Link href={`/animals/${e.related_animal.id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                          <PawPrint className="w-3 h-3" />
                          {e.related_animal.name}
                        </Link>
                      )}
                      {e.related_donation && (
                        <Link href={`/donations`} className="text-primary hover:underline">
                          Don de {e.related_donation.donor_name}
                        </Link>
                      )}
                      {!e.related_document && !e.related_animal && !e.related_donation && '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/reglements/${e.id}`}
                          className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-surface-hover transition-colors"
                          title="Modifier"
                        >
                          <Pencil className="w-4 h-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(e.id)}
                          className="p-1.5 rounded-lg text-muted hover:text-error hover:bg-surface-hover transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
