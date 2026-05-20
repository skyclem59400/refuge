import Link from 'next/link'
import { ShieldCheck, ChevronRight } from 'lucide-react'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { createAdminClient } from '@/lib/supabase/server'
import type { CraMonthlyStatus, EstablishmentMember } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

const MONTH_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

export default async function CraValidationsPage() {
  const ctx = await getEstablishmentContext()
  if (!ctx) throw new Error('Establishment context required')
  if (ctx.membership.role_type !== 'admin') throw new Error('Réservé aux administrateurs (Clément/Céline)')

  const admin = createAdminClient()
  const { data: statuses } = await admin
    .from('cra_monthly_status')
    .select('*')
    .eq('establishment_id', ctx.establishment.id)
    .eq('status', 'validated_by_member')
    .order('year', { ascending: false })
    .order('month', { ascending: false })

  const list = (statuses || []) as CraMonthlyStatus[]
  const memberIds = [...new Set(list.map((s) => s.member_id))]

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

  return (
    <div className="animate-fade-up max-w-3xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text">Validations CRA admin</h1>
            <p className="text-sm text-muted">
              CRA validés par les collaborateurs, en attente de votre contrôle final avant envoi au comptable.
            </p>
          </div>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="p-8 rounded-2xl border border-border bg-surface text-center">
          <p className="text-muted">Aucun CRA en attente de validation administrateur.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((s) => (
            <Link
              key={s.id}
              href={`/admin/cra/saisie?member=${s.member_id}&year=${s.year}&month=${s.month}`}
              className="flex items-center justify-between p-4 rounded-xl border border-green-500/30 bg-green-500/5 hover:bg-green-500/10 transition-colors"
            >
              <div>
                <p className="font-semibold text-text">{memberName(s.member_id)}</p>
                <p className="text-xs text-muted">
                  {MONTH_FR[s.month - 1]} {s.year}
                  {s.validated_at && ` — validé collab le ${new Date(s.validated_at).toLocaleDateString('fr-FR')}`}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-green-400" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
