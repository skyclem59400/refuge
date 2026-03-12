import { Suspense } from 'react'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { getAssignments } from '@/lib/actions/outings'
import { getTodayTreatments } from '@/lib/actions/treatments'
import { WelcomeBanner } from '@/components/dashboard/welcome-banner'
import { ShelterDashboard } from '@/components/dashboard/shelter-dashboard'
import { Skeleton } from '@/components/ui/skeleton'
import type { Animal, AnimalPhoto } from '@/lib/types/database'

type AnimalWithPhotos = Animal & { animal_photos: AnimalPhoto[] }
type SupabaseAdmin = ReturnType<typeof createAdminClient>

interface ShelterData {
  stats: { poundCount: number; shelterCount: number; fosterCount: number; adoptionsThisMonth: number; restitutionsThisMonth: number }
  poundAnimals: AnimalWithPhotos[]
  shelterAnimals: AnimalWithPhotos[]
  healthAlerts: { animal_name: string; animal_id: string; description: string; next_due_date: string }[]
}

const EMPTY_SHELTER_DATA: ShelterData = {
  stats: { poundCount: 0, shelterCount: 0, fosterCount: 0, adoptionsThisMonth: 0, restitutionsThisMonth: 0 },
  poundAnimals: [],
  shelterAnimals: [],
  healthAlerts: [],
}

async function fetchShelterData(admin: SupabaseAdmin, estabId: string): Promise<ShelterData> {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [
    { count: poundCount },
    { count: shelterCount },
    { count: fosterCount },
    { count: adoptionsThisMonth },
    { count: restitutionsThisMonth },
    { data: rawPoundAnimals },
    { data: rawShelterAnimals },
    { data: rawHealthAlerts },
  ] = await Promise.all([
    admin.from('animals').select('*', { count: 'exact', head: true }).eq('establishment_id', estabId).eq('status', 'pound'),
    admin.from('animals').select('*', { count: 'exact', head: true }).eq('establishment_id', estabId).eq('status', 'shelter'),
    admin.from('animals').select('*', { count: 'exact', head: true }).eq('establishment_id', estabId).eq('status', 'foster_family'),
    admin.from('animal_movements').select('*', { count: 'exact', head: true }).eq('type', 'adoption').gte('date', startOfMonth),
    admin.from('animal_movements').select('*', { count: 'exact', head: true }).eq('type', 'return_to_owner').gte('date', startOfMonth),
    admin.from('animals').select('*, animal_photos(id, url, is_primary)').eq('establishment_id', estabId).eq('status', 'pound').order('pound_entry_date', { ascending: true }),
    admin.from('animals').select('*, animal_photos(id, url, is_primary)').eq('establishment_id', estabId).eq('status', 'shelter').order('shelter_entry_date', { ascending: false }),
    admin.from('animal_health_records').select('*, animals!inner(name, id)').eq('animals.establishment_id', estabId).not('next_due_date', 'is', null).lte('next_due_date', sevenDaysFromNow).order('next_due_date', { ascending: true }).limit(10),
  ])

  const healthAlerts = (rawHealthAlerts || []).map((r: Record<string, unknown>) => {
    const animal = r.animals as { name: string; id: string } | null
    return {
      animal_name: animal?.name || 'Inconnu',
      animal_id: animal?.id || '',
      description: (r.description as string) || '',
      next_due_date: (r.next_due_date as string) || '',
    }
  })

  return {
    stats: {
      poundCount: poundCount || 0,
      shelterCount: shelterCount || 0,
      fosterCount: fosterCount || 0,
      adoptionsThisMonth: adoptionsThisMonth || 0,
      restitutionsThisMonth: restitutionsThisMonth || 0,
    },
    poundAnimals: (rawPoundAnimals as AnimalWithPhotos[]) || [],
    shelterAnimals: (rawShelterAnimals as AnimalWithPhotos[]) || [],
    healthAlerts,
  }
}

async function resolveUserNames(
  admin: SupabaseAdmin,
  userIds: string[]
): Promise<Record<string, string>> {
  const names: Record<string, string> = {}
  if (userIds.length === 0) return names

  const { data: usersInfo } = await admin.rpc('get_users_info', { user_ids: userIds })
  if (usersInfo && Array.isArray(usersInfo)) {
    for (const u of usersInfo) {
      names[u.id] = u.full_name || u.email || u.id
    }
  }
  return names
}

type AssignmentAnimal = { id: string; name: string; species: string; photo_url: string | null; done: boolean }
type DailyAssignment = { assignedTo: string; assignedToName: string; animals: AssignmentAnimal[] }

async function fetchDailyAssignments(admin: SupabaseAdmin): Promise<DailyAssignment[]> {
  const assignResult = await getAssignments()
  const rawAssignments = assignResult.data || []
  if (rawAssignments.length === 0) return []

  const assignUserIds = [...new Set(rawAssignments.map((a: { assigned_to: string }) => a.assigned_to))]
  const assignUserNames = await resolveUserNames(admin, assignUserIds)

  const grouped = new Map<string, AssignmentAnimal[]>()
  for (const a of rawAssignments) {
    const assignment = a as { assigned_to: string; outing_id: string | null; animals: { id: string; name: string; species: string; photo_url: string | null } }
    const animal = Array.isArray(assignment.animals) ? assignment.animals[0] : assignment.animals
    if (!grouped.has(assignment.assigned_to)) {
      grouped.set(assignment.assigned_to, [])
    }
    grouped.get(assignment.assigned_to)!.push({
      id: animal.id,
      name: animal.name,
      species: animal.species,
      photo_url: animal.photo_url,
      done: !!assignment.outing_id,
    })
  }

  return Array.from(grouped.entries()).map(([userId, animals]) => ({
    assignedTo: userId,
    assignedToName: assignUserNames[userId] || 'Inconnu',
    animals,
  }))
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const ctx = await getEstablishmentContext()
  const estabId = ctx!.establishment.id
  const estabType = ctx!.establishment.type
  const admin = createAdminClient()

  const showShelter = estabType === 'shelter' || estabType === 'both'
  const showFarm = estabType === 'farm' || estabType === 'both'

  return (
    <div className="animate-fade-up">
      <WelcomeBanner userEmail={user?.email || 'Utilisateur'} />

      {/* Shelter dashboard — streamed via Suspense */}
      {showShelter && (
        <div className={showFarm ? 'mb-8' : ''}>
          {showFarm && (
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-6 rounded-full bg-primary" />
              <h2 className="text-lg font-bold text-text">Refuge / Fourriere</h2>
            </div>
          )}
          <Suspense fallback={<DashboardSkeleton />}>
            <ShelterDashboardAsync estabId={estabId} />
          </Suspense>
        </div>
      )}
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-surface rounded-xl border border-border p-4">
            <Skeleton className="h-4 w-12 mx-auto mb-2" />
            <Skeleton className="h-8 w-16 mx-auto mb-1" />
            <Skeleton className="h-3 w-20 mx-auto" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface rounded-xl border border-border p-4 space-y-3">
          <Skeleton className="h-5 w-32" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-full" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
        <div className="bg-surface rounded-xl border border-border p-4 space-y-3">
          <Skeleton className="h-5 w-32" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-full" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

async function ShelterDashboardAsync({ estabId }: { estabId: string }) {
  const admin = createAdminClient()

  // Parallel fetch instead of sequential
  const [shelterData, dailyAssignments, treatmentsResult] = await Promise.all([
    fetchShelterData(admin, estabId),
    fetchDailyAssignments(admin),
    getTodayTreatments(),
  ])

  const todayTreatments = treatmentsResult.data || []

  // Resolve user names for treatment administrations
  const treatmentUserIds = new Set<string>()
  for (const t of todayTreatments) {
    for (const a of t.administrations_today || []) {
      treatmentUserIds.add(a.administered_by)
    }
  }
  const treatmentUserNames = await resolveUserNames(admin, [...treatmentUserIds])

  return (
    <ShelterDashboard
      stats={shelterData.stats}
      poundAnimals={shelterData.poundAnimals}
      shelterAnimals={shelterData.shelterAnimals}
      healthAlerts={shelterData.healthAlerts}
      dailyAssignments={dailyAssignments}
      todayTreatments={todayTreatments}
      treatmentUserNames={treatmentUserNames}
    />
  )
}
