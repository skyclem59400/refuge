import Link from 'next/link'
import { Briefcase } from 'lucide-react'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { getLeaveTypes, getLeaveBalances, getLeaveRequests } from '@/lib/actions/leaves'
import { getPayslips } from '@/lib/actions/payslips'
import { LeaveBalanceCards } from '@/components/leaves/leave-balance-cards'
import { LeaveRequestList } from '@/components/leaves/leave-request-list'
import { PayslipList } from '@/components/payslips/payslip-list'
import type { LeaveType, LeaveBalance, LeaveRequest, Payslip } from '@/lib/types/database'

export default async function EspaceCollaborateurPage() {
  const ctx = await getEstablishmentContext()
  if (!ctx) throw new Error('Establishment context required')

  const [leaveTypesRes, balancesRes, requestsRes, payslipsRes] = await Promise.all([
    getLeaveTypes(),
    getLeaveBalances({ memberId: ctx.membership.id }),
    getLeaveRequests({ memberId: ctx.membership.id }),
    getPayslips({ memberId: ctx.membership.id }),
  ])

  const leaveTypes = (leaveTypesRes.data as LeaveType[]) || []
  const balances = (balancesRes.data as LeaveBalance[]) || []
  const allRequests = (requestsRes.data as LeaveRequest[]) || []
  const recentRequests = allRequests.slice(0, 5)
  const allPayslips = (payslipsRes.data as Payslip[]) || []
  const recentPayslips = allPayslips.slice(0, 3)

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Briefcase className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Mon espace</h1>
            <p className="text-sm text-muted mt-1">Mes conges et bulletins de paie</p>
          </div>
        </div>
        <Link
          href="/espace-collaborateur/conges/nouveau"
          className="px-4 py-2 rounded-lg font-semibold text-white text-sm gradient-primary hover:opacity-90 transition-opacity shadow-lg shadow-primary/25"
        >
          + Nouvelle demande de conge
        </Link>
      </div>

      {/* Soldes de conges */}
      <section className="mb-8">
        <h2 className="text-lg font-bold text-text mb-3">Soldes de conges</h2>
        <LeaveBalanceCards balances={balances} leaveTypes={leaveTypes} />
      </section>

      {/* Dernieres demandes de conges */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-text">Dernieres demandes</h2>
          <Link
            href="/espace-collaborateur/conges"
            className="text-sm text-primary hover:underline"
          >
            Voir tout
          </Link>
        </div>
        <LeaveRequestList requests={recentRequests} leaveTypes={leaveTypes} />
      </section>

      {/* Derniers bulletins de paie */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-text">Derniers bulletins de paie</h2>
          <Link
            href="/espace-collaborateur/bulletins"
            className="text-sm text-primary hover:underline"
          >
            Voir tout
          </Link>
        </div>
        <PayslipList payslips={recentPayslips} />
      </section>
    </div>
  )
}
