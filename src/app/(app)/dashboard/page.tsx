import { createClient } from '@/lib/supabase/server'
import { WelcomeBanner } from '@/components/dashboard/welcome-banner'
import { StatsCards } from '@/components/dashboard/stats-cards'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch stats in parallel
  const [
    { count: totalDocuments },
    { count: totalDevis },
    { count: totalFactures },
    { data: caPaidData },
    { data: caSentData },
    { count: totalClients },
    { data: recentDocs },
  ] = await Promise.all([
    supabase.from('documents').select('*', { count: 'exact', head: true }),
    supabase.from('documents').select('*', { count: 'exact', head: true }).eq('type', 'devis'),
    supabase.from('documents').select('*', { count: 'exact', head: true }).eq('type', 'facture'),
    supabase.from('documents').select('total').eq('type', 'facture').eq('status', 'paid'),
    supabase.from('documents').select('total').eq('type', 'facture').eq('status', 'sent'),
    supabase.from('clients').select('*', { count: 'exact', head: true }),
    supabase.from('documents').select('*').order('created_at', { ascending: false }).limit(5),
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
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    doc.type === 'facture'
                      ? 'bg-success/15 text-success'
                      : 'bg-warning/15 text-warning'
                  }`}>
                    {doc.type === 'facture' ? 'Facture' : 'Devis'}
                  </span>
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
