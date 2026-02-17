import { formatCurrency } from '@/lib/utils'

interface StatsData {
  totalDocuments: number
  totalDevis: number
  totalFactures: number
  caTotal: number
  caEnAttente: number
  totalClients: number
}

const statConfig = [
  { key: 'totalDocuments' as const, label: 'Documents', icon: '📄', color: 'from-primary to-secondary' },
  { key: 'totalDevis' as const, label: 'Devis', icon: '📝', color: 'from-warning to-orange-500' },
  { key: 'totalFactures' as const, label: 'Factures', icon: '🧾', color: 'from-success to-emerald-500' },
  { key: 'totalClients' as const, label: 'Clients', icon: '👥', color: 'from-info to-cyan-500' },
]

export function StatsCards({ stats }: { stats: StatsData }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {statConfig.map((s) => (
        <div key={s.key} className="bg-surface rounded-xl p-5 border border-border hover:glow transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-2xl">{s.icon}</span>
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${s.color} opacity-20`} />
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
