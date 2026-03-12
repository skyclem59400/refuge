'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { cancelLeaveRequest } from '@/lib/actions/leaves'
import { LeaveBalanceCards } from './leave-balance-cards'
import { LeaveRequestList } from './leave-request-list'
import type { LeaveRequest, LeaveType, LeaveBalance } from '@/lib/types/database'

interface MyLeavesViewProps {
  readonly requests: LeaveRequest[]
  readonly leaveTypes: LeaveType[]
  readonly balances: LeaveBalance[]
}

export function MyLeavesView({ requests, leaveTypes, balances }: MyLeavesViewProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const handleCancel = (id: string) => {
    if (!confirm('Annuler cette demande ?')) return
    startTransition(async () => {
      const result = await cancelLeaveRequest(id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Demande annulee')
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-6">
      <LeaveBalanceCards balances={balances} leaveTypes={leaveTypes} />
      <LeaveRequestList requests={requests} leaveTypes={leaveTypes} onCancel={handleCancel} />
    </div>
  )
}
