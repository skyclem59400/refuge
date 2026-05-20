import Link from 'next/link'
import { AlertCircle, ChevronRight } from 'lucide-react'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { createAdminClient } from '@/lib/supabase/server'
import type { CraChangeRequest, EstablishmentMember } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

const MONTH_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

export default async function CraDemandesPage() {
  const ctx = await getEstablishmentContext()
  if (!ctx) throw new Error('Establishment context required')
  if (!ctx.permissions.canManageLeaves && ctx.membership.role_type !== 'admin') {
    throw new Error('Permissions insuffisantes')
  }

  const admin = createAdminClient()
  const { data: requests } = await admin
    .from('cra_change_requests')
    .select('*, cra_status:cra_monthly_status(year, month)')
    .eq('establishment_id', ctx.establishment.id)
    .order('requested_at', { ascending: false })
    .limit(50)

  type CraStatusLite = { year: number; month: number }
  type RequestWithStatus = CraChangeRequest & { cra_status: CraStatusLite | null }
  const list = (requests || []) as RequestWithStatus[]
  const memberIds = [...new Set(list.map((r) => r.member_id))]

  let members: EstablishmentMember[] = []
  if (memberIds.length > 0) {
    const { data: mData } = await admin
      .from('establishment_members')
      .select('*')
      .in('id', memberIds)
    members = (mData || []) as EstablishmentMember[]
    const userIds = members.map((m) => m.user_id).filter(Boolean)
    if (userIds.length > 0) {
      const { data: usersInfo } = await admin.rpc('get_users_info', { user_ids: userIds })
      if (usersInfo && Array.isArray(usersInfo)) {
        for (const u of usersInfo) {
          const m = members.find((mm) => mm.user_id === u.id)
          if (m) m.full_name = u.full_name || null
        }
      }
    }
  }

  function memberName(id: string): string {
    const m = members.find((mm) => mm.id === id)
    return m?.full_name || m?.pseudo || 'Collaborateur'
  }

  const open = list.filter((r) => !r.resolved_at)
  const closed = list.filter((r) => r.resolved_at)

  return (
    <div className="animate-fade-up max-w-3xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text">Demandes de modification CRA</h1>
            <p className="text-sm text-muted">Demandes émises par les collaborateurs après soumission de leur CRA.</p>
          </div>
        </div>
      </div>

      {open.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-text mb-2">En cours ({open.length})</h2>
          <div className="space-y-2 mb-8">
            {open.map((r) => {
              const period = r.cra_status ? `${MONTH_FR[r.cra_status.month - 1]} ${r.cra_status.year}` : '—'
              return (
                <Link
                  key={r.id}
                  href={`/admin/cra/saisie?member=${r.member_id}${r.cra_status ? `&year=${r.cra_status.year}&month=${r.cra_status.month}` : ''}`}
                  className="block p-4 rounded-xl border border-orange-500/30 bg-orange-500/5 hover:bg-orange-500/10 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-semibold text-text">{memberName(r.member_id)} — {period}</p>
                      <p className="text-xs text-muted">
                        Demandé le {new Date(r.requested_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-orange-400" />
                  </div>
                  <p className="text-sm text-orange-100/90 italic">&laquo; {r.comment} &raquo;</p>
                </Link>
              )
            })}
          </div>
        </>
      )}

      {closed.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-text mb-2">Résolues ({closed.length})</h2>
          <div className="space-y-2">
            {closed.map((r) => {
              const period = r.cra_status ? `${MONTH_FR[r.cra_status.month - 1]} ${r.cra_status.year}` : '—'
              return (
                <div key={r.id} className="p-4 rounded-xl border border-border bg-surface opacity-70">
                  <p className="font-semibold text-text text-sm">{memberName(r.member_id)} — {period}</p>
                  <p className="text-xs text-muted mt-1">&laquo; {r.comment} &raquo;</p>
                  <p className="text-[11px] text-emerald-400 mt-1">
                    Résolue le {r.resolved_at ? new Date(r.resolved_at).toLocaleDateString('fr-FR') : ''}
                    {r.resolution_notes && ` — ${r.resolution_notes}`}
                  </p>
                </div>
              )
            })}
          </div>
        </>
      )}

      {open.length === 0 && closed.length === 0 && (
        <div className="p-8 rounded-2xl border border-border bg-surface text-center">
          <p className="text-muted">Aucune demande de modification pour le moment.</p>
        </div>
      )}
    </div>
  )
}
