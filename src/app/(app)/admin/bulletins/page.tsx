import { FileText } from 'lucide-react'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { getPayslips } from '@/lib/actions/payslips'
import { createAdminClient } from '@/lib/supabase/server'
import { PayslipUpload } from '@/components/payslips/payslip-upload'
import { PayslipList } from '@/components/payslips/payslip-list'
import type { EstablishmentMember, Payslip } from '@/lib/types/database'

export default async function AdminBulletinsPage() {
  const ctx = await getEstablishmentContext()
  if (!ctx) throw new Error('Establishment context required')

  if (!ctx.permissions.canManagePayslips) {
    throw new Error('Permissions insuffisantes')
  }

  // Fetch all data in parallel
  const admin = createAdminClient()
  const [payslipsResult, membersResult] = await Promise.all([
    getPayslips(),
    admin
      .from('establishment_members')
      .select('*')
      .eq('establishment_id', ctx.establishment.id),
  ])

  const payslips = (payslipsResult.data || []) as Payslip[]
  const members = (membersResult.data || []) as EstablishmentMember[]

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <FileText className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Bulletins de paie</h1>
            <p className="text-sm text-muted mt-1">Upload et gestion des fiches de paie</p>
          </div>
        </div>
      </div>

      {/* Upload form */}
      <div className="bg-surface rounded-xl border border-border p-5 mb-6">
        <h2 className="text-lg font-bold text-text mb-4">Importer un bulletin</h2>
        <PayslipUpload members={members} />
      </div>

      {/* Payslip list */}
      <div>
        <h2 className="text-lg font-bold text-text mb-4">Tous les bulletins</h2>
        <PayslipList
          payslips={payslips}
          showMember={true}
          members={members}
        />
      </div>
    </div>
  )
}
