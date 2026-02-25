import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { WelcomeBanner } from '@/components/dashboard/welcome-banner'
import { StatsCards } from '@/components/dashboard/stats-cards'
import { RevenueChart } from '@/components/dashboard/revenue-chart'
import { ShelterDashboard } from '@/components/dashboard/shelter-dashboard'
import { TypeBadge } from '@/components/documents/status-badge'
import Link from 'next/link'
import type { Animal, AnimalPhoto } from '@/lib/types/database'

type AnimalWithPhotos = Animal & { animal_photos: AnimalPhoto[] }

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const ctx = await getEstablishmentContext()
  const estabId = ctx!.establishment.id
  const estabType = ctx!.establishment.type
  const admin = createAdminClient()

  const showFarm = estabType === 'farm' || estabType === 'both'
  const showShelter = estabType === 'shelter' || estabType === 'both'

  // ---------------------------------------------------------------
  // Farm queries (only when relevant)
  // ---------------------------------------------------------------
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

  if (showFarm) {
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
      admin.from('documents').select('total').eq('type', 'facture').eq('status', 'sent').eq('establishment_id', estabId),
      admin.from('clients').select('*', { count: 'exact', head: true }).eq('establishment_id', estabId),
      admin.from('documents').select('*').eq('establishment_id', estabId).neq('status', 'converted').order('created_at', { ascending: false }).limit(5),
      admin.from('documents')
        .select('date, total, status')
        .eq('type', 'facture')
        .eq('establishment_id', estabId)
        .in('status', ['paid', 'sent'])
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
    recentDocs = (rawRecentDocs as typeof recentDocs) || []
    invoicesByMonth = (rawInvoicesByMonth as typeof invoicesByMonth) || []
  }

  // ---------------------------------------------------------------
  // Shelter queries (only when relevant)
  // ---------------------------------------------------------------
  let shelterStats = { poundCount: 0, shelterCount: 0, adoptionsThisMonth: 0, restitutionsThisMonth: 0 }
  let poundAnimals: AnimalWithPhotos[] = []
  let recentAnimals: AnimalWithPhotos[] = []
  let healthAlerts: { animal_name: string; animal_id: string; description: string; next_due_date: string }[] = []

  if (showShelter) {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const [
      { count: poundCount },
      { count: shelterCount },
      { count: adoptionsThisMonth },
      { count: restitutionsThisMonth },
      { data: rawPoundAnimals },
      { data: rawRecentAnimals },
      { data: rawHealthAlerts },
    ] = await Promise.all([
      admin.from('animals').select('*', { count: 'exact', head: true }).eq('establishment_id', estabId).eq('status', 'pound'),
      admin.from('animals').select('*', { count: 'exact', head: true }).eq('establishment_id', estabId).eq('status', 'shelter'),
      admin.from('animal_movements').select('*', { count: 'exact', head: true }).eq('type', 'adoption').gte('date', startOfMonth),
      admin.from('animal_movements').select('*', { count: 'exact', head: true }).eq('type', 'return_to_owner').gte('date', startOfMonth),
      admin.from('animals').select('*, animal_photos(id, url, is_primary)').eq('establishment_id', estabId).eq('status', 'pound').order('pound_entry_date', { ascending: true }),
      admin.from('animals').select('*, animal_photos(id, url, is_primary)').eq('establishment_id', estabId).order('created_at', { ascending: false }).limit(5),
      admin.from('animal_health_records').select('*, animals!inner(name, id)').eq('animals.establishment_id', estabId).not('next_due_date', 'is', null).lte('next_due_date', sevenDaysFromNow).order('next_due_date', { ascending: true }).limit(10),
    ])

    shelterStats = {
      poundCount: poundCount || 0,
      shelterCount: shelterCount || 0,
      adoptionsThisMonth: adoptionsThisMonth || 0,
      restitutionsThisMonth: restitutionsThisMonth || 0,
    }
    poundAnimals = (rawPoundAnimals as AnimalWithPhotos[]) || []
    recentAnimals = (rawRecentAnimals as AnimalWithPhotos[]) || []

    // Map health alerts: the joined `animals` relation provides name + id
    healthAlerts = (rawHealthAlerts || []).map((r: Record<string, unknown>) => {
      const animal = r.animals as { name: string; id: string } | null
      return {
        animal_name: animal?.name || 'Inconnu',
        animal_id: animal?.id || '',
        description: (r.description as string) || '',
        next_due_date: (r.next_due_date as string) || '',
      }
    })
  }

  // ---------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------
  return (
    <div className="animate-fade-up">
      <WelcomeBanner userEmail={user?.email || 'Utilisateur'} />

      {/* Shelter dashboard */}
      {showShelter && (
        <div className={showFarm ? 'mb-8' : ''}>
          {showFarm && (
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-6 rounded-full bg-primary" />
              <h2 className="text-lg font-bold text-text">Refuge / Fourriere</h2>
            </div>
          )}
          <ShelterDashboard
            stats={shelterStats}
            poundAnimals={poundAnimals}
            recentAnimals={recentAnimals}
            healthAlerts={healthAlerts}
          />
        </div>
      )}

      {/* Farm dashboard */}
      {showFarm && (
        <div>
          {showShelter && (
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-6 rounded-full bg-secondary" />
              <h2 className="text-lg font-bold text-text">Facturation</h2>
            </div>
          )}
          <StatsCards stats={farmStats} />

          <div className="mb-6">
            <RevenueChart invoices={(invoicesByMonth || []).map(inv => ({ date: inv.date, total: inv.total || 0, status: inv.status as 'paid' | 'sent' }))} />
          </div>

          {/* Recent documents */}
          <div className="bg-surface rounded-xl border border-border">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="font-semibold">Documents recents</h3>
              <Link href="/documents" className="text-sm text-primary hover:text-primary-light transition-colors">
                Voir tout
              </Link>
            </div>
            <div className="divide-y divide-border">
              {recentDocs && recentDocs.length > 0 ? (
                recentDocs.map((doc) => (
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
                ))
              ) : (
                <p className="p-5 text-sm text-muted text-center">Aucun document pour le moment</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
