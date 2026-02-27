'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Pencil, Trash2, Clock, Play, RotateCcw, Archive, CalendarOff, Image as ImageIcon,
  Facebook, Instagram, Plus,
} from 'lucide-react'
import {
  deletePost,
  schedulePost,
  unschedulePost,
  retryPost,
  publishPostNow,
  archivePost,
} from '@/lib/actions/social-posts'
import {
  getSocialPostStatusColor,
  getSocialPostStatusLabel,
  getSocialPostTypeLabel,
} from '@/lib/sda-utils'
import { ScheduleDialog } from './schedule-dialog'
import type { SocialPost } from '@/lib/types/database'

type PostWithAnimal = SocialPost & {
  animals?: { id: string; name: string; species: string; photo_url: string | null } | null
}

interface PublicationsListProps {
  posts: PostWithAnimal[]
  canManage: boolean
  hasMetaConnection: boolean
}

function getSpeciesEmoji(species: string): string {
  return species === 'cat' ? '🐱' : species === 'dog' ? '🐶' : '🐾'
}

function formatDateFr(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function PlatformIcons({ platform }: { platform: string }) {
  return (
    <div className="flex items-center gap-1">
      {(platform === 'facebook' || platform === 'both') && (
        <Facebook className="w-3.5 h-3.5 text-blue-500" />
      )}
      {(platform === 'instagram' || platform === 'both') && (
        <Instagram className="w-3.5 h-3.5 text-pink-500" />
      )}
    </div>
  )
}

export function PublicationsList({ posts, canManage, hasMetaConnection }: PublicationsListProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [scheduleDialogPost, setScheduleDialogPost] = useState<string | null>(null)

  function handleAction(postId: string, actionKey: string, action: () => Promise<{ error?: string; success?: boolean; data?: unknown }>) {
    setPendingAction(postId + '-' + actionKey)
    startTransition(async () => {
      const result = await action()
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Action effectuee')
        router.refresh()
      }
      setPendingAction(null)
    })
  }

  function handleDelete(postId: string) {
    if (!confirm('Supprimer cette publication ?')) return
    handleAction(postId, 'delete', () => deletePost(postId))
  }

  function handleUnschedule(postId: string) {
    handleAction(postId, 'unschedule', () => unschedulePost(postId))
  }

  function handleRetry(postId: string) {
    handleAction(postId, 'retry', () => retryPost(postId))
  }

  function handlePublishNow(postId: string) {
    if (!confirm('Publier maintenant sur les reseaux sociaux ?')) return
    handleAction(postId, 'publish', () => publishPostNow(postId))
  }

  function handleArchive(postId: string) {
    handleAction(postId, 'archive', () => archivePost(postId))
  }

  function handleScheduleConfirm(scheduledAt: string) {
    if (!scheduleDialogPost) return
    const postId = scheduleDialogPost
    setScheduleDialogPost(null)
    handleAction(postId, 'schedule', () => schedulePost(postId, scheduledAt))
  }

  if (posts.length === 0) {
    return (
      <div className="bg-surface rounded-xl border border-border p-8 text-center">
        <ImageIcon className="w-10 h-10 text-muted mx-auto mb-3" />
        <p className="text-muted text-sm">Aucune publication</p>
        {canManage && (
          <Link
            href="/publications/nouveau"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg font-semibold text-white text-sm gradient-primary hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Nouvelle publication
          </Link>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => {
          const thumbnail = post.photo_urls?.[0]
          const animalName = post.animals?.name
          const species = post.animals?.species
          const statusColor = getSocialPostStatusColor(post.status)
          const statusLabel = getSocialPostStatusLabel(post.status)
          const typeLabel = getSocialPostTypeLabel(post.type)

          return (
            <div
              key={post.id}
              className="bg-surface rounded-xl border border-border overflow-hidden hover:border-primary/30 transition-colors"
            >
              {/* Thumbnail */}
              <div className="h-32 bg-surface-hover flex items-center justify-center overflow-hidden">
                {thumbnail ? (
                  <img
                    src={thumbnail}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="w-8 h-8 text-muted" />
                )}
              </div>

              {/* Content */}
              <div className="p-4 space-y-3">
                {/* Title row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    {animalName && species ? (
                      <span className="font-medium text-sm truncate">
                        {getSpeciesEmoji(species)} {animalName}
                      </span>
                    ) : (
                      <span className="font-medium text-sm text-muted truncate">{typeLabel}</span>
                    )}
                    <PlatformIcons platform={post.platform} />
                  </div>
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColor}`}>
                    {statusLabel}
                  </span>
                </div>

                {/* Date */}
                <div className="text-xs text-muted">
                  {post.status === 'published' && post.published_at
                    ? `Publie le ${formatDateFr(post.published_at)}`
                    : post.scheduled_at
                      ? `Programme le ${formatDateFr(post.scheduled_at)}`
                      : `Cree le ${formatDateFr(post.created_at)}`}
                </div>

                {/* Content preview */}
                <p className="text-sm text-muted line-clamp-2">
                  {post.content.length > 100 ? post.content.slice(0, 100) + '...' : post.content}
                </p>

                {/* Error message for failed posts */}
                {post.status === 'failed' && post.publish_error && (
                  <p className="text-xs text-error bg-error/10 rounded p-2">
                    {post.publish_error}
                  </p>
                )}

                {/* Actions */}
                {canManage && (
                  <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-border">
                    {/* Draft actions */}
                    {post.status === 'draft' && (
                      <>
                        <Link
                          href={`/publications/${post.id}/edit`}
                          className="px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-surface-hover transition-colors inline-flex items-center gap-1"
                        >
                          <Pencil className="w-3 h-3" /> Editer
                        </Link>
                        <button
                          onClick={() => setScheduleDialogPost(post.id)}
                          disabled={isPending}
                          className="px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-surface-hover transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                        >
                          <Clock className="w-3 h-3" /> Programmer
                        </button>
                        <button
                          onClick={() => handleDelete(post.id)}
                          disabled={isPending && pendingAction === post.id + '-delete'}
                          className="px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-surface-hover transition-colors text-error inline-flex items-center gap-1 disabled:opacity-50"
                        >
                          <Trash2 className="w-3 h-3" /> Supprimer
                        </button>
                      </>
                    )}

                    {/* Scheduled actions */}
                    {post.status === 'scheduled' && (
                      <>
                        <Link
                          href={`/publications/${post.id}/edit`}
                          className="px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-surface-hover transition-colors inline-flex items-center gap-1"
                        >
                          <Pencil className="w-3 h-3" /> Editer
                        </Link>
                        <button
                          onClick={() => handleUnschedule(post.id)}
                          disabled={isPending && pendingAction === post.id + '-unschedule'}
                          className="px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-surface-hover transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                        >
                          <CalendarOff className="w-3 h-3" /> Deprogrammer
                        </button>
                        {hasMetaConnection && (
                          <button
                            onClick={() => handlePublishNow(post.id)}
                            disabled={isPending && pendingAction === post.id + '-publish'}
                            className="px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-surface-hover transition-colors text-success inline-flex items-center gap-1 disabled:opacity-50"
                          >
                            <Play className="w-3 h-3" /> Publier maintenant
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(post.id)}
                          disabled={isPending && pendingAction === post.id + '-delete'}
                          className="px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-surface-hover transition-colors text-error inline-flex items-center gap-1 disabled:opacity-50"
                        >
                          <Trash2 className="w-3 h-3" /> Supprimer
                        </button>
                      </>
                    )}

                    {/* Published actions */}
                    {post.status === 'published' && (
                      <button
                        onClick={() => handleArchive(post.id)}
                        disabled={isPending && pendingAction === post.id + '-archive'}
                        className="px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-surface-hover transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        <Archive className="w-3 h-3" /> Archiver
                      </button>
                    )}

                    {/* Failed actions */}
                    {post.status === 'failed' && (
                      <>
                        <button
                          onClick={() => handleRetry(post.id)}
                          disabled={isPending && pendingAction === post.id + '-retry'}
                          className="px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-surface-hover transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                        >
                          <RotateCcw className="w-3 h-3" /> Retenter
                        </button>
                        <Link
                          href={`/publications/${post.id}/edit`}
                          className="px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-surface-hover transition-colors inline-flex items-center gap-1"
                        >
                          <Pencil className="w-3 h-3" /> Editer
                        </Link>
                        <button
                          onClick={() => handleDelete(post.id)}
                          disabled={isPending && pendingAction === post.id + '-delete'}
                          className="px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-surface-hover transition-colors text-error inline-flex items-center gap-1 disabled:opacity-50"
                        >
                          <Trash2 className="w-3 h-3" /> Supprimer
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Schedule Dialog */}
      <ScheduleDialog
        isOpen={!!scheduleDialogPost}
        onClose={() => setScheduleDialogPost(null)}
        onConfirm={handleScheduleConfirm}
        isPending={isPending}
      />
    </>
  )
}
