'use client'

import { useState, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { uploadPayslip } from '@/lib/actions/payslips'
import type { EstablishmentMember } from '@/lib/types/database'

const MONTH_NAMES = [
  'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre',
]

interface PayslipUploadProps {
  readonly members: EstablishmentMember[]
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

export function PayslipUpload({ members }: PayslipUploadProps) {
  const router = useRouter()
  const currentYear = new Date().getFullYear()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [memberId, setMemberId] = useState('')
  const [year, setYear] = useState(currentYear)
  const [month, setMonth] = useState<number | ''>('')
  const [label, setLabel] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isPending, startTransition] = useTransition()

  const yearOptions = Array.from({ length: 3 }, (_, i) => currentYear - i)

  const handleFileChange = (selectedFile: File | null) => {
    if (selectedFile && selectedFile.type !== 'application/pdf') {
      toast.error('Seuls les fichiers PDF sont acceptes')
      return
    }
    setFile(selectedFile)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      handleFileChange(droppedFile)
    }
  }

  const resetForm = () => {
    setMemberId('')
    setMonth('')
    setLabel('')
    setFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!memberId) {
      toast.error('Veuillez selectionner un membre')
      return
    }
    if (!year) {
      toast.error('Veuillez selectionner une annee')
      return
    }
    if (!month) {
      toast.error('Veuillez selectionner un mois')
      return
    }
    if (!file) {
      toast.error('Veuillez selectionner un fichier PDF')
      return
    }

    const formData = new FormData()
    formData.append('member_id', memberId)
    formData.append('year', String(year))
    formData.append('month', String(month))
    formData.append('label', label)
    formData.append('file', file)

    startTransition(async () => {
      const result = await uploadPayslip(formData)
      if ('error' in result && result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Fiche de paie importee avec succes')
      resetForm()
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Membre */}
      <div>
        <label htmlFor="payslip-member" className="block text-sm font-medium text-text mb-1">
          Membre
        </label>
        <select
          id="payslip-member"
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
          className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
        >
          <option value="">Selectionner un membre</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.full_name || m.pseudo || m.email || m.id}
            </option>
          ))}
        </select>
      </div>

      {/* Annee et Mois */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="payslip-year" className="block text-sm font-medium text-text mb-1">
            Annee
          </label>
          <select
            id="payslip-year"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="payslip-month" className="block text-sm font-medium text-text mb-1">
            Mois
          </label>
          <select
            id="payslip-month"
            value={month}
            onChange={(e) => setMonth(e.target.value ? Number(e.target.value) : '')}
            className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
          >
            <option value="">Selectionner un mois</option>
            {MONTH_NAMES.map((name, i) => (
              <option key={i + 1} value={i + 1}>{name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Label optionnel */}
      <div>
        <label htmlFor="payslip-label" className="block text-sm font-medium text-text mb-1">
          Libelle <span className="text-muted font-normal">(optionnel)</span>
        </label>
        <input
          id="payslip-label"
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Ex : Prime, Regularisation..."
          className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
        />
      </div>

      {/* Zone de depot de fichier */}
      <div>
        <label className="block text-sm font-medium text-text mb-1">
          Fichier PDF
        </label>
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            isDragOver
              ? 'border-primary bg-primary/15'
              : file
                ? 'border-border bg-surface-dark'
                : 'border-border hover:border-primary/50 hover:bg-surface-hover'
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
              <svg
                className="mx-auto w-8 h-8 text-muted"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <p className="text-sm text-muted">
                Glissez un fichier PDF ici ou cliquez pour parcourir
              </p>
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

      {/* Bouton de soumission */}
      <button
        type="submit"
        disabled={isPending}
        className="w-full px-3 py-1.5 rounded-lg font-semibold text-white text-xs bg-primary hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed py-2.5 text-sm"
      >
        {isPending ? 'Import en cours...' : 'Importer la fiche de paie'}
      </button>
    </form>
  )
}
