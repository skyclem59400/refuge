import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { getAssignments } from '@/lib/actions/outings'
import { WelcomeBanner } from '@/components/dashboard/welcome-banner'
import { ShelterDashboard } from '@/components/dashboard/shelter-dashboard'
import type { Animal, AnimalPhoto } from '@/lib/types/database'

type AnimalWithPhotos = Animal & { animal_photos: AnimalPhoto[] }

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const ctx = await getEstablishmentContext()
  const estabId = ctx!.establishment.id
  const estabType = ctx!.establishment.type
  const admin = createAdminClient()

  const showShelter = estabType === 'shelter' || estabType === 'both'
  const showFarm = estabType === 'farm' || estabType === 'both'

  // ---------------------------------------------------------------
  // Shelter queries (only when relevant)
  // ---------------------------------------------------------------
  let shelterStats = { poundCount: 0, shelterCount: 0, fosterCount: 0, adoptionsThisMonth: 0, restitutionsThisMonth: 0 }
  let poundAnimals: AnimalWithPhotos[] = []
  let shelterAnimals: AnimalWithPhotos[] = []
  let healthAlerts: { animal_name: string; animal_id: string; description: string; next_due_date: string }[] = []

  if (showShelter) {
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

    shelterStats = {
      poundCount: poundCount || 0,
      shelterCount: shelterCount || 0,
      fosterCount: fosterCount || 0,
      adoptionsThisMonth: adoptionsThisMonth || 0,
      restitutionsThisMonth: restitutionsThisMonth || 0,
    }
    poundAnimals = (rawPoundAnimals as AnimalWithPhotos[]) || []
    shelterAnimals = (rawShelterAnimals as AnimalWithPhotos[]) || []

    // Map health alerts: the joined `animals` relation provides name + id
    healthAlerts = (rawHealthAlerts || []).map((r: Record<string, unknown>) => {
      const animal = r.animals as { name: string; id: string } | null
      return {
        animal_name: animal?.name || 'Inconnu',
        animal_id: animal?.id || '',
        description: (r.description as string) || '',
        next_due_date: (r.next_due_date as string) || '',
      }
    })
  }

  // ---------------------------------------------------------------
  // Today's outing assignments (shelter only)
  // ---------------------------------------------------------------
  let dailyAssignments: { assignedTo: string; assignedToName: string; animals: { id: string; name: string; species: string; photo_url: string | null; done: boolean }[] }[] = []

  if (showShelter) {
    const assignResult = await getAssignments()
    const rawAssignments = assignResult.data || []

    if (rawAssignments.length > 0) {
      // Resolve user names for assigned_to
      const assignUserIds = [...new Set(rawAssignments.map((a: { assigned_to: string }) => a.assigned_to))]
      const assignUserNames: Record<string, string> = {}

      if (assignUserIds.length > 0) {
        const { data: usersInfo } = await admin.rpc('get_users_info', { user_ids: assignUserIds })
        if (usersInfo && Array.isArray(usersInfo)) {
          for (const u of usersInfo) {
            assignUserNames[u.id] = u.full_name || u.email || u.id
          }
        }
      }

      // Group by assigned_to
      const grouped = new Map<string, { id: string; name: string; species: string; photo_url: string | null; done: boolean }[]>()
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

      dailyAssignments = Array.from(grouped.entries()).map(([userId, animals]) => ({
        assignedTo: userId,
        assignedToName: assignUserNames[userId] || 'Inconnu',
        animals,
      }))
    }
  }

  // ---------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------
  return (
    <div className="animate-fade-up">
      <WelcomeBanner userEmail={user?.email || 'Utilisateur'} />

      {/* Shelter dashboard */}
      {showShelter && (
        <div className={showFarm ? 'mb-8' : ''}>
          {showFarm && (
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-6 rounded-full bg-primary" />
              <h2 className="text-lg font-bold text-text">Refuge / Fourriere</h2>
            </div>
          )}
          <ShelterDashboard
            stats={shelterStats}
            poundAnimals={poundAnimals}
            shelterAnimals={shelterAnimals}
            healthAlerts={healthAlerts}
            dailyAssignments={dailyAssignments}
          />
        </div>
      )}
    </div>
  )
}
