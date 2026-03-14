import { createAdminClient } from '@/lib/supabase/server'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { getStatusLabel } from '@/lib/sda-utils'
import { AnimalsByStatusChart } from '@/components/statistics/animals-by-status-chart'
import { AnimalsBySpeciesChart } from '@/components/statistics/animals-by-species-chart'
import { MonthlyTrendsChart } from '@/components/statistics/monthly-trends-chart'
import { StatsCards } from '@/components/dashboard/stats-cards'
import { RevenueChart } from '@/components/dashboard/revenue-chart'
import { TypeBadge } from '@/components/documents/status-badge'
import Link from 'next/link'
import { BarChart3, TrendingUp } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  pound: '#f59e0b',
  shelter: '#3b82f6',
  foster_family: '#8b5cf6',
  boarding: '#14b8a6',
  adopted: '#22c55e',
  returned: '#06b6d4',
  transferred: '#f97316',
  deceased: '#6b7280',
  euthanized: '#ef4444',
}

export default async function StatistiquesPage() {
  const ctx = await getEstablishmentContext()
  const estabId = ctx!.establishment.id
  const estabType = ctx!.establishment.type
  const canManage = ctx!.permissions.canManageEstablishment
  const admin = createAdminClient()

  const showFarm = estabType === 'farm' || estabType === 'both'

  const now = new Date()
  const twelveMonthsAgo = new Date(now.getFullYear() - 1, now.getMonth(), 1)

  const [
    { data: animals },
    { data: movements },
  ] = await Promise.all([
    admin.from('animals').select('id, status, species, pound_entry_date, shelter_entry_date, exit_date').eq('establishment_id', estabId),
    admin.from('animal_movements').select('type, date, animal_id').gte('date', twelveMonthsAgo.toISOString().split('T')[0]),
  ])

  const animalList = animals || []
  const movementList = movements || []

  // Financial data (farm only, admins only)
  let farmStats = {
    totalDocuments: 0,
    totalDevis: 0,
    totalFactures: 0,
    caTotal: 0,
    caEnAttente: 0,
    totalClients: 0,
  }
  let recentDocs: Array<{ id: string; type: string; numero: string; client_name: string; total: number }> = []
  let invoicesByMonth: Array<{ date: string; total: number; status: string }> = []

  if (showFarm && canManage) {
    const [
      { count: totalDocuments },
      { count: totalDevis },
      { count: totalFactures },
      { data: caPaidData },
      { data: caSentData },
      { count: totalClients },
      { data: rawRecentDocs },
      { data: rawInvoicesByMonth },
    ] = await Promise.all([
      admin.from('documents').select('*', { count: 'exact', head: true }).eq('establishment_id', estabId).neq('status', 'converted'),
      admin.from('documents').select('*', { count: 'exact', head: true }).eq('type', 'devis').eq('establishment_id', estabId).neq('status', 'converted'),
      admin.from('documents').select('*', { count: 'exact', head: true }).eq('type', 'facture').eq('establishment_id', estabId),
      admin.from('documents').select('total').eq('type', 'facture').eq('status', 'paid').eq('establishment_id', estabId),
      admin.from('documents').select('total').eq('type', 'facture').in('status', ['validated', 'sent']).eq('establishment_id', estabId),
      admin.from('clients').select('*', { count: 'exact', head: true }).eq('establishment_id', estabId),
      admin.from('documents').select('*').eq('establishment_id', estabId).neq('status', 'converted').order('created_at', { ascending: false }).limit(5),
      admin.from('documents')
        .select('date, total, status')
        .eq('type', 'facture')
        .eq('establishment_id', estabId)
        .in('status', ['paid', 'sent', 'validated'])
        .order('date', { ascending: true }),
    ])

    const caTotal = caPaidData?.reduce((sum, d) => sum + (d.total || 0), 0) || 0
    const caEnAttente = caSentData?.reduce((sum, d) => sum + (d.total || 0), 0) || 0

    farmStats = {
      totalDocuments: totalDocuments || 0,
      totalDevis: totalDevis || 0,
      totalFactures: totalFactures || 0,
      caTotal,
      caEnAttente,
      totalClients: totalClients || 0,
    }
    recentDocs = rawRecentDocs || []
    invoicesByMonth = rawInvoicesByMonth || []
  }

  // Stats by status
  const statusCounts: Record<string, number> = {}
  for (const a of animalList) {
    statusCounts[a.status] = (statusCounts[a.status] || 0) + 1
  }
  const statusData = Object.entries(statusCounts).map(([status, count]) => ({
    name: getStatusLabel(status),
    value: count,
    color: STATUS_COLORS[status] || '#6b7280',
  }))

  // Stats by species
  const speciesCounts: Record<string, number> = {}
  for (const a of animalList) {
    speciesCounts[a.species] = (speciesCounts[a.species] || 0) + 1
  }
  const speciesData = Object.entries(speciesCounts).map(([species, count]) => ({
    name: species === 'cat' ? 'Chats' : 'Chiens',
    value: count,
    color: species === 'cat' ? '#8b5cf6' : '#f59e0b',
  }))

  // Key counts
  const totalAnimals = animalList.length
  const poundCount = statusCounts['pound'] || 0
  const shelterCount = statusCounts['shelter'] || 0
  const fosterCount = statusCounts['foster_family'] || 0
  const adoptedCount = statusCounts['adopted'] || 0

  // Average stay duration (for animals with exit_date)
  const stays = animalList
    .filter(a => a.exit_date && (a.pound_entry_date || a.shelter_entry_date))
    .map(a => {
      const entry = new Date(a.shelter_entry_date || a.pound_entry_date!)
      const exit = new Date(a.exit_date!)
      return (exit.getTime() - entry.getTime()) / (1000 * 60 * 60 * 24)
    })
    .filter(d => d > 0)
  const avgStay = stays.length > 0 ? Math.round(stays.reduce((a, b) => a + b, 0) / stays.length) : 0

  return (
    <div className="animate-fade-up">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary/10">
          <BarChart3 className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Statistiques</h1>
          <p className="text-sm text-muted mt-1">Vue d&apos;ensemble de l&apos;activite du refuge</p>
        </div>
      </div>

      {/* Financial section - admins only */}
      {showFarm && canManage && (
        <div className="mb-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <TrendingUp className="w-6 h-6 text-success" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Données financières</h2>
              <p className="text-sm text-muted mt-1">Réservé aux managers</p>
            </div>
          </div>

          <StatsCards stats={farmStats} />

          <div>
            <RevenueChart invoices={(invoicesByMonth || []).map(inv => ({ date: inv.date, total: inv.total || 0, status: inv.status as 'paid' | 'sent' }))} />
          </div>

          {recentDocs && recentDocs.length > 0 && (
            <div className="bg-surface rounded-xl border border-border">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h3 className="font-semibold">Documents récents</h3>
                <Link href="/documents" className="text-sm text-primary hover:text-primary-light transition-colors">
                  Voir tout
                </Link>
              </div>
              <div className="divide-y divide-border">
                {recentDocs.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between px-5 py-3 hover:bg-surface-hover transition-colors">
                    <div className="flex items-center gap-3">
                      <TypeBadge type={doc.type} />
                      <span className="text-sm font-medium">{doc.numero}</span>
                      <span className="text-sm text-muted">{doc.client_name}</span>
                    </div>
                    <span className="text-sm font-semibold">
                      {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(doc.total)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Separator */}
      {showFarm && canManage && (
        <div className="border-t border-border my-8" />
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Total animaux', value: totalAnimals, color: 'text-text' },
          { label: 'En fourriere', value: poundCount, color: 'text-warning' },
          { label: 'Au refuge', value: shelterCount, color: 'text-info' },
          { label: 'Famille d\'accueil', value: fosterCount, color: 'text-violet-500' },
          { label: 'Adoptes', value: adoptedCount, color: 'text-success' },
        ].map((stat) => (
          <div key={stat.label} className="bg-surface rounded-xl border border-border p-4">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-muted mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-surface rounded-xl border border-border p-5">
          <h3 className="font-semibold mb-4">Repartition par statut</h3>
          <AnimalsByStatusChart data={statusData} />
        </div>
        <div className="bg-surface rounded-xl border border-border p-5">
          <h3 className="font-semibold mb-4">Repartition par espece</h3>
          <AnimalsBySpeciesChart data={speciesData} />
        </div>
      </div>

      {/* Average stay */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-surface rounded-xl border border-border p-5">
          <p className="text-3xl font-bold text-primary">{avgStay}</p>
          <p className="text-sm text-muted mt-1">Duree moyenne de sejour (jours)</p>
          <p className="text-xs text-muted mt-0.5">Basee sur {stays.length} sorties</p>
        </div>
        <div className="lg:col-span-3 bg-surface rounded-xl border border-border p-5">
          <h3 className="font-semibold mb-4">Tendances mensuelles (12 derniers mois)</h3>
          <MonthlyTrendsChart movements={movementList} />
        </div>
      </div>
    </div>
  )
}
