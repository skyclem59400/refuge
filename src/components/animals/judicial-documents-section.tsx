'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import {
  Scale,
  Trash2,
  Upload,
  ExternalLink,
  Loader2,
  FileText,
  Gavel,
  ClipboardCheck,
  Stethoscope,
  Camera,
  Receipt,
  File,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  uploadJudicialAttachment,
  listJudicialAttachments,
  deleteJudicialAttachment,
} from '@/lib/actions/judicial-attachments'
import type { JudicialAttachment, JudicialAttachmentKind } from '@/lib/types/database'

interface Props {
  readonly animalId: string
  readonly canManage: boolean
}

const MAX_SIZE_MB = 20
const ACCEPT =
  '.pdf,.png,.jpg,.jpeg,.webp,.heic,.tiff,application/pdf,image/png,image/jpeg,image/webp,image/heic,image/tiff'

const KIND_OPTIONS: { value: JudicialAttachmentKind; label: string }[] = [
  { value: 'seizure_pv', label: 'PV de saisie' },
  { value: 'requisition_order', label: 'Ordonnance / réquisition' },
  { value: 'court_decision', label: 'Jugement / décision' },
  { value: 'vet_report', label: 'Rapport vétérinaire' },
  { value: 'photo_evidence', label: 'Photos saisie' },
  { value: 'invoice', label: 'Facture liée' },
  { value: 'other', label: 'Autre' },
]

const KIND_LABEL: Record<JudicialAttachmentKind, string> = KIND_OPTIONS.reduce(
  (acc, opt) => {
    acc[opt.value] = opt.label
    return acc
  },
  {} as Record<JudicialAttachmentKind, string>
)

function kindIcon(kind: JudicialAttachmentKind) {
  switch (kind) {
    case 'seizure_pv':
      return ClipboardCheck
    case 'requisition_order':
      return Gavel
    case 'court_decision':
      return Scale
    case 'vet_report':
      return Stethoscope
    case 'photo_evidence':
      return Camera
    case 'invoice':
      return Receipt
    case 'other':
    default:
      return File
  }
}

function formatDate(d: string | null): string {
  if (!d) return ''
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function JudicialDocumentsSection({ animalId, canManage }: Props) {
  const [items, setItems] = useState<JudicialAttachment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [kind, setKind] = useState<JudicialAttachmentKind>('other')
  const [documentDate, setDocumentDate] = useState('')
  const [notes, setNotes] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let active = true
    setIsLoading(true)
    listJudicialAttachments(animalId)
      .then((res) => {
        if (!active) return
        if (res.error) {
          toast.error(res.error)
        } else if (res.data) {
          setItems(res.data)
        }
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [animalId])

  const handleFile = (file: File) => {
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Fichier trop volumineux (max ${MAX_SIZE_MB} Mo)`)
      return
    }

    const fd = new FormData()
    fd.append('file', file)
    fd.append('animal_id', animalId)
    fd.append('kind', kind)
    if (documentDate.trim() !== '') fd.append('document_date', documentDate.trim())
    if (notes.trim() !== '') fd.append('notes', notes.trim())

    startTransition(async () => {
      const res = await uploadJudicialAttachment(fd)
      if (res.error) {
        toast.error(res.error)
      } else if (res.data) {
        toast.success('Document ajouté')
        setItems((prev) => [res.data!, ...prev])
        setDocumentDate('')
        setNotes('')
        setKind('other')
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    })
  }

  const handleDelete = (id: string, name: string | null) => {
    const label = name || 'ce document'
    if (!confirm(`Supprimer « ${label} » ?`)) return
    startTransition(async () => {
      const res = await deleteJudicialAttachment(id)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('Document supprimé')
        setItems((prev) => prev.filter((it) => it.id !== id))
      }
    })
  }

  return (
    <div className="bg-surface rounded-xl border border-border p-5">
      <div className="flex items-center gap-2 mb-3">
        <Scale className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-text">Documents de procédure</h3>
        <span className="text-xs text-muted">({items.length})</span>
      </div>
      <p className="text-xs text-muted mb-4">
        Pièces de la procédure judiciaire liées à cet animal (PV, ordonnances, jugements, rapports…).
      </p>

      {canManage && (
        <div className="bg-surface-dark rounded-lg p-3 mb-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Type de document
            </label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as JudicialAttachmentKind)}
              disabled={isPending}
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {KIND_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">
                Date du document
              </label>
              <input
                type="date"
                value={documentDate}
                onChange={(e) => setDocumentDate(e.target.value)}
                disabled={isPending}
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isPending}
              rows={2}
              placeholder="Précisions (numéro de dossier, juridiction…)"
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
          </div>

          <label className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border-2 border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors">
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            <span>
              {isPending
                ? 'Envoi en cours...'
                : `Importer (PDF ou image, max ${MAX_SIZE_MB} Mo)`}
            </span>
            <input
              ref={fileInputRef}
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
        <div className="flex items-center justify-center gap-2 text-sm text-muted py-6">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Chargement…</span>
        </div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted text-center py-6">
          Aucun document de procédure pour cet animal.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const Icon = kindIcon(item.kind)
            const fileLabel = item.file_name || 'Document'
            return (
              <li
                key={item.id}
                className="flex items-start gap-3 p-3 bg-surface-dark rounded-lg border border-border"
              >
                <Icon className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-primary mb-0.5">
                    {KIND_LABEL[item.kind]}
                  </div>
                  <div className="text-sm text-text truncate">{fileLabel}</div>
                  <div className="text-xs text-muted">
                    {item.document_date ? (
                      <>Daté du {formatDate(item.document_date)}</>
                    ) : (
                      <>Ajouté le {formatDate(item.created_at)}</>
                    )}
                  </div>
                  {item.notes && (
                    <div className="text-xs italic text-muted mt-1">{item.notes}</div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {item.signed_url ? (
                    <a
                      href={item.signed_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted hover:text-primary p-1 transition-colors"
                      title="Ouvrir"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  ) : (
                    <span
                      className="text-muted/50 p-1"
                      title="Lien indisponible"
                    >
                      <FileText className="w-4 h-4" />
                    </span>
                  )}
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id, item.file_name)}
                      disabled={isPending}
                      className="text-muted hover:text-error p-1 transition-colors disabled:opacity-50"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
