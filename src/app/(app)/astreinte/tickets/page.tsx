import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { TicketsList } from '@/components/astreinte/tickets-list'

export const dynamic = 'force-dynamic'

interface SearchParams {
  status?: string
  type?: string
  priority?: string
  commune?: string
  q?: string
}

export default async function AstreinteTicketsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const ctx = await getEstablishmentContext()
  if (!ctx?.permissions.canManageEstablishment) {
    redirect('/dashboard')
  }

  const params = await searchParams
  const admin = createAdminClient()

  let query = admin
    .from('astreinte_tickets')
    .select(
      'id, ticket_number, intervention_type, status, priority, location_address, municipality_code_insee, declarant_email, declarant_organization, animal_species, animal_count, animal_injured, created_at, acknowledged_at, completed_at, is_night_intervention'
    )

  if (params.status) query = query.eq('status', params.status)
  if (params.type) query = query.eq('intervention_type', params.type)
  if (params.priority) query = query.eq('priority', params.priority)
  if (params.commune) query = query.eq('municipality_code_insee', params.commune)
  if (params.q) {
    query = query.or(
      `ticket_number.ilike.%${params.q}%,location_address.ilike.%${params.q}%,declarant_email.ilike.%${params.q}%`
    )
  }

  // Tri : critical/high d'abord, puis chronologique inverse
  const { data: tickets } = await query
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200)

  const { data: communes } = await admin
    .from('astreinte_municipalities')
    .select('code_insee, name')
    .order('name')

  // Stats globales
  const { data: allTickets } = await admin
    .from('astreinte_tickets')
    .select('status, priority, created_at')

  const stats = {
    total: allTickets?.length ?? 0,
    new: allTickets?.filter((t) => t.status === 'new').length ?? 0,
    inProgress:
      allTickets?.filter((t) =>
        ['acknowledged', 'in_progress'].includes(t.status)
      ).length ?? 0,
    critical:
      allTickets?.filter(
        (t) =>
          (t.priority === 'critical' || t.priority === 'high') &&
          ['new', 'acknowledged', 'in_progress'].includes(t.status)
      ).length ?? 0,
    completed: allTickets?.filter((t) => t.status === 'completed').length ?? 0,
    today:
      allTickets?.filter((t) => {
        const d = new Date(t.created_at)
        const today = new Date()
        return d.toDateString() === today.toDateString()
      }).length ?? 0,
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Tickets astreinte</h1>
        <p className="text-sm text-muted mt-1">
          Tickets entrants depuis le portail{' '}
          <a
            href="https://astreinte.sda-nord.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            astreinte.sda-nord.com
          </a>
          . Triés par priorité, urgents en haut.
        </p>
      </div>

      <TicketsList
        tickets={tickets ?? []}
        communes={communes ?? []}
        stats={stats}
        filters={params}
      />
    </div>
  )
}
