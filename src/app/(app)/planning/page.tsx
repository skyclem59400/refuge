import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CalendarDays, Info, Heart, Stethoscope, Calendar, Grid } from 'lucide-react'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { getEstablishmentMembers } from '@/lib/actions/establishments'
import { createAdminClient } from '@/lib/supabase/server'
import { getSchedule } from '@/lib/actions/schedule'
import { getAppointments } from '@/lib/actions/appointments'
import { ScheduleForm } from '@/components/schedule/schedule-form'
import { AppointmentForm } from '@/components/appointments/appointment-form'
import { ScheduleView } from '@/components/schedule/schedule-view'
import { TimelineCalendarView } from '@/components/schedule/timeline-calendar-view'

type SupabaseAdmin = ReturnType<typeof createAdminClient>

function buildDateRange() {
  const sixtyDaysAgo = new Date()
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)
  const sixtyDaysFromNow = new Date()
  sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60)
  return {
    dateFrom: sixtyDaysAgo.toISOString().split('T')[0],
    dateTo: sixtyDaysFromNow.toISOString().split('T')[0],
  }
}

interface PlanningData {
  schedules: Awaited<ReturnType<typeof getSchedule>>['data'] & unknown[]
  appointments: Awaited<ReturnType<typeof getAppointments>>['data'] & unknown[]
  members: { user_id: string; full_name?: string | null; pseudo: string | null; email?: string }[]
}

async function fetchPlanningData(): Promise<PlanningData> {
  const { dateFrom, dateTo } = buildDateRange()

  const [scheduleResult, appointmentsResult, membersResult] = await Promise.all([
    getSchedule({ dateFrom, dateTo }),
    getAppointments({ dateFrom, dateTo }),
    getEstablishmentMembers(),
  ])

  return {
    schedules: scheduleResult.data || [],
    appointments: appointmentsResult.data || [],
    members: (membersResult.data || []) as PlanningData['members'],
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

function buildAnimalMaps(allAnimals: { id: string; nom: string }[] | null) {
  const animals = allAnimals || []
  const animalsForForm = animals.map((a) => ({ id: a.id, nom: a.nom }))
  const animalNames: Record<string, string> = {}
  for (const animal of animals) {
    animalNames[animal.id] = animal.nom
  }
  return { animalsForForm, animalNames }
}

export default async function PlanningPage(props: Readonly<{ searchParams: Promise<{ view?: string }> }>) {
  const searchParams = await props.searchParams
  const ctx = await getEstablishmentContext()
  if (!ctx) redirect('/login')

  if (!ctx.permissions.canManagePlanning) {
    redirect('/dashboard')
  }

  const { schedules, appointments, members } = await fetchPlanningData()

  // Resolve user names
  const allUserIds = [
    ...new Set([
      ...schedules.map((s) => s.user_id),
      ...schedules.map((s) => s.created_by),
      ...appointments.map((a) => a.created_by),
      ...members.map((m) => m.user_id),
    ]),
  ]

  const admin = createAdminClient()
  const userNames = await resolveUserNames(admin, allUserIds)

  // Fetch animals for appointment linking and form
  const { data: allAnimals } = await admin
    .from('animals')
    .select('id, nom')
    .eq('establishment_id', ctx.establishment.id)
    .order('nom')

  const { animalsForForm, animalNames } = buildAnimalMaps(allAnimals)

  const viewMode = (searchParams.view === 'cards' ? 'cards' : 'timeline') as 'cards' | 'timeline'

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <CalendarDays className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Planning</h1>
            <p className="text-sm text-muted mt-1">Horaires du personnel & rendez-vous</p>
          </div>
        </div>
      </div>

      {/* Explanatory note */}
      <div className="flex gap-3 p-4 mb-6 bg-info/5 border border-info/20 rounded-xl">
        <Info className="w-5 h-5 text-info shrink-0 mt-0.5" />
        <div className="text-sm text-muted">
          <p className="font-medium text-text mb-1">Planning unifie</p>
          <p>
            Gerez les horaires de presence du personnel et les rendez-vous (adoptions, veterinaire) dans un seul calendrier.
            Filtrez par collaborateur, dupliquez une semaine facilement.
          </p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
        <div className="bg-surface rounded-xl border border-border p-4 text-center">
          <CalendarDays className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="text-2xl font-bold">{schedules.length}</p>
          <p className="text-xs text-muted mt-1">Planifications</p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4 text-center">
          <Heart className="w-5 h-5 text-green-600 mx-auto mb-1" />
          <p className="text-2xl font-bold">
            {appointments.filter((a) => a.type === 'adoption').length}
          </p>
          <p className="text-xs text-muted mt-1">Adoptions</p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4 text-center">
          <Stethoscope className="w-5 h-5 text-orange-600 mx-auto mb-1" />
          <p className="text-2xl font-bold">
            {appointments.filter((a) => a.type === 'veterinary').length}
          </p>
          <p className="text-xs text-muted mt-1">Veterinaire</p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4 text-center">
          <CalendarDays className="w-5 h-5 text-success mx-auto mb-1" />
          <p className="text-2xl font-bold">
            {schedules.filter((s) => new Date(s.date) >= new Date()).length +
             appointments.filter((a) => new Date(a.date) >= new Date()).length}
          </p>
          <p className="text-xs text-muted mt-1">A venir</p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4 text-center">
          <CalendarDays className="w-5 h-5 text-info mx-auto mb-1" />
          <p className="text-2xl font-bold">
            {new Set(schedules.map((s) => s.user_id)).size}
          </p>
          <p className="text-xs text-muted mt-1">Personnes</p>
        </div>
      </div>

      {/* Forms */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div>
          <h3 className="text-sm font-semibold text-muted mb-3 flex items-center gap-2">
            <CalendarDays className="w-4 h-4" />
            Planning du personnel
          </h3>
          <ScheduleForm members={members} userNames={userNames} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-muted mb-3 flex items-center gap-2">
            <Heart className="w-4 h-4 text-green-600" />
            <Stethoscope className="w-4 h-4 text-orange-600" />
            Rendez-vous
          </h3>
          <AppointmentForm animals={animalsForForm} members={members} userNames={userNames} />
        </div>
      </div>

      {/* View toggle */}
      <div className="flex items-center justify-end gap-2 mb-6">
        <Link
          href="/planning?view=timeline"
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
            viewMode === 'timeline'
              ? 'bg-primary text-primary-foreground'
              : 'bg-surface-hover text-muted hover:text-text'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Timeline
        </Link>
        <Link
          href="/planning?view=cards"
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
            viewMode === 'cards'
              ? 'bg-primary text-primary-foreground'
              : 'bg-surface-hover text-muted hover:text-text'
          }`}
        >
          <Grid className="w-4 h-4" />
          Cartes
        </Link>
      </div>

      {/* Calendar view */}
      {viewMode === 'timeline' ? (
        <TimelineCalendarView
          schedules={schedules}
          appointments={appointments}
          animals={animalsForForm}
          members={members}
          userNames={userNames}
          animalNames={animalNames}
          canManage={true}
        />
      ) : (
        <ScheduleView
          schedules={schedules}
          appointments={appointments}
          userNames={userNames}
          animalNames={animalNames}
        />
      )}
    </div>
  )
}
