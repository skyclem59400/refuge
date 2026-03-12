import Link from 'next/link'
import { CalendarDays } from 'lucide-react'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { getLeaveTypes, getLeaveBalances, getLeaveRequests } from '@/lib/actions/leaves'
import { MyLeavesView } from '@/components/leaves/my-leaves-view'
import type { LeaveType, LeaveBalance, LeaveRequest } from '@/lib/types/database'

export default async function MesCongesPage() {
  const ctx = await getEstablishmentContext()
  if (!ctx) throw new Error('Establishment context required')

  const [leaveTypesRes, balancesRes, requestsRes] = await Promise.all([
    getLeaveTypes(),
    getLeaveBalances({ memberId: ctx.membership.id }),
    getLeaveRequests({ memberId: ctx.membership.id }),
  ])

  const leaveTypes = (leaveTypesRes.data as LeaveType[]) || []
  const balances = (balancesRes.data as LeaveBalance[]) || []
  const requests = (requestsRes.data as LeaveRequest[]) || []

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <CalendarDays className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Mes conges</h1>
            <p className="text-sm text-muted mt-1">Historique de mes demandes</p>
          </div>
        </div>
        <Link
          href="/espace-collaborateur/conges/nouveau"
          className="px-4 py-2 rounded-lg font-semibold text-white text-sm gradient-primary hover:opacity-90 transition-opacity shadow-lg shadow-primary/25"
        >
          + Nouvelle demande
        </Link>
      </div>

      {/* Content */}
      <MyLeavesView requests={requests} leaveTypes={leaveTypes} balances={balances} />
    </div>
  )
}
