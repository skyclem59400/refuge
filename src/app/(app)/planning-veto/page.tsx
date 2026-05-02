import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CalendarDays, Plus } from 'lucide-react'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { listVetVisits } from '@/lib/actions/vet-visits'

function fmt(date: string) {
  return new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default async function PlanningVetoListPage() {
  const ctx = await getEstablishmentContext()
  if (!ctx) return null
  if (!ctx.permissions.canManageHealth) redirect('/dashboard')

  const res = await listVetVisits()
  const visits = res.data || []

  return (
    <div className="animate-fade-up">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <CalendarDays className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Planning vétérinaire</h1>
            <p className="text-sm text-muted mt-1">
              Tableaux quotidiens style Google Sheet — actes prévus puis validés (génère automatiquement les fiches santé sur les animaux).
            </p>
          </div>
        </div>
        <Link
          href="/planning-veto/nouveau"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white text-sm gradient-primary hover:opacity-90 transition-opacity shadow-lg shadow-primary/25"
        >
          <Plus className="w-4 h-4" />
          Nouveau passage véto
        </Link>
      </div>

      {visits.length === 0 ? (
        <div className="bg-surface rounded-xl border border-border p-8 text-center text-sm text-muted">
          Aucun passage véto enregistré.
        </div>
      ) : (
        <div className="grid gap-3">
          {visits.map((v) => (
            <Link
              key={v.id}
              href={`/planning-veto/${v.id}`}
              className="bg-surface rounded-xl border border-border p-4 hover:border-primary/30 transition-colors flex items-center justify-between"
            >
              <div>
                <div className="font-semibold capitalize">{fmt(v.visit_date)}</div>
                <div className="text-xs text-muted mt-0.5 flex flex-wrap gap-3">
                  {v.time_label && <span>🕐 {v.time_label}</span>}
                  {v.location_label && <span>📍 {v.location_label}</span>}
                  {v.vet_label && <span>👨‍⚕️ {v.vet_label}</span>}
                </div>
              </div>
              <span className="text-xs text-primary">Ouvrir →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
