import { Calculator } from 'lucide-react'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { getLeaveTypes, getLeaveBalances } from '@/lib/actions/leaves'
import { createAdminClient } from '@/lib/supabase/server'
import { LeaveBalanceManager } from '@/components/leaves/leave-balance-manager'
import type { EstablishmentMember, LeaveType, LeaveBalance } from '@/lib/types/database'

export default async function AdminSoldesCongesPage() {
  const ctx = await getEstablishmentContext()
  if (!ctx) throw new Error('Establishment context required')

  if (!ctx.permissions.canManageLeaves) {
    throw new Error('Permissions insuffisantes')
  }

  const currentYear = new Date().getFullYear()

  // Fetch all data in parallel
  const admin = createAdminClient()
  const [typesResult, balancesResult, membersResult] = await Promise.all([
    getLeaveTypes(),
    getLeaveBalances({ year: currentYear }),
    admin
      .from('establishment_members')
      .select('*')
      .eq('establishment_id', ctx.establishment.id),
  ])

  const leaveTypes = (typesResult.data || []) as LeaveType[]
  const balances = (balancesResult.data || []) as LeaveBalance[]
  const members = (membersResult.data || []) as EstablishmentMember[]

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Calculator className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Soldes de conges</h1>
            <p className="text-sm text-muted mt-1">Gestion des soldes par employe</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <LeaveBalanceManager
        members={members}
        leaveTypes={leaveTypes}
        balances={balances}
      />
    </div>
  )
}
