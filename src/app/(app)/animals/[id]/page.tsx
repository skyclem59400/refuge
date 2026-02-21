import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { AnimalDetailTabs } from '@/components/animals/animal-detail-tabs'
import { AnimalStatusBadge, SpeciesBadge } from '@/components/animals/animal-status-badge'
import { getSexIcon, calculateAge, getOriginLabel } from '@/lib/sda-utils'
import type { Animal, AnimalPhoto, AnimalMovement, AnimalHealthRecord, Box, SocialPost, IcadDeclaration } from '@/lib/types/database'
import { ArrowLeft } from 'lucide-react'

export default async function AnimalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getEstablishmentContext()
  const estabId = ctx!.establishment.id
  const admin = createAdminClient()

  const [
    { data: animal },
    { data: photos },
    { data: movements },
    { data: healthRecords },
    { data: boxes },
    { data: socialPosts },
    { data: icadDeclarations },
  ] = await Promise.all([
    admin.from('animals').select('*').eq('id', id).eq('establishment_id', estabId).single(),
    admin.from('animal_photos').select('*').eq('animal_id', id).order('is_primary', { ascending: false }),
    admin.from('animal_movements').select('*').eq('animal_id', id).order('date', { ascending: false }),
    admin.from('animal_health_records').select('*').eq('animal_id', id).order('date', { ascending: false }),
    admin.from('boxes').select('*').eq('establishment_id', estabId).order('name'),
    admin.from('social_posts').select('*').eq('animal_id', id).order('created_at', { ascending: false }),
    admin.from('icad_declarations').select('*').eq('animal_id', id).order('created_at', { ascending: false }),
  ])

  if (!animal) notFound()

  const typedAnimal = animal as Animal
  const typedPhotos = (photos as AnimalPhoto[]) || []
  const typedMovements = (movements as AnimalMovement[]) || []
  const typedHealth = (healthRecords as AnimalHealthRecord[]) || []
  const typedBoxes = (boxes as Box[]) || []
  const typedPosts = (socialPosts as SocialPost[]) || []
  const typedIcad = (icadDeclarations as IcadDeclaration[]) || []

  const canManageAnimals = ctx!.permissions.canManageAnimals
  const canManageHealth = ctx!.permissions.canManageHealth
  const canManageMovements = ctx!.permissions.canManageMovements
  const canManagePosts = ctx!.permissions.canManagePosts

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/animals" className="text-muted hover:text-text transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">
              {typedAnimal.name}
              <span className="ml-2 text-muted text-xl">{getSexIcon(typedAnimal.sex)}</span>
            </h1>
            <AnimalStatusBadge status={typedAnimal.status} />
            <SpeciesBadge species={typedAnimal.species} />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted mt-1 flex-wrap">
            {typedAnimal.breed && <span>{typedAnimal.breed}{typedAnimal.breed_cross ? ` x ${typedAnimal.breed_cross}` : ''}</span>}
            {typedAnimal.breed && <span>-</span>}
            <span>{calculateAge(typedAnimal.birth_date)}</span>
            <span>-</span>
            <span>{getOriginLabel(typedAnimal.origin_type)}</span>
          </div>
        </div>
      </div>

      {/* Tabbed content */}
      <AnimalDetailTabs
        animal={typedAnimal}
        photos={typedPhotos}
        movements={typedMovements}
        healthRecords={typedHealth}
        socialPosts={typedPosts}
        icadDeclarations={typedIcad}
        boxes={typedBoxes}
        canManageAnimals={canManageAnimals}
        canManageHealth={canManageHealth}
        canManageMovements={canManageMovements}
        canManagePosts={canManagePosts}
      />
    </div>
  )
}
