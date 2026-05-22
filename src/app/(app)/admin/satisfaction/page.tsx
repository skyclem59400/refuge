import { HeartHandshake } from 'lucide-react'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { listSurveys, getSurveyStats } from '@/lib/actions/satisfaction'
import { SatisfactionDashboard } from '@/components/satisfaction/satisfaction-dashboard'
import type { SatisfactionSurvey } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

export default async function AdminSatisfactionPage() {
  const ctx = await getEstablishmentContext()
  if (!ctx) throw new Error('Establishment context required')
  if (!ctx.permissions.canManageEstablishment) {
    throw new Error('Permissions insuffisantes')
  }

  const [surveysRes, statsRes] = await Promise.all([
    listSurveys({ limit: 200 }),
    getSurveyStats({}),
  ])

  const surveys = (surveysRes.data || []) as SatisfactionSurvey[]
  const stats = statsRes.data || null

  return (
    <div className="animate-fade-up">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-teal-500/10">
            <HeartHandshake className="w-6 h-6 text-teal-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Satisfaction &amp; retours</h1>
            <p className="text-sm text-muted mt-1">
              Enquêtes NPS automatiques envoyées après adoption, don ou famille d&apos;accueil.
            </p>
          </div>
        </div>
      </div>

      <SatisfactionDashboard initialStats={stats} initialSurveys={surveys} />
    </div>
  )
}
