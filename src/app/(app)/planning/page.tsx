import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CalendarDays, Info, Heart, Stethoscope, Calendar, Grid } from 'lucide-react'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { getEstablishmentMembers } from '@/lib/actions/establishments'
import { createAdminClient } from '@/lib/supabase/server'
import { getSchedule } from '@/lib/actions/schedule'
import { getAppointments } from '@/lib/actions/appointments'
import { EventCreator } from '@/components/schedule/event-creator'
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

function buildAnimalMaps(allAnimals: { id: string; name: string }[] | null) {
  const animals = allAnimals || []
  // EventCreator (et schedule views) consomment `{ id, nom }` historiquement.
  // On normalise depuis `name` (colonne réelle en base) vers `nom` (clé du form).
  const animalsForForm = animals.map((a) => ({ id: a.id, nom: a.name }))
  const animalNames: Record<string, string> = {}
  for (const animal of animals) {
    animalNames[animal.id] = animal.name
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
    .select('id, name')
    .eq('establishment_id', ctx.establishment.id)
    .order('name')

  const { animalsForForm, animalNames } = buildAnimalMaps(allAnimals)

  // Semaines-types des salariés : pour pré-remplir la grille avec les présences
  // récurrentes (sans avoir besoin de créer un staff_schedule chaque semaine).
  // Affichées en "shadow events" (rayures + opacité 65%) — ne masquent pas les
  // schedules explicites qui prennent toujours le dessus.
  const { data: workSchedulesRaw } = await admin
    .from('member_work_schedules')
    .select('day_of_week, is_rest_day, start_am, end_am, start_pm, end_pm, establishment_members!inner(user_id)')
    .eq('establishment_id', ctx.establishment.id)
    .is('valid_until', null)

  type StandardDay = {
    user_id: string
    day_of_week: number
    is_rest_day: boolean
    start_am: string | null
    end_am: string | null
    start_pm: string | null
    end_pm: string | null
  }
  const standardSchedules: StandardDay[] = (workSchedulesRaw || [])
    .map((w: { day_of_week: number; is_rest_day: boolean; start_am: string | null; end_am: string | null; start_pm: string | null; end_pm: string | null; establishment_members: { user_id: string } | { user_id: string }[] }) => {
      const em = Array.isArray(w.establishment_members) ? w.establishment_members[0] : w.establishment_members
      return {
        user_id: em?.user_id || '',
        day_of_week: w.day_of_week,
        is_rest_day: w.is_rest_day,
        start_am: w.start_am,
        end_am: w.end_am,
        start_pm: w.start_pm,
        end_pm: w.end_pm,
      }
    })
    .filter((s: StandardDay) => s.user_id)

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

      {/* Formulaire unifié : présence + RDV adoption + RDV véto + autre */}
      <div className="mb-6">
        <EventCreator
          members={members}
          userNames={userNames}
          animals={animalsForForm}
        />
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
          minDailyStaff={ctx.establishment.min_daily_staff ?? 0}
          standardSchedules={standardSchedules}
        />
      )}
    </div>
  )
}
