import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Share2 } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/server'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { getMetaConnection } from '@/lib/actions/meta-connection'
import { PublicationForm } from '@/components/publications/publication-form'
import type { SocialPost, Animal, MetaConnection } from '@/lib/types/database'

export default async function EditPublicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getEstablishmentContext()
  const estabId = ctx!.establishment.id
  const admin = createAdminClient()

  // Fetch the post
  const { data: postData, error } = await admin
    .from('social_posts')
    .select('*')
    .eq('id', id)
    .eq('establishment_id', estabId)
    .single()

  if (error || !postData) notFound()

  const post = postData as SocialPost

  // Check if editable (only draft, scheduled, or failed)
  const canEdit = ['draft', 'scheduled', 'failed'].includes(post.status)
  if (!canEdit) {
    return (
      <div className="animate-fade-up max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/publications" className="text-muted hover:text-text transition-colors text-sm">
            &larr; Retour
          </Link>
          <h1 className="text-2xl font-bold">Publication non modifiable</h1>
        </div>
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-6 text-center">
          <p className="text-warning font-medium">
            Cette publication a deja ete publiee ou archivee et ne peut plus etre modifiee.
          </p>
          <Link href="/publications" className="text-sm text-primary hover:text-primary-light mt-3 inline-block">
            Retour a la liste
          </Link>
        </div>
      </div>
    )
  }

  // Fetch animals
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
            <h1 className="text-2xl font-bold">Modifier la publication</h1>
            <p className="text-sm text-muted mt-1">
              Modifier le contenu et les parametres de publication
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
        post={post}
      />
    </div>
  )
}
