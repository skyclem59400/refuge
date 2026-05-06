import Link from 'next/link'
import { Package, Printer } from 'lucide-react'
import { getBoxes } from '@/lib/actions/boxes'
import { listBoxZones, type BoxZone } from '@/lib/actions/box-zones'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { ZonesManager } from '@/components/boxes/zones-manager'
import type { Box, BoxSpecies, BoxStatus } from '@/lib/types/database'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BoxAnimal {
  id: string
  name: string
  species: string
}

type EnrichedBox = Box & {
  animals: BoxAnimal[]
  animal_count: number
  zone?: {
    id: string
    name: string
    parent_id: string | null
    parent?: { id: string; name: string } | null
  } | null
  zone_id?: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSpeciesIcon(species: BoxSpecies): string {
  const icons: Record<BoxSpecies, string> = { cat: '\uD83D\uDC31', dog: '\uD83D\uDC36', mixed: '\uD83D\uDC3E' }
  return icons[species] || '\uD83D\uDC3E'
}

function getSpeciesTypeLabel(species: BoxSpecies): string {
  const labels: Record<BoxSpecies, string> = { cat: 'Chats', dog: 'Chiens', mixed: 'Mixte' }
  return labels[species] || species
}

function getBoxStatusLabel(status: BoxStatus): string {
  const labels: Record<BoxStatus, string> = {
    available: 'Disponible',
    occupied: 'Occupe',
    maintenance: 'Maintenance',
  }
  return labels[status] || status
}

function getBoxStatusColor(status: BoxStatus): string {
  const colors: Record<BoxStatus, string> = {
    available: 'bg-success/15 text-success',
    occupied: 'bg-warning/15 text-warning',
    maintenance: 'bg-error/15 text-error',
  }
  return colors[status] || 'bg-muted/15 text-muted'
}

function getCapacityBarColor(animalCount: number, capacity: number): string {
  if (animalCount >= capacity) return 'bg-error'
  if (animalCount > 0) return 'bg-primary'
  return 'bg-muted/30'
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
  const boxes = (rawBoxes as EnrichedBox[] | undefined)
  const allZones = (zones ?? []) as BoxZone[]

  // Group boxes by zone path
  const groups = groupBoxesByZone(boxes ?? [], allZones)

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Package className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Box</h1>
            <p className="text-sm text-muted mt-1">
              {boxes ? boxes.length : 0} box enregistre{(boxes?.length || 0) !== 1 ? 's' : ''}
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
            <Printer className="w-4 h-4" />
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

      {/* Groupes (zones / sous-zones / sans zone) */}
      {!boxes || boxes.length === 0 ? (
        <div className="bg-surface rounded-xl border border-border p-8 text-center">
          <Package className="w-10 h-10 text-muted mx-auto mb-3" />
          <p className="text-muted text-sm">Aucun box enregistre</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.key}>
              <h2 className="text-xs uppercase tracking-[0.2em] font-bold text-muted mb-3">
                {group.label}{' '}
                <span className="text-muted/60 font-normal normal-case tracking-normal">
                  · {group.boxes.length} box
                </span>
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {group.boxes.map((box) => (
            <div
              key={box.id}
              className="bg-surface rounded-xl border border-border p-4 hover:border-primary/30 transition-colors"
            >
              {/* Box header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{getSpeciesIcon(box.species_type)}</span>
                  <div>
                    <h3 className="font-semibold text-sm">{box.name}</h3>
                    <p className="text-xs text-muted">{getSpeciesTypeLabel(box.species_type)}</p>
                  </div>
                </div>
              </div>

              {/* Status badge */}
              <div className="flex items-center justify-between mb-3">
                <span
                  className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getBoxStatusColor(
                    box.status
                  )}`}
                >
                  {getBoxStatusLabel(box.status)}
                </span>
                <span className="text-xs text-muted">
                  {box.animal_count}/{box.capacity}
                </span>
              </div>

              {/* Capacity bar */}
              <div className="w-full h-1.5 bg-muted/15 rounded-full mb-3 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${getCapacityBarColor(box.animal_count, box.capacity)}`}
                  style={{
                    width: `${Math.min((box.animal_count / Math.max(box.capacity, 1)) * 100, 100)}%`,
                  }}
                />
              </div>

              {/* Animals list */}
              {box.animals.length > 0 && (
                <div className="space-y-1">
                  {box.animals.map((animal) => (
                    <Link
                      key={animal.id}
                      href={`/animals/${animal.id}`}
                      className="flex items-center gap-1.5 text-xs text-muted hover:text-primary transition-colors"
                    >
                      <span>{animal.species === 'cat' ? '\uD83D\uDC31' : '\uD83D\uDC36'}</span>
                      <span>{animal.name}</span>
                    </Link>
                  ))}
                </div>
              )}

              {/* Print sheet */}
              <a
                href={`/api/pdf/box/${box.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-xs text-muted hover:text-primary transition-colors"
              >
                <Printer className="w-3 h-3" />
                Imprimer la fiche
              </a>
            </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Group helper
// ---------------------------------------------------------------------------

interface BoxGroup {
  key: string
  label: string
  boxes: EnrichedBox[]
}

function groupBoxesByZone(boxes: EnrichedBox[], zones: BoxZone[]): BoxGroup[] {
  const zoneById = new Map<string, BoxZone>()
  for (const z of zones) zoneById.set(z.id, z)

  const groups = new Map<string, BoxGroup>()
  for (const box of boxes) {
    if (!box.zone_id) {
      const k = '__none'
      if (!groups.has(k)) groups.set(k, { key: k, label: 'Sans zone', boxes: [] })
      groups.get(k)!.boxes.push(box)
      continue
    }
    const zone = zoneById.get(box.zone_id)
    if (!zone) {
      const k = '__none'
      if (!groups.has(k)) groups.set(k, { key: k, label: 'Sans zone', boxes: [] })
      groups.get(k)!.boxes.push(box)
      continue
    }
    const parent = zone.parent_id ? zoneById.get(zone.parent_id) : null
    const label = parent ? `${parent.name} › ${zone.name}` : zone.name
    if (!groups.has(zone.id)) groups.set(zone.id, { key: zone.id, label, boxes: [] })
    groups.get(zone.id)!.boxes.push(box)
  }

  return Array.from(groups.values()).sort((a, b) => {
    if (a.key === '__none') return 1
    if (b.key === '__none') return -1
    return a.label.localeCompare(b.label)
  })
}

// ---------------------------------------------------------------------------
// Inline form component (server action based)
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
      return {
        id: z.id,
        label: parent ? `${parent.name} › ${z.name}` : z.name,
      }
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
          Type d&apos;espece
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
          Capacite
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
        Creer le box
      </button>
    </form>
  )
}
