import { formatCurrency } from '@/lib/utils'
import { DocumentTextIcon, PencilSquareIcon, ReceiptIcon, UsersIcon } from '@/components/icons'
import type { ComponentType } from 'react'

interface StatsData {
  totalDocuments: number
  totalDevis: number
  totalFactures: number
  caTotal: number
  caEnAttente: number
  totalClients: number
}

const statConfig: { key: keyof StatsData; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { key: 'totalDocuments', label: 'Documents', Icon: DocumentTextIcon },
  { key: 'totalDevis', label: 'Devis', Icon: PencilSquareIcon },
  { key: 'totalFactures', label: 'Factures', Icon: ReceiptIcon },
  { key: 'totalClients', label: 'Clients', Icon: UsersIcon },
]

export function StatsCards({ stats }: { stats: StatsData }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {statConfig.map((s) => (
        <div key={s.key} className="bg-surface rounded-xl p-5 border border-border hover:glow transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <s.Icon className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold">{stats[s.key]}</p>
          <p className="text-xs text-muted mt-1">{s.label}</p>
        </div>
      ))}

      {/* CA card - full width on mobile */}
      <div className="col-span-2 bg-surface rounded-xl p-5 border border-border hover:glow transition-shadow">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted mb-1">Chiffre d&apos;affaires (paye)</p>
            <p className="text-2xl font-bold text-success">{formatCurrency(stats.caTotal)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted mb-1">En attente</p>
            <p className="text-lg font-semibold text-warning">{formatCurrency(stats.caEnAttente)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
