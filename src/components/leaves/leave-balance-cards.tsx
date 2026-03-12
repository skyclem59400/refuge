'use client'

import type { LeaveBalance, LeaveType } from '@/lib/types/database'

interface LeaveBalanceCardsProps {
  balances: LeaveBalance[]
  leaveTypes: LeaveType[]
}

export function LeaveBalanceCards({ balances, leaveTypes }: LeaveBalanceCardsProps) {
  const typeMap = new Map(leaveTypes.map((t) => [t.id, t]))

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {balances.map((balance) => {
        const leaveType = typeMap.get(balance.leave_type_id)
        if (!leaveType) return null

        const remaining = balance.initial_balance - balance.used + balance.adjustment
        const usedRatio = balance.initial_balance > 0
          ? Math.min(balance.used / balance.initial_balance, 1)
          : 0

        return (
          <div
            key={balance.id}
            className="bg-surface rounded-xl border border-border p-4 relative overflow-hidden"
          >
            {/* Barre coloree a gauche */}
            <div
              className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
              style={{ backgroundColor: leaveType.color }}
            />

            <div className="pl-2">
              <p className="text-xs font-semibold text-text truncate">
                {leaveType.name}
              </p>

              <p className="text-2xl font-bold mt-2" style={{ color: leaveType.color }}>
                {remaining}
              </p>
              <p className="text-[11px] text-muted">
                jours restants
              </p>

              {/* Jauge d'utilisation */}
              <div className="mt-3 h-1.5 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${usedRatio * 100}%`,
                    backgroundColor: leaveType.color,
                  }}
                />
              </div>

              <p className="text-[10px] text-muted mt-1">
                {balance.used} / {balance.initial_balance} utilises
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
