import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { WelcomeBanner } from '@/components/dashboard/welcome-banner'
import { StatsCards } from '@/components/dashboard/stats-cards'
import { RevenueChart } from '@/components/dashboard/revenue-chart'
import { TypeBadge } from '@/components/documents/status-badge'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const ctx = await getEstablishmentContext()
  const estabId = ctx!.establishment.id
  const admin = createAdminClient()

  // Fetch stats in parallel — scoped by establishment
  const [
    { count: totalDocuments },
    { count: totalDevis },
    { count: totalFactures },
    { data: caPaidData },
    { data: caSentData },
    { count: totalClients },
    { data: recentDocs },
    { data: invoicesByMonth },
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

  const stats = {
    totalDocuments: totalDocuments || 0,
    totalDevis: totalDevis || 0,
    totalFactures: totalFactures || 0,
    caTotal,
    caEnAttente,
    totalClients: totalClients || 0,
  }

  return (
    <div className="animate-fade-up">
      <WelcomeBanner userEmail={user?.email || 'Utilisateur'} />
      <StatsCards stats={stats} />

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
  )
}
