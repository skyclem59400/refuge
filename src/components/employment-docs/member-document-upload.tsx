'use client'

import { useState, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { uploadMemberDocument } from '@/lib/actions/member-documents'
import { MEMBER_DOCUMENT_KIND_LABELS } from '@/lib/types/database'
import type { EstablishmentMember, MemberDocumentKind } from '@/lib/types/database'

interface Props {
  readonly members: EstablishmentMember[]
}

const KIND_OPTIONS: { value: MemberDocumentKind; label: string }[] = (
  Object.entries(MEMBER_DOCUMENT_KIND_LABELS) as [MemberDocumentKind, string][]
).map(([value, label]) => ({ value, label }))

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

export function MemberDocumentUpload({ members }: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [memberId, setMemberId] = useState('')
  const [kind, setKind] = useState<MemberDocumentKind>('contract')
  const [label, setLabel] = useState('')
  const [signedDate, setSignedDate] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleFileChange = (selected: File | null) => {
    if (selected && selected.type !== 'application/pdf') {
      toast.error('Seuls les fichiers PDF sont acceptés')
      return
    }
    setFile(selected)
  }

  const resetForm = () => {
    setMemberId('')
    setKind('contract')
    setLabel('')
    setSignedDate('')
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!memberId) return toast.error('Sélectionner un collaborateur')
    if (!kind) return toast.error('Sélectionner un type de document')
    if (!label.trim()) return toast.error('Indiquer un libellé')
    if (!file) return toast.error('Sélectionner un fichier PDF')

    const formData = new FormData()
    formData.append('member_id', memberId)
    formData.append('kind', kind)
    formData.append('label', label.trim())
    if (signedDate) formData.append('signed_date', signedDate)
    formData.append('file', file)

    startTransition(async () => {
      const res = await uploadMemberDocument(formData)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success('Document importé')
      resetForm()
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Membre */}
      <div>
        <label htmlFor="md-member" className="block text-sm font-medium text-text mb-1">Collaborateur</label>
        <select
          id="md-member"
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
          className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
        >
          <option value="">Sélectionner un collaborateur</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.full_name || m.pseudo || m.email || m.id}
            </option>
          ))}
        </select>
      </div>

      {/* Type + Libellé */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label htmlFor="md-kind" className="block text-sm font-medium text-text mb-1">Type</label>
          <select
            id="md-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as MemberDocumentKind)}
            className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
          >
            {KIND_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="md-label" className="block text-sm font-medium text-text mb-1">Libellé</label>
          <input
            id="md-label"
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex: CDI initial, Avenant n°2 prolongation…"
            className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
          />
        </div>
      </div>

      {/* Date signature */}
      <div>
        <label htmlFor="md-date" className="block text-sm font-medium text-text mb-1">
          Date de signature <span className="text-muted font-normal">(optionnel)</span>
        </label>
        <input
          id="md-date"
          type="date"
          value={signedDate}
          onChange={(e) => setSignedDate(e.target.value)}
          className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
        />
      </div>

      {/* Fichier */}
      <div>
        <label className="block text-sm font-medium text-text mb-1">Fichier PDF</label>
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
          onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false) }}
          onDrop={(e) => {
            e.preventDefault()
            setIsDragOver(false)
            const dropped = e.dataTransfer.files[0]
            if (dropped) handleFileChange(dropped)
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            isDragOver
              ? 'border-primary bg-primary/15'
              : file ? 'border-border bg-surface-dark' : 'border-border hover:border-primary/50 hover:bg-surface-hover'
          }`}
        >
          {file ? (
            <div className="space-y-1">
              <p className="text-sm font-medium text-text">{file.name}</p>
              <p className="text-xs text-muted">{formatFileSize(file.size)}</p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setFile(null)
                  if (fileInputRef.current) fileInputRef.current.value = ''
                }}
                className="text-xs text-danger hover:underline mt-1"
              >
                Supprimer
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-sm text-muted">Glissez un PDF ici ou cliquez pour parcourir</p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
            className="hidden"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full px-3 py-2.5 rounded-lg font-semibold text-white text-sm bg-primary hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? 'Import en cours…' : 'Importer le document'}
      </button>
    </form>
  )
}
