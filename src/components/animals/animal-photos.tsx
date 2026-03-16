'use client'

import { useState, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Image from 'next/image'
import { Camera, Star, Trash2, Plus, Loader2 } from 'lucide-react'
import { uploadAnimalPhoto, deleteAnimalPhoto, setPrimaryAnimalPhoto } from '@/lib/actions/photos'

interface AnimalPhotosProps {
  animalId: string
  photos: {
    id: string
    url: string
    is_primary: boolean
    created_at: string
  }[]
  canManage: boolean
  fallbackPhotoUrl?: string | null
}

export function AnimalPhotos({ animalId, photos, canManage, fallbackPhotoUrl }: Readonly<AnimalPhotosProps>) {
  const [isPending, startTransition] = useTransition()
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const primaryPhoto = photos.find((p) => p.is_primary) || photos[0] || null
  const selectedPhoto = selectedPhotoId ? photos.find((p) => p.id === selectedPhotoId) : null
  const displayPhoto = selectedPhoto || primaryPhoto
  const displayUrl = displayPhoto?.url || fallbackPhotoUrl || null

  async function compressImage(file: File, maxWidth = 1920, quality = 0.85): Promise<File> {
    return new Promise((resolve, reject) => {
      const img = new window.Image()
      img.onload = () => {
        let { width, height } = img
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width)
          width = maxWidth
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) { resolve(file); return }
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(file); return }
            resolve(new File([blob], file.name, { type: 'image/jpeg' }))
          },
          'image/jpeg',
          quality
        )
      }
      img.onerror = () => reject(new Error('Impossible de lire l\'image'))
      img.src = URL.createObjectURL(file)
    })
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez selectionner une image')
      return
    }

    // Reject files over 20 MB (before compression)
    if (file.size > 20 * 1024 * 1024) {
      toast.error("L'image ne doit pas depasser 20 Mo")
      return
    }

    setPendingAction('upload')
    startTransition(async () => {
      try {
        // Compress if larger than 2 MB
        const finalFile = file.size > 2 * 1024 * 1024
          ? await compressImage(file)
          : file

        const formData = new FormData()
        formData.append('file', finalFile)

        const result = await uploadAnimalPhoto(animalId, formData)

        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success('Photo ajoutee')
          router.refresh()
        }
      } catch {
        toast.error('Erreur lors du traitement de l\'image')
      }

      setPendingAction(null)
      if (fileRef.current) {
        fileRef.current.value = ''
      }
    })
  }

  function handleDelete(photoId: string) {
    if (!window.confirm('Supprimer cette photo ?')) return

    setPendingAction(`delete-${photoId}`)
    startTransition(async () => {
      const result = await deleteAnimalPhoto(photoId)

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Photo supprimee')
        if (selectedPhotoId === photoId) setSelectedPhotoId(null)
        router.refresh()
      }

      setPendingAction(null)
    })
  }

  function handleSetPrimary(photoId: string) {
    setPendingAction(`primary-${photoId}`)
    startTransition(async () => {
      const result = await setPrimaryAnimalPhoto(photoId, animalId)

      if (result.error) {
        toast.error(result.error)
      } else {
        router.refresh()
      }

      setPendingAction(null)
    })
  }

  return (
    <div className="space-y-4">
      {/* Large photo display */}
      <div className="aspect-square w-full overflow-hidden rounded-xl border border-border bg-surface">
        {displayUrl ? (
          <Image
            src={displayUrl}
            alt="Photo principale"
            width={600}
            height={600}
            unoptimized={displayUrl.includes('hunimalis.com')}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted">
            <Camera className="h-12 w-12" />
            <span className="text-sm">Aucune photo</span>
          </div>
        )}
      </div>

      {/* Thumbnails grid */}
      <div className="flex flex-wrap gap-2">
        {photos.map((photo) => {
          const isSelected = displayPhoto?.id === photo.id
          return (
            <div
              key={photo.id}
              className={`relative group h-20 w-20 shrink-0 overflow-hidden rounded-lg border bg-surface cursor-pointer transition-all ${
                isSelected ? 'ring-2 ring-primary border-primary' : 'border-border hover:border-primary/50'
              }`}
              onClick={() => setSelectedPhotoId(photo.id)}
            >
              <Image
                src={photo.url}
                alt="Photo animal"
                width={80}
                height={80}
                className="h-full w-full object-cover"
              />

              {/* Overlay actions (visible on hover when canManage) */}
              {canManage && (
                <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  {/* Set as primary */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleSetPrimary(photo.id) }}
                    disabled={isPending}
                    className="rounded-full bg-black/50 p-1 text-white transition-colors hover:bg-black/70"
                    title="Definir comme photo principale"
                  >
                    <Star
                      className={`h-4 w-4 ${photo.is_primary ? 'fill-yellow-400 text-yellow-400' : ''}`}
                    />
                  </button>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleDelete(photo.id) }}
                    disabled={isPending}
                    className="rounded-full bg-black/50 p-1 text-white transition-colors hover:bg-red-600"
                    title="Supprimer la photo"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Primary star indicator */}
              {photo.is_primary && (
                <div className="absolute left-1 top-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 drop-shadow" />
                </div>
              )}

              {/* Loading overlay for this specific photo */}
              {(pendingAction === `delete-${photo.id}` || pendingAction === `primary-${photo.id}`) && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                </div>
              )}
            </div>
          )
        })}

        {/* Upload button (dashed border square in the thumbnails grid) */}
        {canManage && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={isPending}
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-border bg-surface text-muted transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
            title="Ajouter une photo"
          >
            {pendingAction === 'upload' ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Plus className="h-6 w-6" />
            )}
          </button>
        )}
      </div>

      {/* Hidden file input */}
      {canManage && (
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      )}
    </div>
  )
}
