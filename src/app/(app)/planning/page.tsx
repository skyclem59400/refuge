import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CalendarDays, Info, Heart, Stethoscope, Calendar, Grid } from 'lucide-react'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { getEstablishmentMembers } from '@/lib/actions/establishments'
import { createAdminClient } from '@/lib/supabase/server'
import { getSchedule, deleteSchedule } from '@/lib/actions/schedule'
import { getAppointments, deleteAppointment } from '@/lib/actions/appointments'
import { ScheduleForm } from '@/components/schedule/schedule-form'
import { AppointmentForm } from '@/components/appointments/appointment-form'
import { ScheduleView } from '@/components/schedule/schedule-view'
import { TimelineCalendarView } from '@/components/schedule/timeline-calendar-view'

export default async function PlanningPage(props: { searchParams: Promise<{ view?: string }> }) {
  const searchParams = await props.searchParams
  const ctx = await getEstablishmentContext()
  if (!ctx) redirect('/login')

  // Only managers/admins can access
  const canManage = ctx.permissions.canManagePlanning
  if (!canManage) {
    redirect('/dashboard')
  }

  // Fetch data (include past 60 days and future 60 days for timeline navigation)
  const sixtyDaysAgo = new Date()
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)
  const sixtyDaysFromNow = new Date()
  sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60)

  const [scheduleResult, appointmentsResult, membersResult] = await Promise.all([
    getSchedule({
      dateFrom: sixtyDaysAgo.toISOString().split('T')[0],
      dateTo: sixtyDaysFromNow.toISOString().split('T')[0],
    }),
    getAppointments({
      dateFrom: sixtyDaysAgo.toISOString().split('T')[0],
      dateTo: sixtyDaysFromNow.toISOString().split('T')[0],
    }),
    getEstablishmentMembers(),
  ])

  const schedules = scheduleResult.data || []
  const appointments = appointmentsResult.data || []
  const members = (membersResult as { data?: { user_id: string; full_name?: string | null; pseudo: string | null; email?: string }[] }).data || []

  // Resolve user names
  const allUserIds = [
    ...new Set([
      ...schedules.map((s) => s.user_id),
      ...schedules.map((s) => s.created_by),
      ...appointments.map((a) => a.created_by),
      ...members.map((m) => m.user_id),
    ]),
  ]

  const userNames: Record<string, string> = {}
  if (allUserIds.length > 0) {
    const admin = createAdminClient()
    const { data: usersInfo } = await admin.rpc('get_users_info', { user_ids: allUserIds })
    if (usersInfo && Array.isArray(usersInfo)) {
      for (const u of usersInfo) {
        userNames[u.id] = u.full_name || u.email || u.id
      }
    }
  }

  // Fetch animals for appointment linking and form
  const admin = createAdminClient()
  const { data: allAnimals } = await admin
    .from('animals')
    .select('id, nom')
    .eq('establishment_id', ctx.establishment.id)
    .order('nom')

  const animalsForForm = (allAnimals || []).map((a: { id: string; nom: string }) => ({ id: a.id, nom: a.nom }))

  const animalNames: Record<string, string> = {}
  if (allAnimals) {
    for (const animal of allAnimals) {
      animalNames[animal.id] = animal.nom
    }
  }

  // View mode (timeline or cards)
  const viewMode = (searchParams.view === 'cards' ? 'cards' : 'timeline') as 'cards' | 'timeline'

  // Wrappers for delete functions to match expected Promise<void> signature
  const handleDeleteSchedule = async (id: string): Promise<void> => {
    await deleteSchedule(id)
  }

  const handleDeleteAppointment = async (id: string): Promise<void> => {
    await deleteAppointment(id)
  }

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
          <p className="font-medium text-text mb-1">Planning unifié</p>
          <p>
            Gérez les horaires de présence du personnel et les rendez-vous (adoptions, vétérinaire) dans un seul calendrier.
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
          <p className="text-xs text-muted mt-1">Vétérinaire</p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4 text-center">
          <CalendarDays className="w-5 h-5 text-success mx-auto mb-1" />
          <p className="text-2xl font-bold">
            {schedules.filter((s) => new Date(s.date) >= new Date()).length +
             appointments.filter((a) => new Date(a.date) >= new Date()).length}
          </p>
          <p className="text-xs text-muted mt-1">À venir</p>
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
          canManage={canManage}
          onDeleteSchedule={handleDeleteSchedule}
          onDeleteAppointment={handleDeleteAppointment}
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
