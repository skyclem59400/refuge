import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { ArrowLeft, MapPin, Package, PawPrint } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/server'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { listBoxZones } from '@/lib/actions/box-zones'
import { getBoxes } from '@/lib/actions/boxes'
import { AnimalStatusBadge, SpeciesBadge } from '@/components/animals/animal-status-badge'
import { getSexIcon, calculateAge } from '@/lib/sda-utils'
import { getSpeciesEmoji } from '@/lib/species'
import { getZoneColor } from '@/lib/zone-colors'
import type { AnimalSpecies, AnimalStatus } from '@/lib/types/database'
import type { EnrichedBox, BoxAnimal } from '@/components/boxes/types'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

type AnimalWithLocation = BoxAnimal & { box_name: string }

export default async function ZoneAnimalsPage({ params }: PageProps) {
  const { id } = await params
  const ctx = await getEstablishmentContext()
  if (!ctx) throw new Error('Establishment context required')

  const admin = createAdminClient()

  // 1. Charger la zone racine
  const { data: zone, error: zoneErr } = await admin
    .from('box_zones')
    .select('id, name, parent_id, description, sort_order')
    .eq('id', id)
    .eq('establishment_id', ctx.establishment.id)
    .single()

  if (zoneErr || !zone) notFound()

  // On affiche uniquement les zones racines ici (la vue agrège les sous-zones)
  // Si on tombe sur une sous-zone, on redirige vers sa racine
  if (zone.parent_id) {
    notFound()
  }

  // 2. Charger toutes les zones + boxes (pour reconstruire l'arbo)
  const [{ data: allZones }, { data: rawBoxes }] = await Promise.all([
    listBoxZones(),
    getBoxes(),
  ])

  const zonesById = new Map((allZones ?? []).map((z) => [z.id, z]))
  const subzones = (allZones ?? []).filter((z) => z.parent_id === zone.id)
  const allZoneIds = new Set<string>([zone.id, ...subzones.map((z) => z.id)])

  // 3. Filtrer les boxes appartenant à la zone racine ou à ses sous-zones
  const boxes = (rawBoxes as EnrichedBox[] | undefined) ?? []
  const boxesInZone = boxes.filter((b) => b.zone_id && allZoneIds.has(b.zone_id))

  // 4. Agréger les animaux avec le nom de leur box d'origine
  const animals: AnimalWithLocation[] = []
  for (const box of boxesInZone) {
    for (const animal of box.animals) {
      animals.push({ ...animal, box_name: box.name })
    }
  }

  // Tri stable : par nom (numérique d'abord pour les chevreaux numérotés)
  animals.sort((a, b) => {
    const na = Number(a.name)
    const nb = Number(b.name)
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb
    if (!Number.isNaN(na)) return -1
    if (!Number.isNaN(nb)) return 1
    return a.name.localeCompare(b.name)
  })

  const color = getZoneColor(zone.id)
  const nbBoxes = boxesInZone.length

  return (
    <div className="animate-fade-up space-y-6">
      {/* Retour */}
      <Link
        href="/boxes"
        className="inline-flex items-center gap-2 text-sm text-muted hover:text-text transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour aux zones
      </Link>

      {/* En-tête */}
      <header
        className={`relative rounded-2xl border ${color.borderSoft} ${color.bg} px-6 py-5 overflow-hidden shadow-lg`}
      >
        <div
          className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-white/10 blur-3xl pointer-events-none"
          aria-hidden
        />
        <div className="relative flex items-center gap-4">
          <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-white/20 backdrop-blur-sm shrink-0 shadow-lg">
            <MapPin className={`w-5 h-5 ${color.textOn}`} />
          </span>
          <div className="flex-1 min-w-0">
            <div className={`text-[10px] uppercase tracking-[0.2em] font-bold opacity-75 ${color.textOn} mb-0.5`}>
              Zone
            </div>
            <h1 className={`font-bold text-2xl leading-tight ${color.textOn}`}>{zone.name}</h1>
            {zone.description && (
              <p className={`text-xs ${color.textOn} opacity-80 mt-1`}>{zone.description}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm text-xs font-bold ${color.textOn} shadow-md`}>
              <Package className="w-3 h-3" />
              {nbBoxes} box{nbBoxes !== 1 ? 's' : ''}
            </span>
            <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm text-xs font-bold ${color.textOn} shadow-md`}>
              <PawPrint className="w-3 h-3" />
              {animals.length} animal{animals.length !== 1 ? 'x' : ''}
            </span>
          </div>
        </div>
      </header>

      {/* Grille d'animaux */}
      {animals.length === 0 ? (
        <div className="bg-surface rounded-xl border border-border p-10 text-center">
          <PawPrint className="w-10 h-10 text-muted mx-auto mb-3" />
          <p className="text-muted text-sm">Aucun animal affecté dans cette zone pour l&apos;instant.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {animals.map((a) => {
            // Plusieurs boxes : on affiche le nom du box ; un seul box : on masque (info redondante)
            const showBox = nbBoxes > 1
            return (
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
                    <span className="text-muted text-xs shrink-0">{getSexIcon((a.sex ?? 'unknown') as 'male' | 'female' | 'unknown')}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <SpeciesBadge species={a.species as AnimalSpecies} />
                  </div>
                  <div className="text-[11px] text-muted">{calculateAge(a.birth_date ?? null)}</div>
                  {showBox && (
                    <div className="text-[10px] text-muted mt-1 truncate" title={`Box : ${a.box_name}`}>
                      📦 {a.box_name}
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Hint si plusieurs sous-zones */}
      {subzones.length > 0 && zonesById.size > 0 && (
        <p className="text-xs text-muted italic">
          Cette vue cumule les animaux de {subzones.length} sous-zone{subzones.length !== 1 ? 's' : ''} :{' '}
          {subzones.map((z) => z.name).join(', ')}.
        </p>
      )}
    </div>
  )
}
