'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Image from 'next/image'
import { Sparkles, Save, RefreshCw, Loader2, Check } from 'lucide-react'
import { createPost } from '@/lib/actions/social-posts'
import type { SocialPostType, SocialPlatform } from '@/lib/types/database'

interface PostGeneratorProps {
  animalId: string
  animalName: string
  animalStatus: 'pound' | 'shelter' | string
  photos: { id: string; url: string; is_primary: boolean }[]
  onPostCreated?: () => void
}

const postTypeLabels: Record<SocialPostType, string> = {
  search_owner: 'Recherche proprietaire',
  adoption: 'Adoption',
}

const platformLabels: Record<SocialPlatform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  both: 'Les deux',
}

export function PostGenerator({
  animalId,
  animalName,
  animalStatus,
  photos,
  onPostCreated,
}: PostGeneratorProps) {
  const defaultPostType: SocialPostType = animalStatus === 'pound' ? 'search_owner' : 'adoption'

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [postType, setPostType] = useState<SocialPostType>(defaultPostType)
  const [platform, setPlatform] = useState<SocialPlatform>('both')
  const [additionalNotes, setAdditionalNotes] = useState('')
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>(
    photos.filter((p) => p.is_primary).map((p) => p.id)
  )
  const [generatedContent, setGeneratedContent] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const inputClass = 'w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50'
  const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5'

  function togglePhoto(photoId: string) {
    setSelectedPhotoIds((prev) =>
      prev.includes(photoId)
        ? prev.filter((id) => id !== photoId)
        : [...prev, photoId]
    )
  }

  async function handleGenerate() {
    setStep(2)
    setIsGenerating(true)

    try {
      const response = await fetch('/api/ai/generate-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          animalId,
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
      setStep(3)
    } catch (error) {
      toast.error((error as Error).message || 'Erreur lors de la generation')
      setStep(1)
    } finally {
      setIsGenerating(false)
    }
  }

  function handleRegenerate() {
    handleGenerate()
  }

  function handleSaveDraft() {
    if (!generatedContent.trim()) {
      toast.error('Le contenu ne peut pas etre vide')
      return
    }

    const selectedUrls = photos
      .filter((p) => selectedPhotoIds.includes(p.id))
      .map((p) => p.url)

    startTransition(async () => {
      const result = await createPost({
        animal_id: animalId,
        type: postType,
        platform,
        content: generatedContent.trim(),
        photo_urls: selectedUrls,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Brouillon sauvegarde')
        router.refresh()
        onPostCreated?.()
      }
    })
  }

  const stepLabels = ['Configurer', 'Generer', 'Apercu']

  return (
    <div className="bg-surface rounded-xl border border-border p-5">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {stepLabels.map((label, index) => {
          const stepNumber = (index + 1) as 1 | 2 | 3
          const isActive = step === stepNumber
          const isCompleted = step > stepNumber

          return (
            <div key={label} className="flex items-center gap-2">
              {index > 0 && (
                <div
                  className={`h-px w-8 ${
                    isCompleted ? 'bg-primary' : 'bg-border'
                  }`}
                />
              )}
              <div className="flex items-center gap-1.5">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                    isActive
                      ? 'gradient-primary text-white'
                      : isCompleted
                        ? 'bg-primary/20 text-primary'
                        : 'bg-surface-dark text-muted'
                  }`}
                >
                  {isCompleted ? <Check className="h-3 w-3" /> : stepNumber}
                </div>
                <span
                  className={`text-xs font-medium ${
                    isActive ? 'text-foreground' : 'text-muted'
                  }`}
                >
                  {label}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Step 1: Configure */}
      {step === 1 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted mb-4">
            Configurer la publication pour {animalName}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Post type */}
            <div>
              <label className={labelClass}>Type de publication</label>
              <select
                value={postType}
                onChange={(e) => setPostType(e.target.value as SocialPostType)}
                className={inputClass}
              >
                {Object.entries(postTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Platform */}
            <div>
              <label className={labelClass}>Plateforme</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as SocialPlatform)}
                className={inputClass}
              >
                {Object.entries(platformLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Additional notes */}
          <div>
            <label className={labelClass}>Notes supplementaires</label>
            <textarea
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder="Informations supplementaires pour l'IA (caractere, histoire, urgence...)"
              rows={3}
              className={`${inputClass} resize-y`}
            />
          </div>

          {/* Photo selection */}
          {photos.length > 0 && (
            <div>
              <label className={labelClass}>
                Photos a inclure ({selectedPhotoIds.length} selectionnee{selectedPhotoIds.length !== 1 ? 's' : ''})
              </label>
              <div className="flex flex-wrap gap-2 mt-1">
                {photos.map((photo) => {
                  const isSelected = selectedPhotoIds.includes(photo.id)
                  return (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => togglePhoto(photo.id)}
                      className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                        isSelected
                          ? 'ring-2 ring-primary border-primary'
                          : 'border-border hover:border-muted'
                      }`}
                    >
                      <Image
                        src={photo.url}
                        alt="Photo animal"
                        width={80}
                        height={80}
                        className="h-full w-full object-cover"
                      />
                      {isSelected && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <Check className="h-5 w-5 text-primary drop-shadow" />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Generate button */}
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={handleGenerate}
              className="gradient-primary hover:opacity-90 transition-opacity text-white px-6 py-3 rounded-lg font-semibold text-sm flex items-center gap-2 shadow-lg shadow-primary/25"
            >
              <Sparkles className="h-4 w-4" />
              Generer avec l&apos;IA
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Generating */}
      {step === 2 && isGenerating && (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted font-medium">Generation en cours...</p>
          <p className="text-xs text-muted">
            L&apos;IA redige une publication pour {animalName}
          </p>
        </div>
      )}

      {/* Step 3: Preview & Edit */}
      {step === 3 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted mb-4">
            Apercu et modification
          </h3>

          {/* Read-only badges */}
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
              {postTypeLabels[postType]}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400">
              {platformLabels[platform]}
            </span>
          </div>

          {/* Editable content */}
          <div>
            <label className={labelClass}>Contenu de la publication</label>
            <textarea
              value={generatedContent}
              onChange={(e) => setGeneratedContent(e.target.value)}
              rows={10}
              className={`${inputClass} resize-y min-h-[240px]`}
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={isGenerating}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-muted border border-border hover:bg-surface-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
              Regenerer
            </button>

            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={isPending || !generatedContent.trim()}
              className="flex-1 gradient-primary hover:opacity-90 transition-opacity text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
