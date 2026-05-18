'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { Paperclip, Trash2, Upload, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import {
  uploadLeaveAttachment,
  listLeaveAttachments,
  deleteLeaveAttachment,
} from '@/lib/actions/leave-attachments'
import type { LeaveAttachment, LeaveAttachmentKind } from '@/lib/types/database'

interface Props {
  readonly memberId: string
  readonly leaveRequestId?: string
  readonly defaultKind?: LeaveAttachmentKind
  readonly title?: string
}

const KIND_LABEL: Record<LeaveAttachmentKind, string> = {
  sick_note: 'Arret maladie',
  extended_leave_proof: 'Justif. arret long',
  other: 'Autre',
}

function formatSize(n: number | null): string {
  if (!n) return ''
  if (n < 1024) return `${n} o`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} Ko`
  return `${(n / 1024 / 1024).toFixed(1)} Mo`
}

export function LeaveAttachmentsPanel({
  memberId,
  leaveRequestId,
  defaultKind = 'sick_note',
  title = 'Pieces jointes',
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<LeaveAttachment[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [kind, setKind] = useState<LeaveAttachmentKind>(defaultKind)

  async function refresh() {
    setLoading(true)
    const res = await listLeaveAttachments({
      member_id: memberId,
      leave_request_id: leaveRequestId,
    })
    if (res.data) setItems(res.data)
    setLoading(false)
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId, leaveRequestId])

  function handlePick() {
    fileInputRef.current?.click()
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.set('file', file)
    fd.set('member_id', memberId)
    if (leaveRequestId) fd.set('leave_request_id', leaveRequestId)
    fd.set('kind', kind)

    startTransition(async () => {
      const res = await uploadLeaveAttachment(fd)
      if (res.error) toast.error(res.error)
      else {
        toast.success('Fichier ajoute')
        refresh()
      }
      if (fileInputRef.current) fileInputRef.current.value = ''
    })
  }

  function handleDelete(id: string) {
    if (!confirm('Supprimer cette piece jointe ?')) return
    startTransition(async () => {
      const res = await deleteLeaveAttachment(id)
      if (res.error) toast.error(res.error)
      else {
        toast.success('Supprime')
        refresh()
      }
    })
  }

  return (
    <div className="bg-surface-dark/60 rounded-xl border border-border p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-muted" />
          <h4 className="text-xs font-bold text-text uppercase tracking-wider">{title}</h4>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as LeaveAttachmentKind)}
            className="px-2 py-1 text-[11px] bg-surface border border-border rounded text-muted"
          >
            {(Object.keys(KIND_LABEL) as LeaveAttachmentKind[]).map((k) => (
              <option key={k} value={k}>{KIND_LABEL[k]}</option>
            ))}
          </select>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFile}
            accept="application/pdf,image/png,image/jpeg,image/webp,image/heic"
            className="hidden"
          />
          <button
            onClick={handlePick}
            disabled={isPending}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 disabled:opacity-50"
          >
            <Upload className="w-3 h-3" />
            Importer
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-[11px] text-muted italic">Chargement...</p>
      ) : items.length === 0 ? (
        <p className="text-[11px] text-muted italic">Aucune piece jointe.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex items-center justify-between gap-2 bg-surface rounded-lg px-2.5 py-1.5 border border-border"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-text truncate">
                    {it.file_name || 'fichier'}
                  </span>
                  <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted/10 text-muted">
                    {KIND_LABEL[it.kind]}
                  </span>
                </div>
                <div className="text-[10px] text-muted mt-0.5">
                  {new Date(it.created_at).toLocaleString('fr-FR')} - {formatSize(it.size_bytes)}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {it.signed_url && (
                  <a
                    href={it.signed_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded text-muted hover:text-primary hover:bg-primary/10"
                    title="Ouvrir"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                <button
                  onClick={() => handleDelete(it.id)}
                  className="p-1.5 rounded text-muted hover:text-red-500 hover:bg-red-500/10"
                  title="Supprimer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
