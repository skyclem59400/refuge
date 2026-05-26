import { redirect } from 'next/navigation'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { listAuditRuns } from '@/lib/actions/audit-history'
import { AuditHistoryClient } from './audit-history-client'

export const dynamic = 'force-dynamic'

export default async function AuditQuotidienPage() {
  const ctx = await getEstablishmentContext()
  if (!ctx) redirect('/login')
  if (!ctx.permissions.isAdmin) redirect('/dashboard')

  const { data: runs = [], error } = await listAuditRuns(50)

  return (
    <div className="animate-fade-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Audit quotidien</h1>
          <p className="text-sm text-muted mt-1">
            Synthèses IA générées chaque jour à 7h00 (cron) ou à la demande.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-error/10 border border-error/30 text-error text-sm">
          {error}
        </div>
      )}

      <AuditHistoryClient initialRuns={runs} />
    </div>
  )
}
