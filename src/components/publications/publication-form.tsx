'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Image as ImageIcon, Video, X, Sparkles, Clock, Save, Send, Loader2,
  Facebook, Instagram, Film, Search, Check,
} from 'lucide-react'
import { createPostEnhanced, updatePost, schedulePost } from '@/lib/actions/social-posts'
import { uploadSocialMedia, deleteSocialMedia } from '@/lib/actions/social-media'
import { getSocialPostTypeLabel } from '@/lib/sda-utils'
import { VideoPreview } from './video-preview'
import { VideoControls } from './video-controls'
import type { VideoProps } from '@/remotion/types'
import type { SocialPost, SocialPostType, SocialPlatform } from '@/lib/types/database'

interface PublicationFormProps {
  animals: { id: string; name: string; species: string; status: string; photo_url: string | null }[]
  establishmentName: string
  establishmentPhone: string
  establishmentLogoUrl?: string | null
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

export function PublicationForm({ animals, establishmentName, establishmentPhone, establishmentLogoUrl, hasMetaConnection, post }: PublicationFormProps) {
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

  // Animal search state
  const [animalSearch, setAnimalSearch] = useState('')

  // AI generation state
  const [isGenerating, setIsGenerating] = useState(false)

  // Upload state
  const [isUploading, setIsUploading] = useState(false)

  // Video generation state
  const [showVideoPreview, setShowVideoPreview] = useState(false)
  const [isRendering, setIsRendering] = useState(false)
  const [videoText, setVideoText] = useState('')
  const [musicUrl, setMusicUrl] = useState<string | null>(null)
  const [musicTitle, setMusicTitle] = useState('')
  const [isGeneratingVideoText, setIsGeneratingVideoText] = useState(false)

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

  async function generateVideoText(hint?: string) {
    const videoContent = content || contentFacebook || contentInstagram || ''
    if (!videoContent) return

    setIsGeneratingVideoText(true)
    try {
      const selectedAnimal = animals.find(a => a.id === animalId)
      const response = await fetch('/api/ai/generate-video-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postType,
          animalName: selectedAnimal?.name,
          animalSpecies: selectedAnimal?.species,
          content: videoContent,
          establishmentName,
          hint,
        }),
      })

      const data = await response.json()
      if (response.ok && data.videoText) {
        setVideoText(data.videoText)
      }
    } catch {
      // Silently fail
    } finally {
      setIsGeneratingVideoText(false)
    }
  }

  async function autoSelectMusic() {
    try {
      const response = await fetch(`/api/music/search?postType=${postType}`)
      const data = await response.json()
      if (response.ok && data.tracks?.length > 0) {
        const track = data.tracks[0]
        setMusicUrl(track.audioUrl)
        setMusicTitle(`${track.title} - ${track.artist}`)
      }
    } catch {
      // Silently fail
    }
  }

  function handleToggleVideoPreview() {
    const next = !showVideoPreview
    setShowVideoPreview(next)
    if (next) {
      // Auto-generate text and music on first open
      if (!videoText) generateVideoText()
      if (!musicUrl) autoSelectMusic()
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

  function getVideoProps(): VideoProps {
    const selectedAnimal = animals.find(a => a.id === animalId)
    // Use platform-specific content if available, fallback to general content
    const videoContent = content || contentFacebook || contentInstagram || ''
    return {
      postType: postType,
      animalName: selectedAnimal?.name,
      animalSpecies: selectedAnimal?.species,
      photoUrls: selectedAnimal?.photo_url ? [selectedAnimal.photo_url, ...photoUrls] : photoUrls,
      content: videoContent,
      establishmentName: establishmentName,
      establishmentPhone: establishmentPhone,
      logoUrl: establishmentLogoUrl || undefined,
      videoText: videoText || undefined,
      musicUrl: musicUrl || undefined,
    }
  }

  async function handleRenderVideo() {
    setIsRendering(true)
    try {
      const response = await fetch('/api/render-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getVideoProps()),
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || 'Erreur lors du rendu video')
        return
      }

      setVideoUrl(data.url)
      setShowVideoPreview(false)
      toast.success('Video generee avec succes !')
    } catch {
      toast.error('Erreur reseau. Reessayez.')
    } finally {
      setIsRendering(false)
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
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Animal (optionnel)</h3>
          {animalId && !isEdit && (
            <button
              onClick={() => { setAnimalId(''); setAnimalSearch('') }}
              className="text-xs text-muted hover:text-foreground transition-colors"
            >
              Retirer la selection
            </button>
          )}
        </div>

        {/* Selected animal display */}
        {animalId && (() => {
          const selected = animals.find(a => a.id === animalId)
          if (!selected) return null
          return (
            <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
              {selected.photo_url ? (
                <img src={selected.photo_url} alt={selected.name} className="w-12 h-12 rounded-lg object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-surface-hover flex items-center justify-center text-lg">
                  {getSpeciesEmoji(selected.species)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{selected.name}</p>
                <p className="text-xs text-muted">{selected.species === 'dog' ? 'Chien' : selected.species === 'cat' ? 'Chat' : selected.species}</p>
              </div>
              <Check className="w-4 h-4 text-primary" />
            </div>
          )
        })()}

        {/* Search and list */}
        {!isEdit && (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                value={animalSearch}
                onChange={(e) => setAnimalSearch(e.target.value)}
                placeholder="Rechercher un animal..."
                className="w-full pl-9 pr-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1">
              {/* General publication option */}
              {!animalSearch && (
                <button
                  onClick={() => setAnimalId('')}
                  className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${
                    !animalId ? 'bg-primary/10 border border-primary/20' : 'hover:bg-surface-hover'
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg bg-surface-hover flex items-center justify-center text-sm">
                    📢
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Publication generale</p>
                    <p className="text-xs text-muted">Sans animal associe</p>
                  </div>
                </button>
              )}

              {animals
                .filter(a => {
                  if (!animalSearch) return true
                  const q = animalSearch.toLowerCase()
                  return a.name.toLowerCase().includes(q) || a.species.toLowerCase().includes(q)
                })
                .map((animal) => (
                  <button
                    key={animal.id}
                    onClick={() => { setAnimalId(animal.id); setAnimalSearch('') }}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${
                      animalId === animal.id ? 'bg-primary/10 border border-primary/20' : 'hover:bg-surface-hover'
                    }`}
                  >
                    {animal.photo_url ? (
                      <img src={animal.photo_url} alt={animal.name} className="w-10 h-10 rounded-lg object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-surface-hover flex items-center justify-center text-sm">
                        {getSpeciesEmoji(animal.species)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{animal.name}</p>
                      <p className="text-xs text-muted">
                        {animal.species === 'dog' ? 'Chien' : animal.species === 'cat' ? 'Chat' : animal.species}
                      </p>
                    </div>
                    {animalId === animal.id && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                  </button>
                ))}

              {animalSearch && animals.filter(a => {
                const q = animalSearch.toLowerCase()
                return a.name.toLowerCase().includes(q) || a.species.toLowerCase().includes(q)
              }).length === 0 && (
                <p className="text-xs text-muted text-center py-3">Aucun animal trouve</p>
              )}
            </div>
          </div>
        )}
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
          <button
            onClick={handleToggleVideoPreview}
            disabled={!!videoUrl}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-50
              ${showVideoPreview
                ? 'bg-primary/15 text-primary border border-primary/30'
                : 'border border-border hover:bg-surface-hover'
              }`}
          >
            <Film className="w-3.5 h-3.5" />
            {showVideoPreview ? 'Masquer preview' : 'Generer une video'}
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

        {/* Remotion video preview */}
        {showVideoPreview && !videoUrl && (
          <>
            <VideoPreview
              videoProps={getVideoProps()}
              onRender={handleRenderVideo}
              isRendering={isRendering}
            />
            <VideoControls
              videoText={videoText}
              onVideoTextChange={setVideoText}
              musicUrl={musicUrl}
              musicTitle={musicTitle}
              onMusicChange={(url, title) => {
                setMusicUrl(url)
                setMusicTitle(title)
              }}
              postType={postType}
              isGeneratingText={isGeneratingVideoText}
              onRegenerateText={generateVideoText}
            />
          </>
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
