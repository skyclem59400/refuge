'use client'

import { useState, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import html2canvas from 'html2canvas'
import {
  Sparkles,
  Save,
  RefreshCw,
  Loader2,
  MapPin,
  Calendar,
  Phone,
  Pencil,
  Download,
  PawPrint,
} from 'lucide-react'
import { createPost } from '@/lib/actions/social-posts'
import { getSpeciesLabel, getSexLabel, calculateAge } from '@/lib/sda-utils'
import type { Animal, SocialPlatform } from '@/lib/types/database'

interface PostGeneratorProps {
  animal: Animal
  photos: { id: string; url: string; is_primary: boolean }[]
  establishmentName: string
  establishmentPhone: string
  onPostCreated?: () => void
}

type AnimalPostType = 'search_owner' | 'adoption'

const postTypeLabels: Record<AnimalPostType, string> = {
  search_owner: 'Recherche proprietaire',
  adoption: 'A l\'adoption',
}

const postTypeBadges: Record<AnimalPostType, string> = {
  search_owner: 'RECHERCHE PROPRIETAIRE',
  adoption: 'A L\'ADOPTION',
}

const postTypeBadgeColors: Record<AnimalPostType, string> = {
  search_owner: '#ef4444',
  adoption: '#22c55e',
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
  const defaultPostType: AnimalPostType = animal.status === 'pound' ? 'search_owner' : 'adoption'
  const primaryPhoto = photos.find((p) => p.is_primary) || photos[0] || null
  const photoUrl = primaryPhoto?.url || animal.photo_url || null

  const [postType, setPostType] = useState<AnimalPostType>(defaultPostType)
  const [platform, setPlatform] = useState<SocialPlatform>('both')
  const [additionalNotes, setAdditionalNotes] = useState('')
  const [generatedContent, setGeneratedContent] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [showEditor, setShowEditor] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const cardRef = useRef<HTMLDivElement>(null)

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

  async function handleDownload() {
    if (!cardRef.current) return
    setIsDownloading(true)

    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
      })

      const link = document.createElement('a')
      link.download = `${animal.name.toLowerCase()}-${postType}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
      toast.success('Visuel telecharge')
    } catch {
      toast.error('Erreur lors du telechargement')
    } finally {
      setIsDownloading(false)
    }
  }

  function handleSaveDraft() {
    if (!generatedContent.trim()) {
      toast.error('Le contenu ne peut pas etre vide')
      return
    }

    const selectedUrls = photoUrl ? [photoUrl] : []

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

  const badgeColor = postTypeBadgeColors[postType]

  return (
    <div className="space-y-6">
      {/* Configuration */}
      <div className="bg-surface rounded-xl border border-border p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Type de publication</label>
            <select
              value={postType}
              onChange={(e) => setPostType(e.target.value as AnimalPostType)}
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
            <div
              ref={cardRef}
              className="relative overflow-hidden rounded-2xl shadow-2xl"
              style={{ aspectRatio: '4/5' }}
            >
              {/* Photo background */}
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoUrl}
                  alt={animal.name}
                  className="absolute inset-0 w-full h-full object-cover"
                  crossOrigin="anonymous"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)' }}>
                  <PawPrint className="h-32 w-32 text-white/10" />
                </div>
              )}

              {/* Gradient overlays */}
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 40%, rgba(0,0,0,0.15) 70%, rgba(0,0,0,0.3) 100%)' }} />

              {/* Top bar */}
              <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between">
                <div className="flex items-center gap-2 bg-white/20 backdrop-blur-md rounded-full px-3.5 py-1.5">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}>
                    <span className="text-white text-[8px] font-extrabold leading-none">SDA</span>
                  </div>
                  <span className="text-white text-xs font-bold tracking-wider uppercase">
                    {establishmentName}
                  </span>
                </div>
              </div>

              {/* Bottom content */}
              <div className="absolute bottom-0 left-0 right-0 p-5 space-y-3">
                {/* Type badge */}
                <span
                  className="inline-block px-4 py-1.5 rounded-full text-[11px] font-extrabold uppercase tracking-widest text-white shadow-lg"
                  style={{ backgroundColor: badgeColor }}
                >
                  {postTypeBadges[postType]}
                </span>

                {/* Animal name */}
                <h2 className="text-4xl font-black text-white tracking-tight leading-none" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
                  {animal.name.toUpperCase()}
                </h2>

                {/* Animal info pills */}
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white text-xs font-medium">
                    {animal.species === 'cat' ? '🐱' : '🐶'} {getSpeciesLabel(animal.species)}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white text-xs font-medium">
                    {getSexLabel(animal.sex)}
                  </span>
                  {animal.birth_date && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white text-xs font-medium">
                      {calculateAge(animal.birth_date)}
                    </span>
                  )}
                  {animal.breed && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white text-xs font-medium">
                      {animal.breed}
                    </span>
                  )}
                </div>

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

                {/* Text preview */}
                <p className="text-white/90 text-sm leading-relaxed line-clamp-3">
                  {generatedContent}
                </p>

                {/* Footer */}
                <div className="pt-2.5 border-t border-white/20 flex items-center justify-between">
                  <span className="text-white/70 text-xs font-semibold">{establishmentName}</span>
                  {establishmentPhone && (
                    <span className="flex items-center gap-1.5 text-white/70 text-xs">
                      <Phone className="w-3 h-3" />
                      {establishmentPhone}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Download button */}
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-surface border border-border hover:bg-surface-hover transition-colors disabled:opacity-50"
            >
              {isDownloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Telecharger le visuel
            </button>
          </div>

          {/* Editor & save */}
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
