import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { AnimalDetailTabs } from '@/components/animals/animal-detail-tabs'
import { AnimalStatusBadge, SpeciesBadge } from '@/components/animals/animal-status-badge'
import { AnimalStatusChanger } from '@/components/animals/animal-status-changer'
import { getSexIcon, calculateAge, getOriginLabel } from '@/lib/sda-utils'
import type { Animal, AnimalPhoto, AnimalMovement, AnimalHealthRecord, AnimalTreatment, Box, SocialPost, IcadDeclaration, ActivityLog } from '@/lib/types/database'
import { getTreatments } from '@/lib/actions/treatments'
import { getHealthProtocols } from '@/lib/actions/health-protocols'
import { getActivityLogs } from '@/lib/actions/activity-log'
import { getOutings } from '@/lib/actions/outings'
import { ArrowLeft } from 'lucide-react'

type SupabaseAdmin = ReturnType<typeof createAdminClient>

async function resolveUserNames(
  admin: SupabaseAdmin,
  userIds: string[],
  existing: Record<string, string> = {}
): Promise<Record<string, string>> {
  const names = { ...existing }
  const newIds = userIds.filter((uid) => !names[uid])
  const uniqueIds = [...new Set(newIds)]
  if (uniqueIds.length === 0) return names

  const { data: usersInfo } = await admin.rpc('get_users_info', { user_ids: uniqueIds })
  if (usersInfo && Array.isArray(usersInfo)) {
    for (const u of usersInfo) {
      names[u.id] = u.full_name || u.email || u.id
    }
  }
  return names
}

async function fetchAnimalData(admin: SupabaseAdmin, id: string, estabId: string) {
  const [
    { data: animal },
    { data: photos },
    { data: movements },
    { data: healthRecords },
    { data: boxes },
    { data: socialPosts },
    { data: icadDeclarations },
    { data: fosterContracts },
  ] = await Promise.all([
    admin.from('animals').select('*').eq('id', id).eq('establishment_id', estabId).single(),
    admin.from('animal_photos').select('*').eq('animal_id', id).order('is_primary', { ascending: false }),
    admin.from('animal_movements').select('*').eq('animal_id', id).order('date', { ascending: false }),
    admin.from('animal_health_records').select('*').eq('animal_id', id).order('date', { ascending: false }),
    admin.from('boxes').select('*').eq('establishment_id', estabId).order('name'),
    admin.from('social_posts').select('*').eq('animal_id', id).order('created_at', { ascending: false }),
    admin.from('icad_declarations').select('*').eq('animal_id', id).order('created_at', { ascending: false }),
    admin
      .from('foster_contracts')
      .select('*, foster:clients!foster_client_id(id, name, email, phone, city)')
      .eq('animal_id', id)
      .eq('establishment_id', estabId)
      .order('start_date', { ascending: false }),
  ])

  return {
    animal: animal as Animal | null,
    photos: (photos as AnimalPhoto[]) || [],
    movements: (movements as AnimalMovement[]) || [],
    healthRecords: (healthRecords as AnimalHealthRecord[]) || [],
    boxes: (boxes as Box[]) || [],
    socialPosts: (socialPosts as SocialPost[]) || [],
    icadDeclarations: (icadDeclarations as IcadDeclaration[]) || [],
    fosterContracts: fosterContracts || [],
  }
}

async function fetchActivityLogsDeduped(id: string): Promise<ActivityLog[]> {
  const [logsResult, directLogsResult] = await Promise.all([
    getActivityLogs({ parentType: 'animal', parentId: id, limit: 50 }),
    getActivityLogs({ entityType: 'animal', entityId: id, limit: 50 }),
  ])
  const allLogs = [...(logsResult.data || []), ...(directLogsResult.data || [])]
  const logMap = new Map(allLogs.map((l) => [l.id, l]))
  return Array.from(logMap.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
}

export default async function AnimalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getEstablishmentContext()
  const estabId = ctx!.establishment.id
  const admin = createAdminClient()

  const data = await fetchAnimalData(admin, id, estabId)
  if (!data.animal) notFound()

  const [outingsResult, treatmentsResult, protocolsResult] = await Promise.all([
    getOutings({ animalId: id, limit: 100 }),
    getTreatments({ animalId: id }),
    getHealthProtocols({ activeOnly: true, species: data.animal.species }),
  ])
  const outings = outingsResult.data || []
  const treatments = (treatmentsResult.data || []) as AnimalTreatment[]
  const healthProtocols = protocolsResult.data || []

  // Collect user IDs from movements, health records, and outings
  const allCreatedByIds = [
    ...data.movements.map((m) => m.created_by),
    ...data.healthRecords.map((h) => h.created_by),
    ...outings.map((o: { walked_by: string }) => o.walked_by),
  ].filter((uid): uid is string => !!uid)

  let userNames = await resolveUserNames(admin, allCreatedByIds)

  const { canManageAnimals, canManageHealth, canManageMovements, canManagePosts, isAdmin } = ctx!.permissions

  // Fetch activity logs for admin only
  let activityLogs: ActivityLog[] = []
  if (isAdmin) {
    activityLogs = await fetchActivityLogsDeduped(id)
    const logUserIds = activityLogs.map((l) => l.user_id)
    userNames = await resolveUserNames(admin, logUserIds, userNames)
  }

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
              {data.animal.name}
              <span className="ml-2 text-muted text-xl">{getSexIcon(data.animal.sex)}</span>
            </h1>
            <AnimalStatusBadge status={data.animal.status} />
            <SpeciesBadge species={data.animal.species} />
            {data.animal.judicial_procedure && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-error/15 text-error border border-error/30"
                title={`Procédure judiciaire${data.animal.judicial_case_number ? ` - Dossier ${data.animal.judicial_case_number}` : ''}`}
              >
                ⚖️ EN PROCÉDURE
              </span>
            )}
            {canManageMovements && (
              <AnimalStatusChanger
                animalId={data.animal.id}
                animalName={data.animal.name}
                currentStatus={data.animal.status}
                establishmentId={estabId}
              />
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted mt-1 flex-wrap">
            {data.animal.breed && <span>{data.animal.breed}{data.animal.breed_cross ? ` x ${data.animal.breed_cross}` : ''}</span>}
            {data.animal.breed && <span>-</span>}
            <span>{calculateAge(data.animal.birth_date)}</span>
            <span>-</span>
            <span>{getOriginLabel(data.animal.origin_type)}</span>
          </div>
        </div>
      </div>

      {/* Tabbed content */}
      <AnimalDetailTabs
        animal={data.animal}
        photos={data.photos}
        movements={data.movements}
        healthRecords={data.healthRecords}
        treatments={treatments}
        outings={outings}
        socialPosts={data.socialPosts}
        icadDeclarations={data.icadDeclarations}
        fosterContracts={data.fosterContracts}
        healthProtocols={healthProtocols}
        boxes={data.boxes}
        userNames={userNames}
        establishmentName={ctx!.establishment.name}
        establishmentPhone={ctx!.establishment.phone}
        canManageAnimals={canManageAnimals}
        canManageHealth={canManageHealth}
        canManageMovements={canManageMovements}
        canManagePosts={canManagePosts}
        isAdmin={isAdmin}
        activityLogs={activityLogs}
      />
    </div>
  )
}
