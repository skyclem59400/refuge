'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Image as ImageIcon, Video, X, Sparkles, Clock, Save, Send, Loader2,
  Facebook, Instagram,
} from 'lucide-react'
import { createPostEnhanced, updatePost, schedulePost } from '@/lib/actions/social-posts'
import { uploadSocialMedia, deleteSocialMedia } from '@/lib/actions/social-media'
import { getSocialPostTypeLabel } from '@/lib/sda-utils'
import type { SocialPost, SocialPostType, SocialPlatform } from '@/lib/types/database'

interface PublicationFormProps {
  animals: { id: string; name: string; species: string; status: string; photo_url: string | null }[]
  establishmentName: string
  establishmentPhone: string
  hasMetaConnection: boolean
  post?: SocialPost | null
}

const POST_TYPES: { value: SocialPostType; label: string }[] = [
  { value: 'search_owner', label: getSocialPostTypeLabel('search_owner') },
  { value: 'adoption', label: getSocialPostTypeLabel('adoption') },
  { value: 'event', label: getSocialPostTypeLabel('event') },
  { value: 'info', label: getSocialPostTypeLabel('info') },
  { value: 'other', label: getSocialPostTypeLabel('other') },
]

const PLATFORM_OPTIONS: { value: SocialPlatform; label: string; Icon: typeof Facebook }[] = [
  { value: 'facebook', label: 'Facebook', Icon: Facebook },
  { value: 'instagram', label: 'Instagram', Icon: Instagram },
  { value: 'both', label: 'Les deux', Icon: Send },
]

function getSpeciesEmoji(species: string): string {
  return species === 'cat' ? '🐱' : species === 'dog' ? '🐶' : '🐾'
}

export function PublicationForm({ animals, establishmentName, establishmentPhone, hasMetaConnection, post }: PublicationFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const photoInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  const isEdit = !!post

  // Form fields
  const [animalId, setAnimalId] = useState<string>(post?.animal_id || '')
  const [postType, setPostType] = useState<SocialPostType>(post?.type || 'adoption')
  const [platform, setPlatform] = useState<SocialPlatform>(post?.platform || 'both')
  const [content, setContent] = useState(post?.content || '')
  const [contentFacebook, setContentFacebook] = useState(post?.content_facebook || '')
  const [contentInstagram, setContentInstagram] = useState(post?.content_instagram || '')
  const [photoUrls, setPhotoUrls] = useState<string[]>(post?.photo_urls || [])
  const [videoUrl, setVideoUrl] = useState<string | null>(post?.video_url || null)
  const [scheduleEnabled, setScheduleEnabled] = useState(!!post?.scheduled_at)
  const [scheduleDate, setScheduleDate] = useState(
    post?.scheduled_at ? new Date(post.scheduled_at).toISOString().split('T')[0] : ''
  )
  const [scheduleTime, setScheduleTime] = useState(
    post?.scheduled_at ? new Date(post.scheduled_at).toTimeString().slice(0, 5) : '09:00'
  )

  // AI generation state
  const [isGenerating, setIsGenerating] = useState(false)

  // Upload state
  const [isUploading, setIsUploading] = useState(false)

  async function handleAIGenerate() {
    if (!animalId) {
      toast.error('Selectionnez un animal pour generer le texte avec l\'IA')
      return
    }

    setIsGenerating(true)
    try {
      const response = await fetch('/api/ai/generate-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          animalId,
          postType,
          platform,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || 'Erreur lors de la generation')
        return
      }

      if (platform === 'both') {
        setContent(data.content)
        // Also populate platform-specific if empty
        if (!contentFacebook) setContentFacebook(data.content)
        if (!contentInstagram) setContentInstagram(data.content)
      } else {
        setContent(data.content)
      }

      toast.success('Texte genere avec l\'IA')
    } catch {
      toast.error('Erreur reseau. Reessayez.')
    } finally {
      setIsGenerating(false)
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    if (photoUrls.length + files.length > 10) {
      toast.error('Maximum 10 photos')
      return
    }

    setIsUploading(true)
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)
        const result = await uploadSocialMedia(formData)
        if (result.error) {
          toast.error(result.error)
          break
        }
        if (result.data) {
          setPhotoUrls((prev) => [...prev, result.data!.url])
        }
      }
    } finally {
      setIsUploading(false)
      if (photoInputRef.current) photoInputRef.current.value = ''
    }
  }

  async function handleVideoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const result = await uploadSocialMedia(formData)
      if (result.error) {
        toast.error(result.error)
        return
      }
      if (result.data) {
        setVideoUrl(result.data.url)
      }
    } finally {
      setIsUploading(false)
      if (videoInputRef.current) videoInputRef.current.value = ''
    }
  }

  async function handleRemovePhoto(url: string) {
    setPhotoUrls((prev) => prev.filter((u) => u !== url))
    // Delete from storage in the background
    await deleteSocialMedia(url)
  }

  async function handleRemoveVideo() {
    if (videoUrl) {
      const url = videoUrl
      setVideoUrl(null)
      await deleteSocialMedia(url)
    }
  }

  function buildScheduledAt(): string | null {
    if (!scheduleEnabled || !scheduleDate || !scheduleTime) return null
    return new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString()
  }

  function handleSaveDraft() {
    startTransition(async () => {
      if (isEdit && post) {
        const result = await updatePost(post.id, {
          content,
          platform,
          photo_urls: photoUrls,
        })
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success('Publication mise a jour')
      } else {
        const result = await createPostEnhanced({
          animal_id: animalId || null,
          type: postType,
          platform,
          content,
          content_facebook: platform === 'both' ? contentFacebook || null : null,
          content_instagram: platform === 'both' ? contentInstagram || null : null,
          photo_urls: photoUrls,
          video_url: videoUrl,
        })
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success('Brouillon enregistre')
      }
      router.push('/publications')
    })
  }

  function handleSchedule() {
    const scheduledAt = buildScheduledAt()
    if (!scheduledAt) {
      toast.error('Veuillez definir une date et heure de programmation')
      return
    }

    const scheduledDate = new Date(scheduledAt)
    const minDate = new Date(Date.now() + 10 * 60 * 1000)
    if (scheduledDate < minDate) {
      toast.error('La date doit etre au moins 10 minutes dans le futur')
      return
    }

    startTransition(async () => {
      if (isEdit && post) {
        // Update first, then schedule
        const updateResult = await updatePost(post.id, {
          content,
          platform,
          photo_urls: photoUrls,
        })
        if (updateResult.error) {
          toast.error(updateResult.error)
          return
        }
        const scheduleResult = await schedulePost(post.id, scheduledAt)
        if (scheduleResult.error) {
          toast.error(scheduleResult.error)
          return
        }
        toast.success('Publication programmee')
      } else {
        const result = await createPostEnhanced({
          animal_id: animalId || null,
          type: postType,
          platform,
          content,
          content_facebook: platform === 'both' ? contentFacebook || null : null,
          content_instagram: platform === 'both' ? contentInstagram || null : null,
          photo_urls: photoUrls,
          video_url: videoUrl,
          scheduled_at: scheduledAt,
        })
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success('Publication programmee')
      }
      router.push('/publications')
    })
  }

  function handlePublishNow() {
    if (!hasMetaConnection) {
      toast.error('Aucune connexion Meta configuree. Allez dans les parametres.')
      return
    }
    if (!confirm('Publier maintenant sur les reseaux sociaux ?')) return

    startTransition(async () => {
      // Create the post first if new, then publish
      if (isEdit && post) {
        const updateResult = await updatePost(post.id, {
          content,
          platform,
          photo_urls: photoUrls,
        })
        if (updateResult.error) {
          toast.error(updateResult.error)
          return
        }
        // Import and call publishPostNow
        const { publishPostNow } = await import('@/lib/actions/social-posts')
        const publishResult = await publishPostNow(post.id)
        if (publishResult.error) {
          toast.error(publishResult.error)
          return
        }
        toast.success('Publication publiee avec succes !')
      } else {
        // Create as draft first
        const createResult = await createPostEnhanced({
          animal_id: animalId || null,
          type: postType,
          platform,
          content,
          content_facebook: platform === 'both' ? contentFacebook || null : null,
          content_instagram: platform === 'both' ? contentInstagram || null : null,
          photo_urls: photoUrls,
          video_url: videoUrl,
        })
        if (createResult.error) {
          toast.error(createResult.error)
          return
        }
        // Publish the created post
        const { publishPostNow } = await import('@/lib/actions/social-posts')
        const publishResult = await publishPostNow(createResult.data!.id)
        if (publishResult.error) {
          toast.error(publishResult.error)
          return
        }
        toast.success('Publication publiee avec succes !')
      }
      router.push('/publications')
    })
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Animal selector */}
      <div className="bg-surface rounded-xl border border-border p-5 space-y-4">
        <h3 className="font-semibold">Animal (optionnel)</h3>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
            Animal concerne
          </label>
          <select
            value={animalId}
            onChange={(e) => setAnimalId(e.target.value)}
            disabled={isEdit}
            className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
          >
            <option value="">Publication generale</option>
            {animals.map((animal) => (
              <option key={animal.id} value={animal.id}>
                {getSpeciesEmoji(animal.species)} {animal.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Post type */}
      <div className="bg-surface rounded-xl border border-border p-5 space-y-4">
        <h3 className="font-semibold">Type de publication</h3>
        <div className="flex flex-wrap gap-2">
          {POST_TYPES.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPostType(opt.value)}
              disabled={isEdit}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                postType === opt.value
                  ? 'gradient-primary text-white'
                  : 'border border-border hover:bg-surface-hover'
              } disabled:opacity-50`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Platform selector */}
      <div className="bg-surface rounded-xl border border-border p-5 space-y-4">
        <h3 className="font-semibold">Plateforme</h3>
        <div className="flex flex-wrap gap-2">
          {PLATFORM_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPlatform(opt.value)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                platform === opt.value
                  ? 'gradient-primary text-white'
                  : 'border border-border hover:bg-surface-hover'
              }`}
            >
              <opt.Icon className="w-3.5 h-3.5" />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="bg-surface rounded-xl border border-border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Contenu</h3>
          {animalId && (
            <button
              onClick={handleAIGenerate}
              disabled={isGenerating}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-primary/30 text-xs font-medium text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
            >
              {isGenerating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              {isGenerating ? 'Generation...' : 'Generer avec l\'IA'}
            </button>
          )}
        </div>

        {platform === 'both' ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                Contenu general
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
                placeholder="Texte principal de la publication..."
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                <Facebook className="w-3 h-3 inline mr-1 text-blue-500" />
                Contenu Facebook (optionnel)
              </label>
              <textarea
                value={contentFacebook}
                onChange={(e) => setContentFacebook(e.target.value)}
                rows={3}
                placeholder="Surcharger le contenu pour Facebook..."
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                <Instagram className="w-3 h-3 inline mr-1 text-pink-500" />
                Contenu Instagram (optionnel)
              </label>
              <textarea
                value={contentInstagram}
                onChange={(e) => setContentInstagram(e.target.value)}
                rows={3}
                placeholder="Surcharger le contenu pour Instagram..."
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
              />
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
              Contenu
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              placeholder="Texte de la publication..."
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
            />
          </div>
        )}
      </div>

      {/* Media */}
      <div className="bg-surface rounded-xl border border-border p-5 space-y-4">
        <h3 className="font-semibold">Medias</h3>

        <div className="flex items-center gap-3">
          <button
            onClick={() => photoInputRef.current?.click()}
            disabled={isUploading || photoUrls.length >= 10}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-surface-hover transition-colors disabled:opacity-50"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            {isUploading ? 'Upload...' : `Photos (${photoUrls.length}/10)`}
          </button>
          <button
            onClick={() => videoInputRef.current?.click()}
            disabled={isUploading || !!videoUrl}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-surface-hover transition-colors disabled:opacity-50"
          >
            <Video className="w-3.5 h-3.5" />
            {videoUrl ? 'Video ajoutee' : 'Video'}
          </button>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handlePhotoUpload}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleVideoUpload}
          />
        </div>

        {/* Photo previews */}
        {photoUrls.length > 0 && (
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
            {photoUrls.map((url) => (
              <div key={url} className="relative group aspect-square rounded-lg overflow-hidden border border-border">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => handleRemovePhoto(url)}
                  className="absolute top-1 right-1 p-1 bg-black/60 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Video preview */}
        {videoUrl && (
          <div className="relative inline-block">
            <video
              src={videoUrl}
              className="w-48 h-32 rounded-lg border border-border object-cover"
              controls
            />
            <button
              onClick={handleRemoveVideo}
              className="absolute top-1 right-1 p-1 bg-black/60 rounded-full text-white"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Scheduling */}
      <div className="bg-surface rounded-xl border border-border p-5 space-y-4">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="schedule-toggle"
            checked={scheduleEnabled}
            onChange={(e) => setScheduleEnabled(e.target.checked)}
            className="w-4 h-4 rounded border-border text-primary focus:ring-primary/50"
          />
          <label htmlFor="schedule-toggle" className="font-semibold text-sm cursor-pointer">
            Programmer la publication
          </label>
        </div>

        {scheduleEnabled && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                Date
              </label>
              <input
                type="date"
                value={scheduleDate}
                min={today}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                Heure
              </label>
              <input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handleSaveDraft}
          disabled={isPending || !content.trim()}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-border font-semibold text-sm hover:bg-surface-hover transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {isPending ? 'Enregistrement...' : 'Sauvegarder comme brouillon'}
        </button>

        {scheduleEnabled && (
          <button
            onClick={handleSchedule}
            disabled={isPending || !content.trim() || !scheduleDate || !scheduleTime}
            className="inline-flex items-center gap-2 gradient-primary hover:opacity-90 transition-opacity text-white px-6 py-3 rounded-lg font-semibold text-sm disabled:opacity-50"
          >
            <Clock className="w-4 h-4" />
            {isPending ? 'Programmation...' : 'Programmer'}
          </button>
        )}

        {hasMetaConnection && (
          <button
            onClick={handlePublishNow}
            disabled={isPending || !content.trim()}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm text-white bg-success hover:bg-success/90 transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {isPending ? 'Publication...' : 'Publier maintenant'}
          </button>
        )}
      </div>
    </div>
  )
}
