'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { FileText, Trash2, Upload, ExternalLink, Loader2 } from 'lucide-react'
import {
  uploadMedicalInvoice,
  deleteMedicalInvoice,
  getMedicalInvoiceSignedUrl,
} from '@/lib/actions/medical-invoices'

interface Props {
  readonly healthRecordId: string
  readonly existingFileName: string | null
  readonly hasFile: boolean
}

export function MedicalInvoiceUploader({ healthRecordId, existingFileName, hasFile }: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()

  function handlePick() {
    fileInputRef.current?.click()
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 20 * 1024 * 1024) {
      toast.error('Fichier trop volumineux (20 Mo max)')
      return
    }
    const fd = new FormData()
    fd.set('file', file)
    fd.set('health_record_id', healthRecordId)

    startTransition(async () => {
      const res = await uploadMedicalInvoice(fd)
      if ('error' in res && res.error) {
        toast.error(res.error)
      } else {
        toast.success('Facture jointe')
        router.refresh()
      }
      if (fileInputRef.current) fileInputRef.current.value = ''
    })
  }

  function handleOpen() {
    startTransition(async () => {
      const res = await getMedicalInvoiceSignedUrl(healthRecordId)
      if ('error' in res && res.error) {
        toast.error(res.error)
      } else if ('data' in res && res.data?.url) {
        window.open(res.data.url, '_blank', 'noopener,noreferrer')
      }
    })
  }

  function handleDelete() {
    if (!confirm('Retirer la facture jointe à cet acte ?')) return
    startTransition(async () => {
      const res = await deleteMedicalInvoice(healthRecordId)
      if ('error' in res && res.error) {
        toast.error(res.error)
      } else {
        toast.success('Facture supprimée')
        router.refresh()
      }
    })
  }

  return (
    <div className="rounded-lg border border-error/20 bg-surface-dark/40 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-error" />
          <span className="text-xs font-semibold text-text">Facture clinique (PDF / image)</span>
        </div>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFile}
          accept="application/pdf,image/png,image/jpeg,image/webp,image/heic,image/tiff"
          className="hidden"
        />
        <button
          type="button"
          onClick={handlePick}
          disabled={isPending}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 disabled:opacity-50"
        >
          {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
          {hasFile ? 'Remplacer' : 'Importer'}
        </button>
      </div>

      {hasFile ? (
        <div className="flex items-center justify-between gap-2 bg-surface rounded px-2.5 py-1.5 border border-border">
          <div className="text-xs text-text truncate">
            {existingFileName || 'facture.pdf'}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleOpen}
              disabled={isPending}
              className="p-1.5 rounded text-muted hover:text-primary hover:bg-primary/10"
              title="Ouvrir"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className="p-1.5 rounded text-muted hover:text-red-500 hover:bg-red-500/10"
              title="Retirer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-muted italic">
          Aucune facture jointe. Format accepté : PDF, image (max 20 Mo).
        </p>
      )}
    </div>
  )
}
