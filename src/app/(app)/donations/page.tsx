import Link from 'next/link'
import { Heart, Plus, TrendingUp, FileCheck, Calendar, ExternalLink } from 'lucide-react'
import { getDonations, getDonationStats, getDonationYears } from '@/lib/actions/donations'
import { getHelloAssoConnection, getHelloAssoStats } from '@/lib/actions/helloasso'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { formatCurrency } from '@/lib/utils'
import { DonationList } from '@/components/donations/donation-list'
import { HelloAssoSettings } from '@/components/donations/helloasso-settings'
import { YearFilter } from '@/components/donations/year-filter'
import type { Donation } from '@/lib/types/database'

export default async function DonationsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const params = await searchParams
  const ctx = await getEstablishmentContext()
  const canManage = ctx!.permissions.canManageDonations

  const selectedYear = params.year ? parseInt(params.year) : new Date().getFullYear()

  const [donationsResult, statsResult, helloAssoConnectionResult, helloAssoStatsResult, yearOptions] = await Promise.all([
    getDonations({ year: selectedYear }),
    getDonationStats(selectedYear),
    getHelloAssoConnection(),
    getHelloAssoStats(selectedYear),
    getDonationYears(),
  ])

  const donations = (donationsResult.data as Donation[]) || []
  const stats = statsResult.data || { totalAmount: 0, totalCount: 0, cerfaCount: 0, year: selectedYear }
  const helloAssoConnection = helloAssoConnectionResult.data ?? null
  const helloAssoStats = helloAssoStatsResult.data || { helloassoCount: 0, helloassoTotal: 0, lastSyncAt: null }

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Heart className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Dons</h1>
            <p className="text-sm text-muted mt-1">
              Gestion des dons et recus fiscaux CERFA
            </p>
          </div>
        </div>

        {canManage && (
          <Link
            href="/donations/nouveau"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white text-sm gradient-primary hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Nouveau don
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
        <div className="bg-surface rounded-xl border border-border p-4 text-center">
          <TrendingUp className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="text-2xl font-bold">{formatCurrency(stats.totalAmount)}</p>
          <p className="text-xs text-muted mt-1">Total {stats.year}</p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4 text-center">
          <Heart className="w-5 h-5 text-error mx-auto mb-1" />
          <p className="text-2xl font-bold">{stats.totalCount}</p>
          <p className="text-xs text-muted mt-1">Dons recus</p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4 text-center">
          <FileCheck className="w-5 h-5 text-success mx-auto mb-1" />
          <p className="text-2xl font-bold">{stats.cerfaCount}</p>
          <p className="text-xs text-muted mt-1">CERFA generes</p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4 text-center">
          <Calendar className="w-5 h-5 text-info mx-auto mb-1" />
          <p className="text-2xl font-bold">
            {stats.totalCount > 0 ? formatCurrency(stats.totalAmount / stats.totalCount) : '0 \u20ac'}
          </p>
          <p className="text-xs text-muted mt-1">Don moyen</p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4 text-center">
          <ExternalLink className="w-5 h-5 text-success mx-auto mb-1" />
          <p className="text-2xl font-bold">{helloAssoStats.helloassoCount}</p>
          <p className="text-xs text-muted mt-1">
            HelloAsso ({formatCurrency(helloAssoStats.helloassoTotal)})
          </p>
        </div>
      </div>

      {/* Year filter */}
      <div className="mb-6">
        <YearFilter selectedYear={selectedYear} yearOptions={yearOptions} />
      </div>

      {/* HelloAsso Settings */}
      {canManage && (
        <div className="mb-6">
          <HelloAssoSettings connection={helloAssoConnection} canManage={canManage} />
        </div>
      )}

      {/* List */}
      <DonationList donations={donations} canManage={canManage} />
    </div>
  )
}
