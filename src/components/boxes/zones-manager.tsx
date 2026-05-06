'use client'

import { useState, useTransition } from 'react'
import { Loader2, Plus, Pencil, Trash2, FolderTree, ChevronDown, ChevronRight } from 'lucide-react'
import {
  createBoxZone,
  updateBoxZone,
  deleteBoxZone,
  type BoxZone,
} from '@/lib/actions/box-zones'

interface Props {
  zones: BoxZone[]
  canManage: boolean
}

interface ZoneNode extends BoxZone {
  children: ZoneNode[]
}

function buildTree(zones: BoxZone[]): ZoneNode[] {
  const byId = new Map<string, ZoneNode>()
  for (const z of zones) byId.set(z.id, { ...z, children: [] })
  const roots: ZoneNode[] = []
  for (const node of byId.values()) {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

export function ZonesManager({ zones, canManage }: Props) {
  const [open, setOpen] = useState(false)
  const tree = buildTree(zones)

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className="relative"
    >
      <summary className="cursor-pointer px-4 py-2 rounded-lg font-semibold text-sm border border-border text-muted hover:text-text hover:bg-surface-hover transition-colors list-none flex items-center gap-2">
        <FolderTree className="w-4 h-4" />
        Gérer les zones
      </summary>
      <div className="absolute right-0 top-full mt-2 z-50 w-[420px] max-h-[80vh] overflow-y-auto bg-surface rounded-xl border border-border shadow-xl p-4 space-y-3">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-sm">Zones et sous-zones</h3>
          <span className="text-[10px] uppercase tracking-wider text-muted">
            {zones.length} zone{zones.length !== 1 ? 's' : ''}
          </span>
        </div>

        {tree.length === 0 ? (
          <p className="text-xs text-muted py-2">
            Aucune zone créée. Commencez par ajouter une zone racine ci-dessous (ex : « Chenil 1 »).
          </p>
        ) : (
          <ul className="space-y-1">
            {tree.map((node) => (
              <ZoneRow key={node.id} node={node} canManage={canManage} allZones={zones} />
            ))}
          </ul>
        )}

        {canManage && (
          <div className="border-t pt-3 mt-3">
            <NewZoneForm parentZones={tree} />
          </div>
        )}
      </div>
    </details>
  )
}

function ZoneRow({
  node,
  depth = 0,
  canManage,
  allZones,
}: {
  node: ZoneNode
  depth?: number
  canManage: boolean
  allZones: BoxZone[]
}) {
  const [expanded, setExpanded] = useState(true)
  const [editing, setEditing] = useState(false)
  const hasChildren = node.children.length > 0

  return (
    <li>
      <div
        className="flex items-center gap-2 group hover:bg-surface-hover rounded px-2 py-1"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-muted hover:text-text"
            type="button"
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : (
          <span className="w-3" />
        )}
        {editing ? (
          <ZoneEditForm node={node} onClose={() => setEditing(false)} />
        ) : (
          <>
            <span className="text-sm flex-1 truncate" title={node.description ?? undefined}>
              {node.name}
            </span>
            {canManage && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setEditing(true)}
                  className="text-muted hover:text-primary"
                  type="button"
                  title="Modifier"
                >
                  <Pencil size={12} />
                </button>
                <DeleteZoneButton zoneId={node.id} zoneName={node.name} />
              </div>
            )}
          </>
        )}
      </div>
      {hasChildren && expanded && (
        <ul className="space-y-1">
          {node.children.map((child) => (
            <ZoneRow
              key={child.id}
              node={child}
              depth={depth + 1}
              canManage={canManage}
              allZones={allZones}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

function NewZoneForm({ parentZones }: { parentZones: ZoneNode[] }) {
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await createBoxZone({
        name,
        parent_id: parentId || null,
      })
      if (result.error) {
        setError(result.error)
      } else {
        setName('')
        setParentId('')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="text-[10px] uppercase tracking-wider font-bold text-muted">
        Nouvelle zone ou sous-zone
      </div>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ex : Chenil 1, Box extérieur"
        required
        className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
      />
      <select
        value={parentId}
        onChange={(e) => setParentId(e.target.value)}
        className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
      >
        <option value="">Zone racine (pas de parent)</option>
        {parentZones.map((p) => (
          <option key={p.id} value={p.id}>
            Sous-zone de « {p.name} »
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-error">{error}</p>}
      <button
        type="submit"
        disabled={pending || !name.trim()}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold gradient-primary text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
        Ajouter
      </button>
    </form>
  )
}

function ZoneEditForm({ node, onClose }: { node: BoxZone; onClose: () => void }) {
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState(node.name)

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await updateBoxZone(node.id, { name })
      if (!result.error) onClose()
    })
  }

  return (
    <form onSubmit={handleSave} className="flex items-center gap-1 flex-1">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        className="flex-1 rounded border border-border bg-surface px-2 py-0.5 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="px-2 py-0.5 rounded bg-primary text-white text-[10px] font-semibold disabled:opacity-50"
      >
        OK
      </button>
      <button
        type="button"
        onClick={onClose}
        className="px-2 py-0.5 rounded border border-border text-[10px]"
      >
        Annuler
      </button>
    </form>
  )
}

function DeleteZoneButton({ zoneId, zoneName }: { zoneId: string; zoneName: string }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleDelete() {
    if (!confirm(`Supprimer la zone « ${zoneName} » ?`)) return
    startTransition(async () => {
      const result = await deleteBoxZone(zoneId)
      if (result.error) setError(result.error)
    })
  }

  return (
    <>
      <button
        onClick={handleDelete}
        disabled={pending}
        className="text-muted hover:text-error disabled:opacity-50"
        type="button"
        title="Supprimer"
      >
        {pending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
      </button>
      {error && (
        <span className="text-[10px] text-error ml-1" title={error}>
          ⚠
        </span>
      )}
    </>
  )
}
