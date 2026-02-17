import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { DocumentList } from '@/components/documents/document-list'
import type { Document } from '@/lib/types/database'

export default async function DocumentsPage() {
  const supabase = await createClient()
  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="animate-fade-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Documents</h1>
          <p className="text-sm text-muted mt-1">Gerez vos devis et factures</p>
        </div>
        <Link
          href="/documents/nouveau"
          className="px-4 py-2 rounded-lg font-semibold text-white text-sm gradient-primary hover:opacity-90 transition-opacity shadow-lg shadow-primary/25"
        >
          + Nouveau document
        </Link>
      </div>

      <DocumentList initialData={(documents as Document[]) || []} />
    </div>
  )
}
