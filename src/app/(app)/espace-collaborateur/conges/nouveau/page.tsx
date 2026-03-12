import Link from 'next/link'
import { CalendarPlus } from 'lucide-react'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { getLeaveTypes, getLeaveBalances } from '@/lib/actions/leaves'
import { LeaveRequestForm } from '@/components/leaves/leave-request-form'
import type { LeaveType, LeaveBalance } from '@/lib/types/database'

export default async function NouvelleDemandeCongesPage() {
  const ctx = await getEstablishmentContext()
  if (!ctx) throw new Error('Establishment context required')

  const [leaveTypesRes, balancesRes] = await Promise.all([
    getLeaveTypes(),
    getLeaveBalances({ memberId: ctx.membership.id }),
  ])

  const leaveTypes = (leaveTypesRes.data as LeaveType[]) || []
  const balances = (balancesRes.data as LeaveBalance[]) || []

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/espace-collaborateur/conges"
          className="text-muted hover:text-text transition-colors"
        >
          &larr; Retour
        </Link>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <CalendarPlus className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Nouvelle demande de conge</h1>
            <p className="text-sm text-muted mt-1">Remplissez le formulaire ci-dessous</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <LeaveRequestForm leaveTypes={leaveTypes} balances={balances} />
    </div>
  )
}
