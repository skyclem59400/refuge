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
}

export function AnimalPhotos({ animalId, photos, canManage }: AnimalPhotosProps) {
  const [isPending, startTransition] = useTransition()
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const primaryPhoto = photos.find((p) => p.is_primary) || photos[0] || null

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez selectionner une image')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("L'image ne doit pas depasser 5 Mo")
      return
    }

    setPendingAction('upload')
    startTransition(async () => {
      const formData = new FormData()
      formData.append('file', file)

      const result = await uploadAnimalPhoto(animalId, formData)

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Photo ajoutee')
        router.refresh()
      }

      setPendingAction(null)
      // Reset input so the same file can be re-selected
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
      {/* Primary photo (large) */}
      <div className="aspect-square w-full overflow-hidden rounded-xl border border-border bg-surface">
        {primaryPhoto ? (
          <Image
            src={primaryPhoto.url}
            alt="Photo principale"
            width={600}
            height={600}
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
        {photos.map((photo) => (
          <div
            key={photo.id}
            className={`relative group h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-surface ${
              photo.is_primary ? 'ring-2 ring-primary' : ''
            }`}
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
                  onClick={() => handleSetPrimary(photo.id)}
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
                  onClick={() => handleDelete(photo.id)}
                  disabled={isPending}
                  className="rounded-full bg-black/50 p-1 text-white transition-colors hover:bg-red-600"
                  title="Supprimer la photo"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Primary star indicator (always visible when primary, no hover needed) */}
            {photo.is_primary && !canManage && (
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
        ))}

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
