import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { DocumentForm } from '@/components/documents/document-form'
import type { Document, Client } from '@/lib/types/database'

export default async function EditDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getEstablishmentContext()
  const estabId = ctx!.establishment.id
  const admin = createAdminClient()

  const { data: document, error } = await admin
    .from('documents')
    .select('*')
    .eq('id', id)
    .eq('establishment_id', estabId)
    .single()

  if (error || !document) notFound()

  const doc = document as Document

  // Check editability
  const isFactureNonDraft = doc.type === 'facture' && doc.status !== 'draft'
  const isConverted = doc.status === 'converted'
  const isAvoir = doc.type === 'avoir'
  const isReadOnly = isFactureNonDraft || isConverted || isAvoir || !ctx!.permissions.canManageDocuments

  // Fetch linked client if exists
  let client: Client | null = null
  if (doc.client_id) {
    const { data: clientData } = await admin
      .from('clients')
      .select('*')
      .eq('id', doc.client_id)
      .single()
    client = clientData as Client | null
  }

  return (
    <div className="animate-fade-up">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/documents" className="text-muted hover:text-text transition-colors text-sm">
          &larr; Retour
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Modifier {doc.numero}</h1>
          <p className="text-sm text-muted mt-1">
            {doc.type === 'facture' ? 'Facture' : doc.type === 'avoir' ? 'Avoir' : 'Devis'}
          </p>
        </div>
      </div>

      {isReadOnly ? (
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-6 text-center">
          <p className="text-warning font-medium">
            {!ctx!.permissions.canManageDocuments
              ? "Vous n'avez pas les droits pour modifier les documents."
              : isFactureNonDraft
                ? 'Une facture validee ne peut plus etre modifiee.'
                : isAvoir
                  ? 'Un avoir ne peut pas etre modifie.'
                  : 'Un devis converti ne peut plus etre modifie.'}
          </p>
          <Link href="/documents" className="text-sm text-primary hover:text-primary-light mt-3 inline-block">
            Retour a la liste
          </Link>
        </div>
      ) : (
        <DocumentForm document={doc} initialClient={client} establishmentId={estabId} />
      )}
    </div>
  )
}
