import { FileText } from 'lucide-react'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { listMembersWithSchedules } from '@/lib/actions/work-schedules'
import { getMonthlySaisie } from '@/lib/actions/cra-saisie'
import { CraSaisieClient } from '@/components/cra/cra-saisie-client'
import type { CraMonthlyView } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

export default async function CraSaisiePage(props: {
  searchParams: Promise<{ member?: string; year?: string; month?: string }>
}) {
  const ctx = await getEstablishmentContext()
  if (!ctx) throw new Error('Establishment context required')
  if (!ctx.permissions.canManageLeaves) throw new Error('Permissions insuffisantes')

  const sp = await props.searchParams
  const now = new Date()
  const year = sp.year ? parseInt(sp.year, 10) : now.getFullYear()
  const month = sp.month ? parseInt(sp.month, 10) : now.getMonth() + 1

  const { data: membersData, error: membersErr } = await listMembersWithSchedules()
  if (membersErr) throw new Error(membersErr)
  const members = membersData || []

  const selectedMemberId = sp.member || members[0]?.member.id || ''
  let view: CraMonthlyView | null = null
  if (selectedMemberId) {
    const { data, error } = await getMonthlySaisie(selectedMemberId, year, month)
    if (error) throw new Error(error)
    view = data || null
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text">Saisie CRA</h1>
            <p className="text-sm text-muted">
              Tableau mensuel d&apos;activité. Pré-rempli depuis la semaine type. Cliquez sur un jour pour le modifier.
            </p>
          </div>
        </div>
      </div>

      <CraSaisieClient
        members={members.map((r) => ({
          id: r.member.id,
          label: r.member.full_name || r.member.pseudo || r.member.email || 'Membre',
          contract_type: r.member.contract_type,
        }))}
        initialMemberId={selectedMemberId}
        year={year}
        month={month}
        view={view}
        isAdmin={ctx.membership.role_type === 'admin'}
      />
    </div>
  )
}
