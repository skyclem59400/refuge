'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Paperclip, Upload, Trash2, FileText, Loader2 } from 'lucide-react'
import {
  getAnimalAttachments,
  uploadAnimalAttachment,
  deleteAnimalAttachment,
} from '@/lib/actions/animal-attachments'
import type { AnimalAttachment } from '@/lib/types/database'

const MAX_SIZE_MB = 15
const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp'

interface AnimalAttachmentsSectionProps {
  animalId: string
  canManage: boolean
}

function formatSize(bytes: number | null): string {
  if (bytes === null) return ''
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function AnimalAttachmentsSection({ animalId, canManage }: Readonly<AnimalAttachmentsSectionProps>) {
  const [attachments, setAttachments] = useState<AnimalAttachment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [label, setLabel] = useState('')

  const refresh = async () => {
    setIsLoading(true)
    const res = await getAnimalAttachments(animalId)
    setIsLoading(false)
    if (res.data) setAttachments(res.data)
    else if (res.error) toast.error(res.error)
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animalId])

  const handleFile = (file: File) => {
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Fichier trop volumineux (max ${MAX_SIZE_MB} Mo)`)
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1]
      startTransition(async () => {
        const res = await uploadAnimalAttachment({
          animalId,
          filename: file.name,
          mimeType: file.type || null,
          sizeBytes: file.size,
          label: label.trim() || null,
          base64,
        })
        if (res.error) {
          toast.error(res.error)
        } else if (res.data) {
          toast.success('Pièce jointe ajoutée')
          setAttachments((prev) => [res.data!, ...prev])
          setLabel('')
        }
      })
    }
    reader.onerror = () => toast.error('Erreur de lecture du fichier')
    reader.readAsDataURL(file)
  }

  const handleDelete = (id: string, filename: string) => {
    if (!confirm(`Supprimer « ${filename} » ?`)) return
    startTransition(async () => {
      const res = await deleteAnimalAttachment(id)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('Pièce jointe supprimée')
        setAttachments((prev) => prev.filter((a) => a.id !== id))
      }
    })
  }

  return (
    <div className="bg-surface rounded-xl border border-border p-5">
      <div className="flex items-center gap-2 mb-3">
        <Paperclip className="w-4 h-4 text-primary" />
        <h3 className="font-semibold">Pièces jointes</h3>
        <span className="text-xs text-muted">({attachments.length})</span>
      </div>
      <p className="text-xs text-muted mb-4">
        Documents PDF ou images attachés à l&apos;animal (certificats de cession, stérilisation, tests sanguins…).
      </p>

      {canManage && (
        <div className="bg-surface-dark rounded-lg p-3 mb-4 space-y-2">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Libellé optionnel (ex : Certificat de cession)"
            className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <label className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border-2 border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors">
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            <span>{isPending ? 'Envoi en cours...' : 'Ajouter un fichier (PDF ou image, max 15 Mo)'}</span>
            <input
              type="file"
              accept={ACCEPT}
              className="hidden"
              disabled={isPending}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFile(file)
                e.target.value = ''
              }}
            />
          </label>
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-muted text-center py-6">Chargement...</div>
      ) : attachments.length === 0 ? (
        <div className="text-sm text-muted text-center py-6">Aucune pièce jointe</div>
      ) : (
        <ul className="space-y-2">
          {attachments.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-3 p-3 bg-surface-dark rounded-lg border border-border"
            >
              <FileText className="w-5 h-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                {a.label && (
                  <div className="text-xs font-medium text-primary mb-0.5">{a.label}</div>
                )}
                <a
                  href={a.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm hover:underline truncate block"
                >
                  {a.filename}
                </a>
                <div className="text-xs text-muted">
                  {formatDate(a.created_at)}
                  {a.size_bytes ? ` · ${formatSize(a.size_bytes)}` : ''}
                </div>
              </div>
              {canManage && (
                <button
                  type="button"
                  onClick={() => handleDelete(a.id, a.filename)}
                  className="text-muted hover:text-error p-1 transition-colors"
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
