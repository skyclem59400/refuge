'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Download, Trash2, FileText } from 'lucide-react'
import { getMemberDocumentSignedUrl, deleteMemberDocument } from '@/lib/actions/member-documents'
import { MEMBER_DOCUMENT_KIND_LABELS } from '@/lib/types/database'
import type { MemberDocument, EstablishmentMember } from '@/lib/types/database'

interface Props {
  readonly documents: MemberDocument[]
  readonly showMember?: boolean
  readonly members?: EstablishmentMember[]
  readonly canDelete?: boolean
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR')
}

function memberLabel(memberId: string, members?: EstablishmentMember[]): string {
  const m = members?.find((x) => x.id === memberId)
  return m?.full_name || m?.pseudo || m?.email || ''
}

export function MemberDocumentList({ documents, showMember, members, canDelete }: Props) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (documents.length === 0) {
    return (
      <div className="text-center py-12 text-muted">
        Aucun document disponible pour le moment.
      </div>
    )
  }

  // Grouper par membre si showMember, sinon par kind
  let groups: Array<{ key: string; title: string; items: MemberDocument[] }>
  if (showMember) {
    const byMember = new Map<string, MemberDocument[]>()
    for (const d of documents) {
      const arr = byMember.get(d.member_id) || []
      arr.push(d)
      byMember.set(d.member_id, arr)
    }
    groups = Array.from(byMember.entries()).map(([memberId, items]) => ({
      key: memberId,
      title: memberLabel(memberId, members) || 'Collaborateur',
      items,
    })).sort((a, b) => a.title.localeCompare(b.title))
  } else {
    const byKind = new Map<string, MemberDocument[]>()
    for (const d of documents) {
      const arr = byKind.get(d.kind) || []
      arr.push(d)
      byKind.set(d.kind, arr)
    }
    groups = Array.from(byKind.entries()).map(([kind, items]) => ({
      key: kind,
      title: MEMBER_DOCUMENT_KIND_LABELS[kind as keyof typeof MEMBER_DOCUMENT_KIND_LABELS] || kind,
      items,
    }))
  }

  function handleDownload(docId: string) {
    setDownloadingId(docId)
    startTransition(async () => {
      const res = await getMemberDocumentSignedUrl(docId)
      setDownloadingId(null)
      if (res.error) {
        toast.error(res.error)
        return
      }
      if (res.data) window.open(res.data, '_blank')
    })
  }

  function handleDelete(docId: string, label: string) {
    if (!confirm(`Supprimer définitivement "${label}" ?`)) return
    setDeletingId(docId)
    startTransition(async () => {
      const res = await deleteMemberDocument(docId)
      setDeletingId(null)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success('Document supprimé')
      // On laisse le router refresh être déclenché par revalidatePath côté serveur
      // (mais en pratique, le composant peut nécessiter un router.refresh)
      window.location.reload()
    })
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.key} className="border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-surface-hover/50 font-semibold text-text">{group.title}</div>
          <div className="divide-y divide-border">
            {group.items.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-surface-hover/30 transition-colors"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <FileText className="w-5 h-5 text-muted shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text truncate">{doc.label}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-muted">
                      <span className="bg-surface-dark px-2 py-0.5 rounded">
                        {MEMBER_DOCUMENT_KIND_LABELS[doc.kind]}
                      </span>
                      {doc.signed_date && <span>Signé le {formatDate(doc.signed_date)}</span>}
                      <span>Importé le {formatDate(doc.created_at.slice(0, 10))}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDownload(doc.id)}
                    disabled={isPending && downloadingId === doc.id}
                    className="px-3 py-1.5 rounded-lg font-semibold text-white text-xs bg-primary hover:bg-primary-dark transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {isPending && downloadingId === doc.id ? 'Chargement…' : 'Télécharger'}
                  </button>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => handleDelete(doc.id, doc.label)}
                      disabled={isPending && deletingId === doc.id}
                      className="p-1.5 rounded-lg text-danger border border-danger/30 hover:bg-danger/10 transition-colors disabled:opacity-50"
                      title="Supprimer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
