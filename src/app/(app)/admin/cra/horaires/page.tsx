import { Clock } from 'lucide-react'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { listMembersWithSchedules } from '@/lib/actions/work-schedules'
import { WorkSchedulesEditor } from '@/components/cra/work-schedules-editor'

export const dynamic = 'force-dynamic'

export default async function CraHorairesPage() {
  const ctx = await getEstablishmentContext()
  if (!ctx) throw new Error('Establishment context required')
  if (!ctx.permissions.canManageLeaves) throw new Error('Permissions insuffisantes')

  const { data, error } = await listMembersWithSchedules()
  if (error) throw new Error(error)
  const members = data || []

  return (
    <div className="animate-fade-up">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Clock className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text">Horaires de référence</h1>
            <p className="text-sm text-muted">
              Semaine type de chaque collaborateur. Sert de base pour pré-remplir les CRA mensuels.
            </p>
          </div>
        </div>
      </div>

      <WorkSchedulesEditor members={members} />
    </div>
  )
}
