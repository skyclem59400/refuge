import { FileSignature } from 'lucide-react'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { createAdminClient } from '@/lib/supabase/server'
import { getMemberDocuments } from '@/lib/actions/member-documents'
import { MemberDocumentUpload } from '@/components/employment-docs/member-document-upload'
import { MemberDocumentList } from '@/components/employment-docs/member-document-list'
import type { EstablishmentMember, MemberDocument } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

export default async function AdminContratsPage() {
  const ctx = await getEstablishmentContext()
  if (!ctx) throw new Error('Establishment context required')
  if (!ctx.permissions.canManagePayslips) {
    throw new Error('Permissions insuffisantes')
  }

  const admin = createAdminClient()
  const [docsResult, membersResult] = await Promise.all([
    getMemberDocuments(),
    admin
      .from('establishment_members')
      .select('*')
      .eq('establishment_id', ctx.establishment.id)
      .in('contract_type', ['salarie', 'auto_entrepreneur']),
  ])

  // Enrichir avec full_name depuis auth.users
  const members = (membersResult.data || []) as EstablishmentMember[]
  const userIds = members.map((m) => m.user_id).filter(Boolean) as string[]
  if (userIds.length > 0) {
    const { data: usersInfo } = await admin.rpc('get_users_info', { user_ids: userIds })
    if (usersInfo && Array.isArray(usersInfo)) {
      for (const u of usersInfo) {
        const m = members.find((mm) => mm.user_id === u.id)
        if (m) {
          m.full_name = u.full_name || null
          m.email = u.email || undefined
        }
      }
    }
  }

  const documents = (docsResult.data || []) as MemberDocument[]

  return (
    <div className="animate-fade-up">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <FileSignature className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Contrats &amp; documents RH</h1>
            <p className="text-sm text-muted mt-1">
              Contrats de travail, avenants, attestations — un document par fichier, regroupés par collaborateur.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-border p-5 mb-6">
        <h2 className="text-lg font-bold text-text mb-4">Importer un document</h2>
        <MemberDocumentUpload members={members} />
      </div>

      <div>
        <h2 className="text-lg font-bold text-text mb-4">Tous les documents</h2>
        <MemberDocumentList
          documents={documents}
          showMember
          members={members}
          canDelete
        />
      </div>
    </div>
  )
}
