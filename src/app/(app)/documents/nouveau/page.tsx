import Link from 'next/link'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { DocumentForm } from '@/components/documents/document-form'

export default async function NouveauDocumentPage() {
  const ctx = await getEstablishmentContext()

  return (
    <div className="animate-fade-up">
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/documents"
          className="text-muted hover:text-text transition-colors"
        >
          &larr; Retour
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Nouveau document</h1>
          <p className="text-sm text-muted mt-1">Creer un devis ou une facture</p>
        </div>
      </div>

      <DocumentForm establishmentId={ctx!.establishment.id} />
    </div>
  )
}
