'use client'

import { useState, useTransition } from 'react'
import { getPayslipSignedUrl } from '@/lib/actions/payslips'
import { toast } from 'sonner'
import type { Payslip, EstablishmentMember } from '@/lib/types/database'

const MONTH_NAMES = [
  'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre',
]

interface PayslipListProps {
  readonly payslips: Payslip[]
  readonly showMember?: boolean
  readonly members?: EstablishmentMember[]
}

function groupByYear(payslips: Payslip[]): Map<number, Payslip[]> {
  const grouped = new Map<number, Payslip[]>()
  for (const p of payslips) {
    const existing = grouped.get(p.year)
    if (existing) {
      existing.push(p)
    } else {
      grouped.set(p.year, [p])
    }
  }
  // Sort payslips within each year by month descending
  for (const [, items] of grouped) {
    items.sort((a, b) => b.month - a.month)
  }
  return grouped
}

function getMemberName(memberId: string, members?: EstablishmentMember[]): string {
  if (!members) return ''
  const member = members.find((m) => m.id === memberId)
  if (!member) return ''
  return member.full_name || member.pseudo || member.email || ''
}

export function PayslipList({ payslips, showMember, members }: PayslipListProps) {
  const currentYear = new Date().getFullYear()
  const grouped = groupByYear(payslips)
  const years = Array.from(grouped.keys()).sort((a, b) => b - a)

  const [openYears, setOpenYears] = useState<Set<number>>(() => {
    const initial = new Set<number>()
    if (years.includes(currentYear)) {
      initial.add(currentYear)
    } else if (years.length > 0) {
      initial.add(years[0])
    }
    return initial
  })

  const [isPending, startTransition] = useTransition()
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const toggleYear = (year: number) => {
    setOpenYears((prev) => {
      const next = new Set(prev)
      if (next.has(year)) {
        next.delete(year)
      } else {
        next.add(year)
      }
      return next
    })
  }

  const handleDownload = (payslipId: string) => {
    setDownloadingId(payslipId)
    startTransition(async () => {
      const result = await getPayslipSignedUrl(payslipId)
      setDownloadingId(null)
      if ('error' in result && result.error) {
        toast.error(result.error)
        return
      }
      if ('data' in result && result.data) {
        window.open(result.data, '_blank')
      }
    })
  }

  if (payslips.length === 0) {
    return (
      <div className="text-center py-12 text-muted">
        Aucune fiche de paie disponible
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {years.map((year) => {
        const isOpen = openYears.has(year)
        const items = grouped.get(year) || []

        return (
          <div key={year} className="border border-border rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => toggleYear(year)}
              className="w-full flex items-center justify-between px-4 py-3 bg-surface-hover/50 hover:bg-surface-hover transition-colors"
            >
              <span className="font-semibold text-text">{year}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">
                  {items.length} fiche{items.length > 1 ? 's' : ''}
                </span>
                <svg
                  className={`w-4 h-4 text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            </button>

            {isOpen && (
              <div className="divide-y divide-border">
                {items.map((payslip) => (
                  <div
                    key={payslip.id}
                    className="flex items-center justify-between px-4 py-3 hover:bg-surface-hover/30 transition-colors"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <span className="text-sm font-medium text-text w-24 shrink-0">
                        {MONTH_NAMES[payslip.month - 1]}
                      </span>
                      {showMember && members && (
                        <span className="text-sm text-muted truncate">
                          {getMemberName(payslip.member_id, members)}
                        </span>
                      )}
                      {payslip.label && (
                        <span className="text-xs text-muted bg-surface-dark px-2 py-0.5 rounded">
                          {payslip.label}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDownload(payslip.id)}
                      disabled={isPending && downloadingId === payslip.id}
                      className="px-3 py-1.5 rounded-lg font-semibold text-white text-xs bg-primary hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                    >
                      {isPending && downloadingId === payslip.id ? 'Chargement...' : 'Telecharger'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
