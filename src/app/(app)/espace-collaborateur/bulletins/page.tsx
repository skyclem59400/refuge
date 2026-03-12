import { FileText } from 'lucide-react'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { getPayslips } from '@/lib/actions/payslips'
import { PayslipList } from '@/components/payslips/payslip-list'
import type { Payslip } from '@/lib/types/database'

export default async function MesBulletinsPage() {
  const ctx = await getEstablishmentContext()
  if (!ctx) throw new Error('Establishment context required')

  const payslipsRes = await getPayslips({ memberId: ctx.membership.id })
  const payslips = (payslipsRes.data as Payslip[]) || []

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <FileText className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Mes bulletins de paie</h1>
            <p className="text-sm text-muted mt-1">Consultez et telechargez vos fiches de paie</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <PayslipList payslips={payslips} />
    </div>
  )
}
