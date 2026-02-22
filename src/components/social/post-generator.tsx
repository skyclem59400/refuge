'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Image from 'next/image'
import {
  Sparkles,
  Save,
  RefreshCw,
  Loader2,
  MapPin,
  Calendar,
  Phone,
  Pencil,
  Camera,
} from 'lucide-react'
import { createPost } from '@/lib/actions/social-posts'
import type { Animal, SocialPostType, SocialPlatform } from '@/lib/types/database'

interface PostGeneratorProps {
  animal: Animal
  photos: { id: string; url: string; is_primary: boolean }[]
  establishmentName: string
  establishmentPhone: string
  onPostCreated?: () => void
}

const postTypeLabels: Record<SocialPostType, string> = {
  search_owner: 'Recherche proprietaire',
  adoption: 'A l\'adoption',
}

const postTypeBadges: Record<SocialPostType, string> = {
  search_owner: 'RECHERCHE PROPRIETAIRE',
  adoption: 'A L\'ADOPTION',
}

const platformLabels: Record<SocialPlatform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  both: 'Les deux',
}

export function PostGenerator({
  animal,
  photos,
  establishmentName,
  establishmentPhone,
  onPostCreated,
}: PostGeneratorProps) {
  const defaultPostType: SocialPostType = animal.status === 'pound' ? 'search_owner' : 'adoption'
  const primaryPhoto = photos.find((p) => p.is_primary) || photos[0] || null

  const [postType, setPostType] = useState<SocialPostType>(defaultPostType)
  const [platform, setPlatform] = useState<SocialPlatform>('both')
  const [additionalNotes, setAdditionalNotes] = useState('')
  const [generatedContent, setGeneratedContent] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [showEditor, setShowEditor] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const captureDate = animal.pound_entry_date
    ? new Date(animal.pound_entry_date).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null

  async function handleGenerate() {
    setIsGenerating(true)
    setShowEditor(false)

    try {
      const response = await fetch('/api/ai/generate-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          animalId: animal.id,
          postType,
          platform,
          additionalNotes,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.error || 'Erreur lors de la generation')
      }

      const data = await response.json()
      setGeneratedContent(data.content || '')
    } catch (error) {
      toast.error((error as Error).message || 'Erreur lors de la generation')
    } finally {
      setIsGenerating(false)
    }
  }

  function handleSaveDraft() {
    if (!generatedContent.trim()) {
      toast.error('Le contenu ne peut pas etre vide')
      return
    }

    const selectedUrls = primaryPhoto ? [primaryPhoto.url] : []

    startTransition(async () => {
      const result = await createPost({
        animal_id: animal.id,
        type: postType,
        platform,
        content: generatedContent.trim(),
        photo_urls: selectedUrls,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Brouillon sauvegarde !')
        router.refresh()
        onPostCreated?.()
      }
    })
  }

  const inputClass =
    'w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50'
  const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5'

  return (
    <div className="space-y-6">
      {/* Configuration */}
      <div className="bg-surface rounded-xl border border-border p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Type de publication</label>
            <select
              value={postType}
              onChange={(e) => setPostType(e.target.value as SocialPostType)}
              className={inputClass}
              disabled={isGenerating}
            >
              {Object.entries(postTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Plateforme</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as SocialPlatform)}
              className={inputClass}
              disabled={isGenerating}
            >
              {Object.entries(platformLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass}>Notes supplementaires (optionnel)</label>
          <textarea
            value={additionalNotes}
            onChange={(e) => setAdditionalNotes(e.target.value)}
            placeholder="Caractere de l'animal, urgence, details..."
            rows={2}
            className={`${inputClass} resize-y`}
            disabled={isGenerating}
          />
        </div>

        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="gradient-primary hover:opacity-90 transition-opacity text-white px-6 py-3 rounded-lg font-semibold text-sm flex items-center gap-2 shadow-lg shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generation en cours...
              </>
            ) : generatedContent ? (
              <>
                <RefreshCw className="h-4 w-4" />
                Regenerer
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generer avec l&apos;IA
              </>
            )}
          </button>
        </div>
      </div>

      {/* Visual card preview */}
      {generatedContent && (
        <div className="space-y-4 animate-fade-up">
          {/* Card */}
          <div className="mx-auto max-w-md">
            <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-surface-dark shadow-xl">
              {/* Photo background */}
              {primaryPhoto ? (
                <Image
                  src={primaryPhoto.url}
                  alt={animal.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 448px) 100vw, 448px"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-surface-dark">
                  <Camera className="h-20 w-20 text-muted/20" />
                </div>
              )}

              {/* Dark gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10" />

              {/* Top branding bar */}
              <div className="absolute top-0 left-0 right-0 p-4">
                <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md rounded-full px-3.5 py-1.5">
                  <div className="w-5 h-5 rounded-full gradient-primary flex items-center justify-center shrink-0">
                    <span className="text-white text-[7px] font-extrabold leading-none">SDA</span>
                  </div>
                  <span className="text-white text-xs font-bold tracking-wider uppercase">
                    {establishmentName}
                  </span>
                </div>
              </div>

              {/* Bottom content overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-5 space-y-2.5">
                {/* Type badge */}
                <span className="inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/80 text-white backdrop-blur-sm">
                  {postTypeBadges[postType]}
                </span>

                {/* Animal name */}
                <h2 className="text-3xl font-extrabold text-white tracking-tight">
                  {animal.name}
                </h2>

                {/* Location & date */}
                <div className="flex flex-wrap gap-3 text-white/80 text-sm">
                  {animal.capture_location && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      {animal.capture_location}
                    </span>
                  )}
                  {captureDate && (
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      {captureDate}
                    </span>
                  )}
                </div>

                {/* Short text preview */}
                <p className="text-white/90 text-sm leading-relaxed line-clamp-3">
                  {generatedContent}
                </p>

                {/* Footer with contact */}
                <div className="pt-2 border-t border-white/20 flex items-center gap-2 text-white/50 text-xs">
                  <span className="font-medium">{establishmentName}</span>
                  {establishmentPhone && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {establishmentPhone}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Editor & actions */}
          <div className="bg-surface rounded-xl border border-border p-5 space-y-4">
            <button
              type="button"
              onClick={() => setShowEditor(!showEditor)}
              className="flex items-center gap-2 text-sm font-medium text-muted hover:text-text transition-colors"
            >
              <Pencil className="w-4 h-4" />
              {showEditor ? 'Masquer l\'editeur' : 'Modifier le texte'}
            </button>

            {showEditor && (
              <div>
                <label className={labelClass}>Contenu de la publication</label>
                <textarea
                  value={generatedContent}
                  onChange={(e) => setGeneratedContent(e.target.value)}
                  rows={8}
                  className={`${inputClass} resize-y`}
                />
              </div>
            )}

            {/* Save button */}
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={isPending || !generatedContent.trim()}
              className="w-full gradient-primary hover:opacity-90 transition-opacity text-white px-4 py-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/25"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sauvegarde...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Sauvegarder comme brouillon
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
