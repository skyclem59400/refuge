import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { Package, PawPrint, MapPin } from 'lucide-react'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { listBoxZones } from '@/lib/actions/box-zones'
import { getBoxById } from '@/lib/actions/boxes'
import { AnimalStatusBadge, SpeciesBadge } from '@/components/animals/animal-status-badge'
import { BoxActionsBar } from '@/components/boxes/box-actions-bar'
import { BackToBoxes } from '@/components/boxes/back-to-boxes'
import { getSexIcon, calculateAge } from '@/lib/sda-utils'
import { getSpeciesEmoji, SPECIES_LABELS_PLURAL } from '@/lib/species'
import { getZoneColor } from '@/lib/zone-colors'
import type { AnimalSpecies, AnimalStatus } from '@/lib/types/database'
import type { EnrichedBox } from '@/components/boxes/types'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function BoxDetailPage({ params }: PageProps) {
  const { id } = await params
  const ctx = await getEstablishmentContext()
  if (!ctx) throw new Error('Establishment context required')

  // Une seule query pour CE box + ses animaux. listBoxZones est nécessaire
  // pour le composant EditBoxDrawer (sélecteur de zone).
  const [boxResult, { data: allZones }] = await Promise.all([
    getBoxById(id),
    listBoxZones(),
  ])

  if (boxResult.error) throw new Error(boxResult.error)
  if (!boxResult.data) notFound()

  const box = boxResult.data as EnrichedBox

  const zones = allZones ?? []
  const zone = box.zone_id ? zones.find((z) => z.id === box.zone_id) ?? null : null
  const parentZone = zone?.parent_id ? zones.find((z) => z.id === zone.parent_id) ?? null : null

  // Couleur calée sur la zone racine pour cohérence visuelle avec /boxes
  const colorZoneId = parentZone?.id ?? zone?.id ?? box.id
  const color = getZoneColor(colorZoneId)

  const remainingCapacity = Math.max(0, box.capacity - box.animal_count)

  const speciesLabel =
    box.species_type === 'mixed'
      ? 'Mixte'
      : box.species_type === 'farm'
        ? 'Ferme'
        : box.species_type === 'other'
          ? 'Autres'
          : SPECIES_LABELS_PLURAL[box.species_type as AnimalSpecies] || box.species_type

  // Tri intelligent : noms numériques d'abord en ordre numérique, sinon alpha
  const animals = [...box.animals].sort((a, b) => {
    const na = Number(a.name)
    const nb = Number(b.name)
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb
    if (!Number.isNaN(na)) return -1
    if (!Number.isNaN(nb)) return 1
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="animate-fade-up space-y-6">
      {/* Retour (router.back si on vient de /boxes, navigation directe sinon) */}
      <BackToBoxes />


      {/* En-tête */}
      <header
        className={`relative rounded-2xl border ${color.borderSoft} ${color.bg} px-6 py-5 overflow-hidden shadow-lg`}
      >
        <div
          className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-white/10 blur-3xl pointer-events-none"
          aria-hidden
        />
        <div className="relative flex items-start gap-4 flex-wrap">
          <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-white/20 backdrop-blur-sm shrink-0 shadow-lg">
            <Package className={`w-5 h-5 ${color.textOn}`} />
          </span>
          <div className="flex-1 min-w-0">
            <div className={`text-[10px] uppercase tracking-[0.2em] font-bold opacity-75 ${color.textOn} mb-0.5`}>
              Box
            </div>
            <h1 className={`font-bold text-2xl leading-tight ${color.textOn}`}>{box.name}</h1>
            {(zone || parentZone) && (
              <div className={`flex items-center gap-1 text-xs ${color.textOn} opacity-80 mt-1`}>
                <MapPin className="w-3 h-3" />
                {parentZone ? `${parentZone.name} › ${zone?.name}` : zone?.name}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm text-xs font-bold ${color.textOn}`}>
                {box.animal_count}/{box.capacity}
              </span>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm text-xs font-bold ${color.textOn}`}>
                <PawPrint className="w-3 h-3" />
                {speciesLabel}
              </span>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-[11px] font-semibold ${color.textOn}`}>
                {box.status === 'available' ? 'Disponible' : box.status}
              </span>
            </div>
          </div>
          <div className="relative">
            <BoxActionsBar
              box={box}
              color={color}
              canManage={ctx.permissions.canManageBoxes}
              zones={zones}
              remainingCapacity={remainingCapacity}
            />
          </div>
        </div>
      </header>

      {/* Grille d'animaux */}
      {animals.length === 0 ? (
        <div className="bg-surface rounded-xl border border-border p-10 text-center">
          <PawPrint className="w-10 h-10 text-muted mx-auto mb-3" />
          <p className="text-muted text-sm">Aucun animal dans ce box pour le moment.</p>
          {ctx.permissions.canManageBoxes && remainingCapacity > 0 && (
            <p className="text-xs text-muted mt-2">
              Clique sur &laquo; Assigner &raquo; ci-dessus pour ajouter des animaux.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {animals.map((a) => (
            <Link
              key={a.id}
              href={`/animals/${a.id}`}
              className="group bg-surface border border-border rounded-xl overflow-hidden hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all"
            >
              <div className="relative aspect-square bg-surface-dark">
                {a.photo_url ? (
                  <Image
                    src={a.photo_url}
                    alt={a.name}
                    fill
                    unoptimized={a.photo_url.includes('hunimalis.com')}
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 768px) 50vw, (max-width: 1280px) 25vw, 16vw"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-5xl">
                    {getSpeciesEmoji(a.species as AnimalSpecies)}
                  </div>
                )}
                {a.status && (
                  <div className="absolute top-2 right-2">
                    <AnimalStatusBadge status={a.status as AnimalStatus} overlay />
                  </div>
                )}
              </div>
              <div className="p-2.5">
                <div className="flex items-center gap-1 mb-1">
                  <h3 className="font-semibold text-sm truncate">{a.name}</h3>
                  <span className="text-muted text-xs shrink-0">
                    {getSexIcon((a.sex ?? 'unknown') as 'male' | 'female' | 'unknown')}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <SpeciesBadge species={a.species as AnimalSpecies} />
                </div>
                <div className="text-[11px] text-muted">{calculateAge(a.birth_date ?? null)}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
