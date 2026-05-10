'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  FolderTree,
  ChevronDown,
  ChevronRight,
  Check,
  MapPin,
  CornerDownRight,
} from 'lucide-react'
import {
  createBoxZone,
  updateBoxZone,
  deleteBoxZone,
  type BoxZone,
} from '@/lib/actions/box-zones'
import { getZoneColor, type ZoneColor } from '@/lib/zone-colors'

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
  const sortFn = (a: ZoneNode, b: ZoneNode) =>
    a.sort_order - b.sort_order || a.name.localeCompare(b.name)
  roots.sort(sortFn)
  for (const r of roots) r.children.sort(sortFn)
  return roots
}

export function ZonesManager({ zones, canManage }: Props) {
  const [open, setOpen] = useState(false)
  const tree = buildTree(zones)
  const rootCount = tree.length
  const subCount = tree.reduce((acc, r) => acc + r.children.length, 0)

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className="relative"
    >
      <summary className="cursor-pointer px-4 py-2 rounded-lg font-semibold text-sm border border-border text-muted hover:text-text hover:bg-surface-hover transition-colors list-none flex items-center gap-2">
        <FolderTree className="w-4 h-4" />
        Gérer les zones
        {rootCount > 0 && (
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold">
            {rootCount}
          </span>
        )}
      </summary>

      {/* Panneau glassmorphism */}
      <div
        className="absolute right-0 top-full mt-2 z-50 w-[480px] max-h-[80vh] overflow-y-auto rounded-2xl border border-white/10 shadow-2xl shadow-black/40 backdrop-blur-xl bg-surface/95 ring-1 ring-white/5 animate-fade-up"
      >
        <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderTree className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-base">Sectorisation</h3>
          </div>
          <span className="text-[10px] uppercase tracking-[0.15em] text-muted font-semibold">
            {rootCount} zone{rootCount !== 1 ? 's' : ''}
            {subCount > 0 && ` · ${subCount} sous`}
          </span>
        </div>

        <div className="p-4 space-y-3">
          {tree.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 p-6 text-center">
              <FolderTree className="w-8 h-8 text-muted mx-auto mb-2 opacity-50" />
              <p className="text-xs text-muted leading-relaxed">
                Aucune zone créée.
                <br />
                Commence par ajouter une <strong>zone racine</strong> ci-dessous
                <br />
                (ex&nbsp;: «&nbsp;Chenil 1&nbsp;»).
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {tree.map((node) => (
                <RootZoneRow key={node.id} node={node} canManage={canManage} />
              ))}
            </ul>
          )}

          {canManage && (
            <div className="pt-3 mt-2 border-t border-border/40">
              <NewZoneForm parentZones={tree} />
            </div>
          )}
        </div>
      </div>
    </details>
  )
}

// ---------------------------------------------------------------------------
// Zone racine — carte colorée avec gradient et glow
// ---------------------------------------------------------------------------

function RootZoneRow({ node, canManage }: { node: ZoneNode; canManage: boolean }) {
  const [expanded, setExpanded] = useState(true)
  const [editing, setEditing] = useState(false)
  const color = getZoneColor(node.id)
  const hasChildren = node.children.length > 0

  return (
    <li
      className={`rounded-xl border ${color.borderSoft} ${color.bgSoft} overflow-hidden shadow-sm ring-1 ${color.ring}`}
    >
      {/* Header zone racine avec gradient */}
      <div
        className={`relative flex items-center gap-3 px-3 py-2.5 group ${color.bgSoft}`}
      >
        {/* Gradient lateral discret */}
        <div
          className={`absolute inset-y-0 left-0 w-1 ${color.bg}`}
          aria-hidden
        />

        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className={`${color.text} hover:opacity-70 ml-1 shrink-0`}
            type="button"
            aria-label={expanded ? 'Reduire' : 'Etendre'}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="w-3.5 ml-1" />
        )}

        {/* Pastille glowing */}
        <span
          className={`relative flex items-center justify-center w-7 h-7 rounded-lg ${color.bg} ${color.textOn} shadow-md shrink-0`}
        >
          <MapPin size={14} />
          <span
            className={`absolute -inset-0.5 rounded-lg ${color.bg} opacity-30 blur-md -z-10`}
            aria-hidden
          />
        </span>

        {editing ? (
          <ZoneEditForm node={node} onClose={() => setEditing(false)} />
        ) : (
          <>
            <div className="flex-1 min-w-0">
              <span
                className={`block text-sm font-bold ${color.text} truncate leading-tight`}
                title={node.description ?? undefined}
              >
                {node.name}
              </span>
              {hasChildren && (
                <span className={`text-[10px] font-medium ${color.text} opacity-70`}>
                  {node.children.length} sous-zone{node.children.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {canManage && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setEditing(true)}
                  className={`${color.text} hover:opacity-70 p-1 rounded hover:bg-white/10`}
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

      {/* Sous-zones */}
      {hasChildren && expanded && (
        <ul
          className={`relative ml-7 pl-4 py-2 mr-2 border-l-2 ${color.borderSoft} space-y-1`}
        >
          {node.children.map((child) => (
            <SubZoneRow
              key={child.id}
              node={child}
              canManage={canManage}
              color={color}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

// ---------------------------------------------------------------------------
// Sous-zone
// ---------------------------------------------------------------------------

function SubZoneRow({
  node,
  canManage,
  color,
}: {
  node: ZoneNode
  canManage: boolean
  color: ZoneColor
}) {
  const [editing, setEditing] = useState(false)

  return (
    <li
      className={`relative flex items-center gap-2 px-2.5 py-1.5 group rounded-lg ${color.bgSofter} hover:bg-surface-hover transition-colors`}
    >
      {/* Marqueur d'arborescence */}
      <span
        className={`absolute -left-4 top-1/2 w-3 h-px ${color.borderSoft.replace('border-', 'bg-')}`}
        aria-hidden
      />
      <CornerDownRight className={`w-3.5 h-3.5 ${color.text} opacity-60 shrink-0`} />
      <span
        className={`w-2 h-2 rounded-full ${color.dot} shrink-0 shadow-sm`}
      />
      {editing ? (
        <ZoneEditForm node={node} onClose={() => setEditing(false)} />
      ) : (
        <>
          <span
            className={`text-sm flex-1 truncate ${color.text} font-medium`}
            title={node.description ?? undefined}
          >
            {node.name}
          </span>
          {canManage && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => setEditing(true)}
                className={`${color.text} hover:opacity-70 p-1 rounded hover:bg-white/10`}
                type="button"
                title="Modifier"
              >
                <Pencil size={11} />
              </button>
              <DeleteZoneButton zoneId={node.id} zoneName={node.name} />
            </div>
          )}
        </>
      )}
    </li>
  )
}

// ---------------------------------------------------------------------------
// Formulaire création
// ---------------------------------------------------------------------------

function NewZoneForm({ parentZones }: { parentZones: ZoneNode[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      const result = await createBoxZone({ name, parent_id: parentId || null })
      if (result.error) {
        setError(friendlyError(result.error))
      } else {
        const created = name.trim()
        const isSub = !!parentId
        setName('')
        setSuccess(
          isSub ? `Sous-zone « ${created} » ajoutée` : `Zone « ${created} » ajoutée`
        )
        router.refresh()
        setTimeout(() => setSuccess(null), 2500)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-muted flex items-center gap-1.5">
        <Plus size={11} />
        Nouvelle zone ou sous-zone
      </div>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ex : Chenil 1, Box extérieur"
        required
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
      />
      <select
        value={parentId}
        onChange={(e) => setParentId(e.target.value)}
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm cursor-pointer hover:bg-surface-hover"
      >
        <option value="">Zone racine (pas de parent)</option>
        {parentZones.map((p) => (
          <option key={p.id} value={p.id}>
            ↳ Sous-zone de « {p.name} »
          </option>
        ))}
      </select>
      {error && (
        <div className="rounded-lg border border-error/30 bg-error/10 px-2.5 py-1.5">
          <p className="text-xs text-error">{error}</p>
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-success/30 bg-success/10 px-2.5 py-1.5">
          <p className="text-xs text-success flex items-center gap-1.5">
            <Check size={12} /> {success}
          </p>
        </div>
      )}
      <button
        type="submit"
        disabled={pending || !name.trim()}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold gradient-primary text-white hover:opacity-90 disabled:opacity-50 shadow-md shadow-primary/30 transition-all"
      >
        {pending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
        Ajouter
      </button>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Formulaire édition inline
// ---------------------------------------------------------------------------

function ZoneEditForm({ node, onClose }: { node: BoxZone; onClose: () => void }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState(node.name)
  const [error, setError] = useState<string | null>(null)

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await updateBoxZone(node.id, { name })
      if (result.error) setError(friendlyError(result.error))
      else {
        router.refresh()
        onClose()
      }
    })
  }

  return (
    <form onSubmit={handleSave} className="flex items-center gap-1 flex-1">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        className="flex-1 rounded border border-border bg-surface px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
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
        className="px-2 py-0.5 rounded border border-border text-[10px] hover:bg-surface-hover"
      >
        Annuler
      </button>
      {error && <span className="text-[10px] text-error ml-1">{error}</span>}
    </form>
  )
}

// ---------------------------------------------------------------------------
// Bouton suppression
// ---------------------------------------------------------------------------

function DeleteZoneButton({ zoneId, zoneName }: { zoneId: string; zoneName: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleDelete() {
    if (!confirm(`Supprimer la zone « ${zoneName} » ?`)) return
    setError(null)
    startTransition(async () => {
      const result = await deleteBoxZone(zoneId)
      if (result.error) setError(friendlyError(result.error))
      else router.refresh()
    })
  }

  return (
    <>
      <button
        onClick={handleDelete}
        disabled={pending}
        className="text-muted hover:text-error disabled:opacity-50 p-1 rounded hover:bg-white/10"
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

// ---------------------------------------------------------------------------
// Traduction des erreurs Postgres
// ---------------------------------------------------------------------------

function friendlyError(raw: string): string {
  if (raw.includes('row-level security')) {
    return 'Permission refusée. Vérifie tes droits sur cet établissement.'
  }
  if (raw.includes('duplicate key') || raw.includes('unique constraint')) {
    return 'Une zone porte déjà ce nom à cet emplacement.'
  }
  if (raw.includes('profondeur max')) {
    return 'Une sous-zone ne peut pas elle-même contenir des sous-zones.'
  }
  return raw
}
