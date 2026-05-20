import Link from 'next/link'
import { ClipboardList, ChevronRight } from 'lucide-react'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { createAdminClient } from '@/lib/supabase/server'
import { CRA_STATUS_LABELS } from '@/lib/types/database'
import type { CraMonthlyStatus, CraStatus } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

const MONTH_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

const STATUS_BG: Record<CraStatus, string> = {
  draft: 'bg-gray-500/10 text-gray-300 border-gray-500/30',
  submitted: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
  validated_by_member: 'bg-teal-500/10 text-teal-300 border-teal-500/30',
  validated_by_admin: 'bg-green-500/10 text-green-300 border-green-500/30',
  change_requested: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
  sent: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
}

export default async function MesCraPage() {
  const ctx = await getEstablishmentContext()
  if (!ctx) throw new Error('Establishment context required')

  const admin = createAdminClient()
  const { data: statuses } = await admin
    .from('cra_monthly_status')
    .select('*')
    .eq('member_id', ctx.membership.id)
    .order('year', { ascending: false })
    .order('month', { ascending: false })

  const list = (statuses || []) as CraMonthlyStatus[]

  // Construire la liste des 12 derniers mois pour les afficher même sans statut existant
  const now = new Date()
  const months: { year: number; month: number; status?: CraMonthlyStatus }[] = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    months.push({ year: y, month: m, status: list.find((s) => s.year === y && s.month === m) })
  }

  return (
    <div className="animate-fade-up max-w-3xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text">Mes CRA</h1>
            <p className="text-sm text-muted">Mes comptes-rendus d&apos;activité mensuels.</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {months.map((m) => {
          const status = m.status?.status || 'draft'
          const visible = m.status || m.month <= now.getMonth() + 1 // Affiche le mois courant même sans statut
          if (!visible) return null
          return (
            <Link
              key={`${m.year}-${m.month}`}
              href={`/espace-collaborateur/cra/${m.year}/${m.month}`}
              className="flex items-center justify-between p-4 rounded-xl border border-border bg-surface hover:bg-surface-dark/30 transition-colors"
            >
              <div>
                <p className="font-semibold text-text">{MONTH_FR[m.month - 1]} {m.year}</p>
                {m.status?.submitted_at && (
                  <p className="text-xs text-muted">
                    Soumis le {new Date(m.status.submitted_at).toLocaleDateString('fr-FR')}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {m.status ? (
                  <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${STATUS_BG[status]}`}>
                    {CRA_STATUS_LABELS[status]}
                  </span>
                ) : (
                  <span className="text-xs text-muted italic">Pas encore généré</span>
                )}
                <ChevronRight className="w-5 h-5 text-muted" />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
