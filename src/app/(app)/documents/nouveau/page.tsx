import Link from 'next/link'
import { DocumentForm } from '@/components/documents/document-form'

export default function NouveauDocumentPage() {
  return (
    <div className="animate-fade-up">
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/documents"
          className="text-muted hover:text-white transition-colors"
        >
          ← Retour
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Nouveau document</h1>
          <p className="text-sm text-muted mt-1">Creer un devis ou une facture</p>
        </div>
      </div>

      <DocumentForm />
    </div>
  )
}
