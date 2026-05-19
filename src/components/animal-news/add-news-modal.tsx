'use client'

import { useState, useRef, useTransition } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { X, Upload, Loader2, Trash2, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { addAnimalNews } from '@/lib/actions/animal-news'
import { SPECIES_LABELS } from '@/lib/species'
import { getStatusLabel } from '@/lib/sda-utils'
import { DatePicker } from '@/components/ui/date-picker'
import type { AnimalNewsPhoto } from '@/lib/types/database'

interface EligibleAnimal {
  id: string
  name: string
  species: string
  sex: string
  status: string
  exit_date: string | null
  photo_url: string | null
  birth_date: string | null
}

interface AddNewsModalProps {
  eligibleAnimals: EligibleAnimal[]
  establishmentId: string
  onClose: () => void
  onSuccess: () => void
}

interface UploadedPhoto extends AnimalNewsPhoto {
  /** Aperçu local (data URL) le temps du formulaire — facultatif. */
  previewUrl?: string
}

export function AddNewsModal({
  eligibleAnimals,
  establishmentId,
  onClose,
  onSuccess,
}: Readonly<AddNewsModalProps>) {
  const [animalId, setAnimalId] = useState<string>('')
  const [animalSearch, setAnimalSearch] = useState('')
  const [photos, setPhotos] = useState<UploadedPhoto[]>([])
  const [text, setText] = useState('')
  const [receivedFrom, setReceivedFrom] = useState('')
  const [receivedAt, setReceivedAt] = useState(() => new Date().toISOString().split('T')[0])
  const [uploading, setUploading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  const selectedAnimal = eligibleAnimals.find((a) => a.id === animalId)

  const filteredAnimals = animalSearch.trim()
    ? eligibleAnimals.filter((a) =>
        a.name?.toLowerCase().includes(animalSearch.toLowerCase().trim())
      )
    : eligibleAnimals.slice(0, 20)

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
        if (!ctx) {
          resolve(file)
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file)
              return
            }
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

  function isHeic(file: File): boolean {
    const ext = file.name.toLowerCase().split('.').pop()
    return file.type === 'image/heic' || file.type === 'image/heif' || ext === 'heic' || ext === 'heif'
  }

  async function convertHeicToJpeg(file: File): Promise<File> {
    const heic2any = (await import('heic2any')).default
    const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 })
    const jpegBlob = Array.isArray(blob) ? blob[0] : blob
    const newName = file.name.replace(/\.(heic|heif)$/i, '.jpg')
    return new File([jpegBlob], newName, { type: 'image/jpeg' })
  }

  async function uploadOneFile(file: File): Promise<UploadedPhoto | null> {
    if (!file.type.startsWith('image/') && !isHeic(file)) {
      toast.error(`${file.name} : pas une image`)
      return null
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error(`${file.name} : trop volumineux (max 20 Mo)`)
      return null
    }

    try {
      let workingFile: File = file
      if (isHeic(file)) {
        try {
          workingFile = await convertHeicToJpeg(file)
        } catch {
          toast.error(`${file.name} : conversion HEIC échouée`)
          return null
        }
      }

      let finalFile = workingFile
      if (workingFile.size > 2 * 1024 * 1024) {
        try {
          finalFile = await compressImage(workingFile)
        } catch {
          finalFile = workingFile
        }
      }

      const supabase = createClient()
      const ext = finalFile.name.split('.').pop()?.toLowerCase() || 'jpg'
      const randomId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`
      const path = `${establishmentId}/news/${randomId}.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('animal-photos')
        .upload(path, finalFile, {
          contentType: finalFile.type || 'image/jpeg',
          upsert: false,
        })

      if (uploadErr) {
        toast.error(`Erreur upload : ${uploadErr.message}`)
        return null
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('animal-photos').getPublicUrl(path)

      return { url: publicUrl, path, previewUrl: publicUrl }
    } catch (e) {
      toast.error(`Erreur upload : ${(e as Error).message}`)
      return null
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    const uploadedPhotos: UploadedPhoto[] = []
    for (const file of Array.from(files)) {
      const photo = await uploadOneFile(file)
      if (photo) uploadedPhotos.push(photo)
    }
    setPhotos((prev) => [...prev, ...uploadedPhotos])
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  function removePhoto(path: string) {
    // On retire juste du form ; la photo reste en storage mais sera nettoyée
    // automatiquement si l'insert DB est annulé. Si l'user submit puis supprime
    // la nouvelle, le storage sera cleanup via deleteAnimalNews.
    setPhotos((prev) => prev.filter((p) => p.path !== path))
  }

  function handleSubmit() {
    if (!animalId) {
      toast.error('Sélectionne un animal')
      return
    }
    if (photos.length === 0 && !text.trim()) {
      toast.error('Ajoute au moins une photo ou un texte')
      return
    }

    startTransition(async () => {
      const result = await addAnimalNews({
        animal_id: animalId,
        photos: photos.map((p) => ({ url: p.url, path: p.path })),
        text: text.trim() || null,
        received_from: receivedFrom.trim() || null,
        received_at: receivedAt,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Nouvelle ajoutée')
        onSuccess()
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-surface rounded-xl border border-border shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-surface border-b border-border p-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold">Ajouter une nouvelle</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-surface-hover text-muted hover:text-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Animal picker */}
          <div>
            <label htmlFor="animal-picker" className="block text-sm font-semibold mb-2">
              Animal concerné <span className="text-danger">*</span>
            </label>
            {selectedAnimal ? (
              <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
                <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-surface-dark flex-shrink-0">
                  {selectedAnimal.photo_url ? (
                    <Image src={selectedAnimal.photo_url} alt="" fill className="object-cover" sizes="56px" unoptimized />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl">
                      {selectedAnimal.species === 'cat' ? '🐈' : '🐕'}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{selectedAnimal.name}</div>
                  <div className="text-xs text-muted">
                    {SPECIES_LABELS[selectedAnimal.species as keyof typeof SPECIES_LABELS] ||
                      selectedAnimal.species}{' '}
                    · {getStatusLabel(selectedAnimal.status)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAnimalId('')}
                  className="text-xs text-muted hover:text-text"
                >
                  Changer
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    id="animal-picker"
                    type="text"
                    value={animalSearch}
                    onChange={(e) => setAnimalSearch(e.target.value)}
                    placeholder="Rechercher un animal adopté, en FA, transféré..."
                    className="w-full pl-9 pr-3 py-2 bg-surface-dark border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
                <div className="max-h-60 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                  {filteredAnimals.length === 0 ? (
                    <div className="p-3 text-xs text-muted text-center">
                      Aucun animal éligible. Les animaux doivent être adoptés, en famille
                      d&apos;accueil, transférés ou restitués.
                    </div>
                  ) : (
                    filteredAnimals.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => {
                          setAnimalId(a.id)
                          setAnimalSearch('')
                        }}
                        className="w-full flex items-center gap-3 p-2.5 hover:bg-surface-hover transition-colors text-left"
                      >
                        <div className="relative w-10 h-10 rounded-md overflow-hidden bg-surface-dark flex-shrink-0">
                          {a.photo_url ? (
                            <Image src={a.photo_url} alt="" fill className="object-cover" sizes="40px" unoptimized />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-lg">
                              {a.species === 'cat' ? '🐈' : '🐕'}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{a.name}</div>
                          <div className="text-xs text-muted">
                            {SPECIES_LABELS[a.species as keyof typeof SPECIES_LABELS] || a.species} ·{' '}
                            {getStatusLabel(a.status)}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Photos */}
          <div>
            <label htmlFor="photos-input" className="block text-sm font-semibold mb-2">
              Photos
            </label>
            <input
              id="photos-input"
              ref={fileRef}
              type="file"
              accept="image/*,.heic,.heif"
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full flex items-center justify-center gap-2 p-6 border-2 border-dashed border-border hover:border-primary/50 rounded-lg text-sm text-muted hover:text-text transition-colors disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Upload en cours...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Cliquer pour ajouter une ou plusieurs photos
                </>
              )}
            </button>

            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-3">
                {photos.map((p) => (
                  <div key={p.path} className="relative aspect-square rounded-lg overflow-hidden bg-surface-dark border border-border group">
                    <Image src={p.url} alt="" fill className="object-cover" sizes="120px" unoptimized />
                    <button
                      type="button"
                      onClick={() => removePhoto(p.path)}
                      className="absolute top-1 right-1 p-1 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-danger"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Text */}
          <div>
            <label htmlFor="news-text" className="block text-sm font-semibold mb-2">
              Message reçu
            </label>
            <textarea
              id="news-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              placeholder="« Médor s'est très bien adapté, il adore les balades en forêt... »"
              className="w-full px-3 py-2 bg-surface-dark border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
            />
          </div>

          {/* Source */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="news-from" className="block text-sm font-semibold mb-2">
                Reçu de
              </label>
              <input
                id="news-from"
                type="text"
                value={receivedFrom}
                onChange={(e) => setReceivedFrom(e.target.value)}
                placeholder="Famille adoptante, FA Mme Dupont..."
                className="w-full px-3 py-2 bg-surface-dark border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
            <div>
              <label htmlFor="news-date" className="block text-sm font-semibold mb-2">
                Date de réception
              </label>
              <DatePicker
                id="news-date"
                value={receivedAt}
                onChange={(v) => setReceivedAt(v ?? '')}
                ariaLabel="Date de réception"
              />
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-surface border-t border-border p-4 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 text-sm font-medium text-muted hover:text-text transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || uploading || !animalId}
            className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Enregistrement...
              </span>
            ) : (
              'Enregistrer'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
