import { FileSignature } from 'lucide-react'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { getMemberDocuments } from '@/lib/actions/member-documents'
import { MemberDocumentList } from '@/components/employment-docs/member-document-list'
import type { MemberDocument } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

export default async function MesContratsPage() {
  const ctx = await getEstablishmentContext()
  if (!ctx) throw new Error('Establishment context required')

  const res = await getMemberDocuments({ memberId: ctx.membership.id })
  const documents = (res.data || []) as MemberDocument[]

  return (
    <div className="animate-fade-up max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary/10">
          <FileSignature className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Mes contrats &amp; documents RH</h1>
          <p className="text-sm text-muted mt-1">
            Retrouvez votre contrat de travail, avenants et autres documents administratifs.
          </p>
        </div>
      </div>

      <MemberDocumentList documents={documents} />
    </div>
  )
}
