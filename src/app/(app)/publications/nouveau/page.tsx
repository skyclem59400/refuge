import Link from 'next/link'
import { ArrowLeft, Share2 } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/server'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { getMetaConnection } from '@/lib/actions/meta-connection'
import { PublicationForm } from '@/components/publications/publication-form'
import type { Animal, MetaConnection } from '@/lib/types/database'

export default async function NewPublicationPage() {
  const ctx = await getEstablishmentContext()
  const estabId = ctx!.establishment.id
  const admin = createAdminClient()

  // Fetch animals in pound, shelter, or foster_family status
  const { data: animalsData } = await admin
    .from('animals')
    .select('id, name, species, status, photo_url')
    .eq('establishment_id', estabId)
    .in('status', ['pound', 'shelter', 'foster_family'])
    .order('name')

  const animals = (animalsData as Pick<Animal, 'id' | 'name' | 'species' | 'status' | 'photo_url'>[]) || []

  // Fetch meta connection status
  const connectionResult = await getMetaConnection().catch(() => ({ data: null as MetaConnection | null }))
  const hasMetaConnection = !!(connectionResult as { data: MetaConnection | null }).data

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/publications"
          className="p-2 rounded-lg hover:bg-surface-hover transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Share2 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Nouvelle publication</h1>
            <p className="text-sm text-muted mt-1">
              Creer une publication pour les reseaux sociaux
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <PublicationForm
        animals={animals}
        establishmentName={ctx!.establishment.name}
        establishmentPhone={ctx!.establishment.phone}
        hasMetaConnection={hasMetaConnection}
      />
    </div>
  )
}
