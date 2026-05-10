import Link from 'next/link'
import { Package, Printer, MapPin, CornerDownRight } from 'lucide-react'
import { getBoxes } from '@/lib/actions/boxes'
import { listBoxZones, type BoxZone } from '@/lib/actions/box-zones'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { ZonesManager } from '@/components/boxes/zones-manager'
import { getZoneColor, NONE_ZONE_COLOR, type ZoneColor } from '@/lib/zone-colors'
import type { Box, BoxSpecies, BoxStatus } from '@/lib/types/database'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BoxAnimal {
  id: string
  name: string
  species: string
  sex?: string | null
  status?: string | null
  photo_url?: string | null
  birth_date?: string | null
  sterilized?: boolean | null
  adoptable?: boolean | null
  reserved?: boolean | null
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

interface SubZoneGroup {
  zone: BoxZone
  boxes: EnrichedBox[]
}

interface RootZoneGroup {
  // null pour la pseudo-zone "Sans zone"
  zone: BoxZone | null
  color: ZoneColor
  directBoxes: EnrichedBox[]
  subzones: SubZoneGroup[]
  totalBoxes: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSpeciesIcon(species: BoxSpecies): string {
  const icons: Record<BoxSpecies, string> = { cat: '🐱', dog: '🐶', mixed: '🐾' }
  return icons[species] || '🐾'
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

// Code couleur par statut animal
function getAnimalStatusColor(status: string | null | undefined): {
  bg: string
  text: string
  label: string
} {
  switch (status) {
    case 'shelter':
      return { bg: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300', label: 'Refuge' }
    case 'pound':
      return { bg: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300', label: 'Fourrière' }
    case 'foster_family':
      return { bg: 'bg-violet-500', text: 'text-violet-700 dark:text-violet-300', label: 'FA' }
    case 'boarding':
      return { bg: 'bg-teal-500', text: 'text-teal-700 dark:text-teal-300', label: 'Pension' }
    case 'adopted':
      return { bg: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-300', label: 'Adopté' }
    case 'returned':
      return { bg: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-300', label: 'Rendu' }
    case 'transferred':
      return { bg: 'bg-indigo-500', text: 'text-indigo-700 dark:text-indigo-300', label: 'Transféré' }
    case 'deceased':
    case 'euthanized':
      return { bg: 'bg-zinc-500', text: 'text-zinc-600 dark:text-zinc-400', label: 'Décédé' }
    default:
      return { bg: 'bg-muted', text: 'text-muted', label: status ?? '—' }
  }
}

function getAgeLabel(birthDate: string | null | undefined): string | null {
  if (!birthDate) return null
  const bd = new Date(birthDate)
  if (Number.isNaN(bd.getTime())) return null
  const now = new Date()
  let years = now.getFullYear() - bd.getFullYear()
  const m = now.getMonth() - bd.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < bd.getDate())) years--
  if (years < 1) {
    const months = Math.max(
      0,
      (now.getFullYear() - bd.getFullYear()) * 12 + (now.getMonth() - bd.getMonth())
    )
    return `${months} mois`
  }
  return `${years} an${years > 1 ? 's' : ''}`
}

function getSexSymbol(sex: string | null | undefined): { symbol: string; color: string } | null {
  if (sex === 'male') return { symbol: '♂', color: 'text-blue-500' }
  if (sex === 'female') return { symbol: '♀', color: 'text-pink-500' }
  return null
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

  const rootGroups = groupBoxesByRootZone(boxes ?? [], allZones)

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

      {/* Cartes par zone racine */}
      {!boxes || boxes.length === 0 ? (
        <div className="bg-surface rounded-xl border border-border p-8 text-center">
          <Package className="w-10 h-10 text-muted mx-auto mb-3" />
          <p className="text-muted text-sm">Aucun box enregistre</p>
        </div>
      ) : (
        <div className="space-y-6">
          {rootGroups.map((group) => (
            <RootZoneSection
              key={group.zone?.id ?? '__none'}
              group={group}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section par zone racine
// ---------------------------------------------------------------------------

function RootZoneSection({ group }: { group: RootZoneGroup }) {
  const { zone, color, directBoxes, subzones, totalBoxes } = group
  const isNone = zone === null

  return (
    <section
      className={`rounded-2xl border ${color.borderSoft} ${color.bgSoft} overflow-hidden shadow-lg shadow-black/5 ring-1 ${color.ring} animate-fade-up`}
    >
      {/* Header zone racine — gradient horizontal */}
      <header
        className={`relative flex items-center gap-4 px-6 py-4 ${color.bg} overflow-hidden`}
      >
        {/* Halo decoratif */}
        <div
          className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-white/10 blur-3xl pointer-events-none"
          aria-hidden
        />
        <div
          className="absolute -left-8 -bottom-8 w-32 h-32 rounded-full bg-black/10 blur-2xl pointer-events-none"
          aria-hidden
        />

        {/* Icone glowing */}
        <span
          className={`relative flex items-center justify-center w-11 h-11 rounded-xl bg-white/20 backdrop-blur-sm shrink-0 shadow-lg`}
        >
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
            <p className={`text-xs ${color.textOn} opacity-80 truncate mt-0.5`}>
              {zone.description}
            </p>
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
        {/* Boxes directement rattachés à la zone racine */}
        {directBoxes.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {directBoxes.map((box) => (
              <BoxCard key={box.id} box={box} color={color} />
            ))}
          </div>
        )}

        {/* Sous-zones */}
        {subzones.map((sub) => (
          <SubZoneSection key={sub.zone.id} sub={sub} color={color} />
        ))}

        {directBoxes.length === 0 && subzones.length === 0 && (
          <p className={`text-xs ${color.text} opacity-70 italic`}>
            Aucun box dans cette zone.
          </p>
        )}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Sous-section (sous-zone)
// ---------------------------------------------------------------------------

function SubZoneSection({ sub, color }: { sub: SubZoneGroup; color: ZoneColor }) {
  return (
    <div
      className={`relative rounded-xl border ${color.borderSoft} ${color.bgSofter} overflow-hidden`}
    >
      {/* Bande verticale colorée */}
      <div className={`absolute inset-y-0 left-0 w-1 ${color.dot}`} aria-hidden />

      <header className={`flex items-center gap-2.5 pl-4 pr-3 py-2.5 ${color.bgSofter}`}>
        <span
          className={`flex items-center justify-center w-6 h-6 rounded-md ${color.dot} ${color.textOn} shadow-sm`}
        >
          <CornerDownRight className="w-3.5 h-3.5" />
        </span>
        <h3 className={`flex-1 font-semibold text-sm ${color.text}`}>
          {sub.zone.name}
        </h3>
        <span
          className={`px-2 py-0.5 rounded-full bg-white/30 dark:bg-black/20 text-[11px] font-semibold ${color.text}`}
        >
          {sub.boxes.length} box{sub.boxes.length !== 1 ? 's' : ''}
        </span>
      </header>
      <div className="p-4 pl-5">
        {sub.boxes.length === 0 ? (
          <p className={`text-xs ${color.text} opacity-60 italic`}>
            Aucun box dans cette sous-zone.
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {sub.boxes.map((box) => (
              <BoxCard key={box.id} box={box} color={color} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Carte box — ultra visuelle avec photos animaux
// ---------------------------------------------------------------------------

function BoxCard({ box, color }: { box: EnrichedBox; color: ZoneColor }) {
  const isEmpty = box.animals.length === 0
  const isFull = box.animal_count >= box.capacity
  const heroAnimal = box.animals[0]
  const otherAnimals = box.animals.slice(1)

  return (
    <div
      className={`group relative bg-surface rounded-2xl border ${color.borderSoft} overflow-hidden hover:shadow-2xl hover:shadow-black/10 hover:-translate-y-0.5 transition-all duration-200`}
    >
      {/* Bandeau couleur de la zone (top) */}
      <div className={`h-1 ${color.bg}`} aria-hidden />

      {/* Hero photo / etat vide */}
      <div className="relative aspect-[4/3] overflow-hidden bg-muted/10">
        {isEmpty ? (
          <BoxEmptyHero box={box} color={color} />
        ) : (
          <BoxAnimalsHero animals={box.animals} color={color} />
        )}

        {/* Overlay top : statut box + capacite */}
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-2 pointer-events-none">
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md shadow-sm ${getBoxStatusColor(
              box.status
            )}`}
          >
            {getBoxStatusLabel(box.status)}
          </span>
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-bold backdrop-blur-md shadow-sm ${
              isFull
                ? 'bg-error/90 text-white'
                : 'bg-white/90 text-zinc-900 dark:bg-zinc-900/85 dark:text-white'
            }`}
          >
            {box.animal_count}/{box.capacity}
          </span>
        </div>
      </div>

      {/* Header : nom du box */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl shrink-0">{getSpeciesIcon(box.species_type)}</span>
            <div className="min-w-0">
              <h3 className="font-bold text-sm truncate">{box.name}</h3>
              <p className="text-[10px] text-muted uppercase tracking-wider">
                {getSpeciesTypeLabel(box.species_type)}
              </p>
            </div>
          </div>
        </div>

        {/* Capacity bar */}
        <div className="w-full h-1 bg-muted/15 rounded-full overflow-hidden mb-2">
          <div
            className={`h-full rounded-full transition-all ${getCapacityBarColor(box.animal_count, box.capacity)}`}
            style={{
              width: `${Math.min((box.animal_count / Math.max(box.capacity, 1)) * 100, 100)}%`,
            }}
          />
        </div>
      </div>

      {/* Liste compacte des animaux (sous le hero) */}
      {!isEmpty && (
        <div className="px-4 pb-3 space-y-1.5">
          <AnimalMiniRow animal={heroAnimal} primary />
          {otherAnimals.map((animal) => (
            <AnimalMiniRow key={animal.id} animal={animal} />
          ))}
        </div>
      )}

      {/* Footer : impression */}
      <div className="px-4 pb-3 pt-1 border-t border-border/40 flex items-center justify-between">
        <a
          href={`/api/pdf/box/${box.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-primary transition-colors"
        >
          <Printer className="w-3 h-3" />
          Fiche PDF
        </a>
        {!isEmpty && (
          <span className="text-[10px] text-muted">
            {box.animals.length} animal{box.animals.length > 1 ? 'x' : ''}
          </span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Hero : carrousel/mosaic de photos animaux
// ---------------------------------------------------------------------------

function BoxAnimalsHero({
  animals,
  color,
}: {
  animals: BoxAnimal[]
  color: ZoneColor
}) {
  // 1 animal -> photo plein cadre
  if (animals.length === 1) {
    return <AnimalHeroSingle animal={animals[0]} color={color} />
  }
  // 2 animaux -> split vertical
  if (animals.length === 2) {
    return (
      <div className="grid grid-cols-2 gap-0.5 h-full">
        {animals.map((a) => (
          <AnimalHeroSingle key={a.id} animal={a} color={color} compact />
        ))}
      </div>
    )
  }
  // 3+ animaux -> 1 grand + 2 petits a droite (style Pinterest)
  const [main, ...rest] = animals
  const top = rest[0]
  const bottom = rest[1]
  const extra = rest.length - 2
  return (
    <div className="grid grid-cols-3 grid-rows-2 gap-0.5 h-full">
      <div className="col-span-2 row-span-2">
        <AnimalHeroSingle animal={main} color={color} compact />
      </div>
      <div className="relative">
        <AnimalHeroSingle animal={top} color={color} compact tiny />
      </div>
      <div className="relative">
        <AnimalHeroSingle animal={bottom} color={color} compact tiny />
        {extra > 0 && (
          <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px] flex items-center justify-center text-white font-bold text-base">
            +{extra}
          </div>
        )}
      </div>
    </div>
  )
}

function AnimalHeroSingle({
  animal,
  color,
  compact = false,
  tiny = false,
}: {
  animal: BoxAnimal
  color: ZoneColor
  compact?: boolean
  tiny?: boolean
}) {
  const sex = getSexSymbol(animal.sex)
  const status = getAnimalStatusColor(animal.status)
  return (
    <Link
      href={`/animals/${animal.id}`}
      className="relative block w-full h-full overflow-hidden group/hero"
    >
      {animal.photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={animal.photo_url}
          alt={animal.name}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover/hero:scale-105"
        />
      ) : (
        <div className={`absolute inset-0 ${color.bgSoft} flex items-center justify-center`}>
          <span className={tiny ? 'text-3xl' : compact ? 'text-5xl' : 'text-6xl'}>
            {animal.species === 'cat' ? '🐱' : animal.species === 'dog' ? '🐶' : '🐾'}
          </span>
        </div>
      )}

      {/* Gradient bottom + overlay nom */}
      {!tiny && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2 pt-8">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`w-1.5 h-1.5 rounded-full ${status.bg}`} />
            <span className="font-bold text-white text-xs truncate uppercase tracking-wide">
              {animal.name}
            </span>
            {sex && (
              <span className={`text-sm font-bold ${sex.color === 'text-blue-500' ? 'text-blue-300' : 'text-pink-300'}`}>
                {sex.symbol}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Badges (adoptable / reserved) */}
      {!tiny && !compact && (
        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
          {animal.reserved && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500 text-white shadow">
              Réservé
            </span>
          )}
          {animal.adoptable && !animal.reserved && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500 text-white shadow">
              Adoptable
            </span>
          )}
        </div>
      )}
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Hero etat vide
// ---------------------------------------------------------------------------

function BoxEmptyHero({ box, color }: { box: EnrichedBox; color: ZoneColor }) {
  return (
    <div
      className={`relative flex flex-col items-center justify-center h-full ${color.bgSofter}`}
    >
      <div
        className={`flex items-center justify-center w-16 h-16 rounded-2xl ${color.bgSoft} border ${color.borderSoft} mb-2 shadow-sm`}
      >
        <span className="text-4xl">{getSpeciesIcon(box.species_type)}</span>
      </div>
      <p className={`text-[11px] font-bold uppercase tracking-wider ${color.text}`}>
        Disponible
      </p>
      <p className="text-[10px] text-muted mt-0.5">
        {box.capacity} place{box.capacity > 1 ? 's' : ''}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Mini ligne animal (sous le hero)
// ---------------------------------------------------------------------------

function AnimalMiniRow({
  animal,
  primary = false,
}: {
  animal: BoxAnimal
  primary?: boolean
}) {
  const sex = getSexSymbol(animal.sex)
  const status = getAnimalStatusColor(animal.status)
  const age = getAgeLabel(animal.birth_date)

  return (
    <Link
      href={`/animals/${animal.id}`}
      className="flex items-center gap-2 group/row hover:bg-surface-hover -mx-1 px-1 py-0.5 rounded-md transition-colors"
    >
      {/* Avatar */}
      <div
        className={`relative w-7 h-7 rounded-full overflow-hidden bg-muted/15 shrink-0 ring-2 ${
          primary ? 'ring-primary/20' : 'ring-transparent'
        }`}
      >
        {animal.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={animal.photo_url}
            alt={animal.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-sm">
            {animal.species === 'cat' ? '🐱' : '🐶'}
          </div>
        )}
        {/* Pastille statut */}
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${status.bg} ring-2 ring-surface`}
          title={status.label}
        />
      </div>

      {/* Infos */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="font-semibold text-xs truncate group-hover/row:text-primary">
            {animal.name}
          </span>
          {sex && (
            <span className={`text-xs font-bold ${sex.color}`}>{sex.symbol}</span>
          )}
        </div>
        <div className={`text-[10px] ${status.text} flex items-center gap-1`}>
          <span>{status.label}</span>
          {age && (
            <>
              <span className="opacity-50">·</span>
              <span>{age}</span>
            </>
          )}
          {animal.sterilized && (
            <>
              <span className="opacity-50">·</span>
              <span title="Stérilisé">⚕</span>
            </>
          )}
        </div>
      </div>
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Group helper : zone racine -> sous-zones -> boxes
// ---------------------------------------------------------------------------

function groupBoxesByRootZone(boxes: EnrichedBox[], zones: BoxZone[]): RootZoneGroup[] {
  const zoneById = new Map<string, BoxZone>()
  for (const z of zones) zoneById.set(z.id, z)

  // Map<rootId | "__none", RootZoneGroup>
  const rootMap = new Map<string, RootZoneGroup>()

  // Initialise toutes les zones racines (meme sans box, on les affiche pour visibilite)
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

  // Distribue les boxes
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

  // Tri : zones racines d'abord (par sort_order/name), "Sans zone" en dernier
  const result = Array.from(rootMap.values())
  return result.sort((a, b) => {
    if (a.zone === null) return 1
    if (b.zone === null) return -1
    return (
      a.zone.sort_order - b.zone.sort_order ||
      a.zone.name.localeCompare(b.zone.name)
    )
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
