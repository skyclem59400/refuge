import Link from 'next/link'
import { Share2, Plus, Wifi, WifiOff } from 'lucide-react'
import { getAllPosts } from '@/lib/actions/social-posts'
import { getMetaConnection } from '@/lib/actions/meta-connection'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { PublicationsStats } from '@/components/publications/publications-stats'
import { PublicationsList } from '@/components/publications/publications-list'
import { PublicationsCalendar } from '@/components/publications/publications-calendar'
import { MetaConnectionSettings } from '@/components/publications/meta-connection-settings'
import type { SocialPost, SocialPostStatus, MetaConnection } from '@/lib/types/database'

type PostWithAnimal = SocialPost & {
  animals?: { id: string; name: string; species: string; photo_url: string | null } | null
}

export default async function PublicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; status?: string }>
}) {
  const params = await searchParams
  const ctx = await getEstablishmentContext()
  const canManage = ctx?.permissions.canManagePosts ?? false

  const view = params.view || 'list'
  const statusFilter = params.status as SocialPostStatus | undefined

  // Fetch data in parallel
  const [postsResult, connectionResult] = await Promise.all([
    getAllPosts(statusFilter ? { status: statusFilter } : undefined),
    getMetaConnection().catch(() => ({ data: null as MetaConnection | null })),
  ])

  const posts = (postsResult.data as PostWithAnimal[]) || []
  const connection = (connectionResult as { data: MetaConnection | null }).data ?? null
  const hasMetaConnection = !!connection

  // Compute stats
  const stats = {
    drafts: posts.filter((p) => p.status === 'draft').length,
    scheduled: posts.filter((p) => p.status === 'scheduled').length,
    published: posts.filter((p) => p.status === 'published').length,
    failed: posts.filter((p) => p.status === 'failed').length,
  }

  // Filter posts for the list view only if a status filter is applied
  const filteredPosts = statusFilter
    ? posts.filter((p) => p.status === statusFilter)
    : posts

  const views = [
    { key: 'list', label: 'Liste' },
    { key: 'calendar', label: 'Calendrier' },
    { key: 'settings', label: 'Parametres Meta' },
  ]

  const statusFilters: { key: string; label: string }[] = [
    { key: '', label: 'Toutes' },
    { key: 'draft', label: 'Brouillons' },
    { key: 'scheduled', label: 'Programmes' },
    { key: 'published', label: 'Publies' },
    { key: 'failed', label: 'Echecs' },
  ]

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Share2 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Publications</h1>
            <p className="text-sm text-muted mt-1">
              Gestion des publications sur les reseaux sociaux
            </p>
          </div>
        </div>

        {canManage && (
          <Link
            href="/publications/nouveau"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white text-sm gradient-primary hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Nouvelle publication
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="mb-6">
        <PublicationsStats stats={stats} />
      </div>

      {/* Meta connection banner */}
      <div className={`mb-6 rounded-xl border p-4 flex items-center justify-between ${
        hasMetaConnection
          ? 'bg-success/5 border-success/20'
          : 'bg-warning/5 border-warning/20'
      }`}>
        <div className="flex items-center gap-3">
          {hasMetaConnection ? (
            <>
              <Wifi className="w-5 h-5 text-success" />
              <span className="text-sm">
                Connecte a <span className="font-semibold">{connection!.facebook_page_name}</span>
              </span>
            </>
          ) : (
            <>
              <WifiOff className="w-5 h-5 text-warning" />
              <span className="text-sm text-muted">Non connecte aux reseaux sociaux</span>
            </>
          )}
        </div>
        <Link
          href="/publications?view=settings"
          className="px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-surface-hover transition-colors"
        >
          {hasMetaConnection ? 'Parametres' : 'Configurer'}
        </Link>
      </div>

      {/* View tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-border">
        {views.map((v) => (
          <Link
            key={v.key}
            href={`/publications?view=${v.key}${statusFilter ? `&status=${statusFilter}` : ''}`}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              view === v.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-text'
            }`}
          >
            {v.label}
          </Link>
        ))}
      </div>

      {/* Status filter tabs (only for list view) */}
      {view === 'list' && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {statusFilters.map((sf) => (
            <Link
              key={sf.key}
              href={`/publications?view=list${sf.key ? `&status=${sf.key}` : ''}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                (statusFilter || '') === sf.key
                  ? 'gradient-primary text-white'
                  : 'border border-border hover:bg-surface-hover'
              }`}
            >
              {sf.label}
            </Link>
          ))}
        </div>
      )}

      {/* Content */}
      {view === 'list' && (
        <PublicationsList
          posts={filteredPosts}
          canManage={canManage}
          hasMetaConnection={hasMetaConnection}
        />
      )}

      {view === 'calendar' && (
        <PublicationsCalendar posts={posts} />
      )}

      {view === 'settings' && (
        <MetaConnectionSettings connection={connection} />
      )}
    </div>
  )
}
