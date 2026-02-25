import { createAdminClient } from '@/lib/supabase/server'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { getStatusLabel } from '@/lib/sda-utils'
import { AnimalsByStatusChart } from '@/components/statistics/animals-by-status-chart'
import { AnimalsBySpeciesChart } from '@/components/statistics/animals-by-species-chart'
import { MonthlyTrendsChart } from '@/components/statistics/monthly-trends-chart'
import { BarChart3 } from 'lucide-react'

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
  const admin = createAdminClient()

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
