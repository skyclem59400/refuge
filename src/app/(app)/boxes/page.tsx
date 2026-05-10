import { Package, MapPin, CornerDownRight } from 'lucide-react'
import { getBoxes } from '@/lib/actions/boxes'
import { listBoxZones, type BoxZone } from '@/lib/actions/box-zones'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { ZonesManager } from '@/components/boxes/zones-manager'
import { BoxCard } from '@/components/boxes/box-card'
import type { EnrichedBox, BoxSummary } from '@/components/boxes/types'
import { getZoneColor, NONE_ZONE_COLOR, type ZoneColor } from '@/lib/zone-colors'
import type { BoxSpecies } from '@/lib/types/database'

// ---------------------------------------------------------------------------
// Types groupes
// ---------------------------------------------------------------------------

interface SubZoneGroup {
  zone: BoxZone
  boxes: EnrichedBox[]
}

interface RootZoneGroup {
  zone: BoxZone | null // null = "Sans zone"
  color: ZoneColor
  directBoxes: EnrichedBox[]
  subzones: SubZoneGroup[]
  totalBoxes: number
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function BoxesPage() {
  const ctx = await getEstablishmentContext()
  if (!ctx) throw new Error('Establishment context required')
  const canManageBoxes = ctx.permissions.canManageBoxes

  const [{ data: rawBoxes, error }, { data: zones }] = await Promise.all([
    getBoxes(),
    listBoxZones(),
  ])
  const boxes = (rawBoxes as EnrichedBox[] | undefined) ?? []
  const allZones = (zones ?? []) as BoxZone[]

  const rootGroups = groupBoxesByRootZone(boxes, allZones)

  // BoxSummary list pour le picker "Deplacer vers"
  const allBoxesSummary = buildBoxSummaries(boxes, allZones)

  return (
    <div className="animate-fade-up">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Package className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Box</h1>
            <p className="text-sm text-muted mt-1">
              {boxes.length} box enregistré{boxes.length !== 1 ? 's' : ''}
              {allZones.length > 0 && (
                <>
                  {' · '}
                  {allZones.filter((z) => !z.parent_id).length} zone
                  {allZones.filter((z) => !z.parent_id).length !== 1 ? 's' : ''}
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/api/pdf/box-list"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-border text-muted hover:text-text hover:bg-surface-hover transition-colors"
          >
            Imprimer la liste
          </a>
          <ZonesManager zones={allZones} canManage={canManageBoxes} />
          {canManageBoxes && (
            <details className="relative">
              <summary className="cursor-pointer px-4 py-2 rounded-lg font-semibold text-white text-sm gradient-primary hover:opacity-90 transition-opacity shadow-lg shadow-primary/25 list-none flex items-center gap-2">
                + Nouveau box
              </summary>
              <div className="absolute right-0 top-full mt-2 z-50 w-80 bg-surface rounded-xl border border-border shadow-xl p-4">
                <BoxForm zones={allZones} />
              </div>
            </details>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-error/30 bg-error/10 p-4 text-error text-sm">
          {error}
        </div>
      )}

      {boxes.length === 0 ? (
        <div className="bg-surface rounded-xl border border-border p-8 text-center">
          <Package className="w-10 h-10 text-muted mx-auto mb-3" />
          <p className="text-muted text-sm">Aucun box enregistré</p>
        </div>
      ) : (
        <div className="space-y-6">
          {rootGroups.map((group) => (
            <RootZoneSection
              key={group.zone?.id ?? '__none'}
              group={group}
              canManage={canManageBoxes}
              allBoxes={allBoxesSummary}
              zones={allZones}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sections par zone racine et sous-zone
// ---------------------------------------------------------------------------

function RootZoneSection({
  group,
  canManage,
  allBoxes,
  zones,
}: {
  group: RootZoneGroup
  canManage: boolean
  allBoxes: BoxSummary[]
  zones: BoxZone[]
}) {
  const { zone, color, directBoxes, subzones, totalBoxes } = group
  const isNone = zone === null

  return (
    <section
      className={`rounded-2xl border ${color.borderSoft} ${color.bgSoft} overflow-hidden shadow-lg shadow-black/5 ring-1 ${color.ring} animate-fade-up`}
    >
      <header className={`relative flex items-center gap-4 px-6 py-4 ${color.bg} overflow-hidden`}>
        <div
          className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-white/10 blur-3xl pointer-events-none"
          aria-hidden
        />
        <div
          className="absolute -left-8 -bottom-8 w-32 h-32 rounded-full bg-black/10 blur-2xl pointer-events-none"
          aria-hidden
        />

        <span className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-white/20 backdrop-blur-sm shrink-0 shadow-lg">
          {isNone ? (
            <Package className={`w-5 h-5 ${color.textOn}`} />
          ) : (
            <MapPin className={`w-5 h-5 ${color.textOn}`} />
          )}
        </span>

        <div className="flex-1 min-w-0 relative">
          <div className={`text-[10px] uppercase tracking-[0.2em] font-bold opacity-75 ${color.textOn} mb-0.5`}>
            {isNone ? 'Non sectorisé' : 'Zone'}
          </div>
          <h2 className={`font-bold text-xl leading-tight ${color.textOn}`}>
            {isNone ? 'Sans zone' : zone.name}
          </h2>
          {zone?.description && (
            <p className={`text-xs ${color.textOn} opacity-80 truncate mt-0.5`}>{zone.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2 relative">
          {subzones.length > 0 && (
            <span className={`px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-xs font-semibold ${color.textOn}`}>
              {subzones.length} sous-zone{subzones.length !== 1 ? 's' : ''}
            </span>
          )}
          <span className={`px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm text-xs font-bold ${color.textOn} shadow-md`}>
            {totalBoxes} box{totalBoxes !== 1 ? 's' : ''}
          </span>
        </div>
      </header>

      <div className="p-5 space-y-5">
        {directBoxes.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {directBoxes.map((box) => (
              <BoxCard
                key={box.id}
                box={box}
                color={color}
                canManage={canManage}
                allBoxes={allBoxes}
                zones={zones}
              />
            ))}
          </div>
        )}

        {subzones.map((sub) => (
          <SubZoneSection
            key={sub.zone.id}
            sub={sub}
            color={color}
            canManage={canManage}
            allBoxes={allBoxes}
            zones={zones}
          />
        ))}

        {directBoxes.length === 0 && subzones.length === 0 && (
          <p className={`text-xs ${color.text} opacity-70 italic`}>Aucun box dans cette zone.</p>
        )}
      </div>
    </section>
  )
}

function SubZoneSection({
  sub,
  color,
  canManage,
  allBoxes,
  zones,
}: {
  sub: SubZoneGroup
  color: ZoneColor
  canManage: boolean
  allBoxes: BoxSummary[]
  zones: BoxZone[]
}) {
  return (
    <div className={`relative rounded-xl border ${color.borderSoft} ${color.bgSofter} overflow-hidden`}>
      <div className={`absolute inset-y-0 left-0 w-1 ${color.dot}`} aria-hidden />

      <header className={`flex items-center gap-2.5 pl-4 pr-3 py-2.5 ${color.bgSofter}`}>
        <span className={`flex items-center justify-center w-6 h-6 rounded-md ${color.dot} ${color.textOn} shadow-sm`}>
          <CornerDownRight className="w-3.5 h-3.5" />
        </span>
        <h3 className={`flex-1 font-semibold text-sm ${color.text}`}>{sub.zone.name}</h3>
        <span className={`px-2 py-0.5 rounded-full bg-white/30 dark:bg-black/20 text-[11px] font-semibold ${color.text}`}>
          {sub.boxes.length} box{sub.boxes.length !== 1 ? 's' : ''}
        </span>
      </header>
      <div className="p-4 pl-5">
        {sub.boxes.length === 0 ? (
          <p className={`text-xs ${color.text} opacity-60 italic`}>Aucun box dans cette sous-zone.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {sub.boxes.map((box) => (
              <BoxCard
                key={box.id}
                box={box}
                color={color}
                canManage={canManage}
                allBoxes={allBoxes}
                zones={zones}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Group & summary helpers
// ---------------------------------------------------------------------------

function groupBoxesByRootZone(boxes: EnrichedBox[], zones: BoxZone[]): RootZoneGroup[] {
  const zoneById = new Map<string, BoxZone>()
  for (const z of zones) zoneById.set(z.id, z)

  const rootMap = new Map<string, RootZoneGroup>()

  for (const z of zones) {
    if (z.parent_id) continue
    rootMap.set(z.id, {
      zone: z,
      color: getZoneColor(z.id),
      directBoxes: [],
      subzones: zones
        .filter((c) => c.parent_id === z.id)
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
        .map((c) => ({ zone: c, boxes: [] })),
      totalBoxes: 0,
    })
  }

  for (const box of boxes) {
    if (!box.zone_id || !zoneById.has(box.zone_id)) {
      const noneKey = '__none'
      if (!rootMap.has(noneKey)) {
        rootMap.set(noneKey, {
          zone: null,
          color: NONE_ZONE_COLOR,
          directBoxes: [],
          subzones: [],
          totalBoxes: 0,
        })
      }
      const g = rootMap.get(noneKey)!
      g.directBoxes.push(box)
      g.totalBoxes++
      continue
    }

    const zone = zoneById.get(box.zone_id)!
    const rootId = zone.parent_id ?? zone.id
    const root = rootMap.get(rootId)
    if (!root) continue

    if (zone.parent_id) {
      const sub = root.subzones.find((s) => s.zone.id === zone.id)
      if (sub) sub.boxes.push(box)
    } else {
      root.directBoxes.push(box)
    }
    root.totalBoxes++
  }

  const result = Array.from(rootMap.values())
  return result.sort((a, b) => {
    if (a.zone === null) return 1
    if (b.zone === null) return -1
    return a.zone.sort_order - b.zone.sort_order || a.zone.name.localeCompare(b.zone.name)
  })
}

function buildBoxSummaries(boxes: EnrichedBox[], zones: BoxZone[]): BoxSummary[] {
  const zoneById = new Map(zones.map((z) => [z.id, z]))
  return boxes.map((box) => {
    let zoneLabel: string | null = null
    if (box.zone_id && zoneById.has(box.zone_id)) {
      const z = zoneById.get(box.zone_id)!
      const parent = z.parent_id ? zoneById.get(z.parent_id) : null
      zoneLabel = parent ? `${parent.name} › ${z.name}` : z.name
    }
    return {
      id: box.id,
      name: box.name,
      capacity: box.capacity,
      species_type: box.species_type,
      zone_label: zoneLabel,
      current_count: box.animal_count,
    }
  })
}

// ---------------------------------------------------------------------------
// Form Server Component pour creer un box
// ---------------------------------------------------------------------------

function BoxForm({ zones }: { zones: BoxZone[] }) {
  async function handleCreate(formData: FormData) {
    'use server'
    const { createBox } = await import('@/lib/actions/boxes')
    const name = formData.get('name') as string
    const species_type = formData.get('species_type') as BoxSpecies
    const capacity = parseInt(formData.get('capacity') as string, 10)
    const zone_id = (formData.get('zone_id') as string) || null

    if (!name || !species_type || isNaN(capacity)) return

    await createBox({ name, species_type, capacity, zone_id })
  }

  const zoneOptions = zones
    .map((z) => {
      const parent = z.parent_id ? zones.find((p) => p.id === z.parent_id) : null
      return { id: z.id, label: parent ? `${parent.name} › ${z.name}` : z.name }
    })
    .sort((a, b) => a.label.localeCompare(b.label))

  return (
    <form action={handleCreate} className="space-y-3">
      <div>
        <label htmlFor="box-name" className="block text-xs font-medium text-muted mb-1">
          Nom du box
        </label>
        <input
          id="box-name"
          name="name"
          type="text"
          required
          placeholder="Ex: Box A1"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>
      <div>
        <label htmlFor="box-zone" className="block text-xs font-medium text-muted mb-1">
          Zone (optionnel)
        </label>
        <select
          id="box-zone"
          name="zone_id"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="">— Aucune zone —</option>
          {zoneOptions.map((z) => (
            <option key={z.id} value={z.id}>
              {z.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="box-species" className="block text-xs font-medium text-muted mb-1">
          Type d&apos;espèce
        </label>
        <select
          id="box-species"
          name="species_type"
          required
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="cat">Chats</option>
          <option value="dog">Chiens</option>
          <option value="mixed">Mixte</option>
        </select>
      </div>
      <div>
        <label htmlFor="box-capacity" className="block text-xs font-medium text-muted mb-1">
          Capacité
        </label>
        <input
          id="box-capacity"
          name="capacity"
          type="number"
          required
          min={1}
          defaultValue={4}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>
      <button
        type="submit"
        className="w-full px-4 py-2 rounded-lg font-semibold text-white text-sm gradient-primary hover:opacity-90 transition-opacity"
      >
        Créer le box
      </button>
    </form>
  )
}
