'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { getEstablishmentContext } from '@/lib/establishment/context'
import type {
  PortalTicketEvent,
  PortalTicketEventType,
  PortalTicketEventWithActor,
  PortalTicketType,
} from '@/lib/types/database'

// ---------- Labels FR ----------

export const PORTAL_TICKET_TYPE_LABELS: Record<PortalTicketType, string> = {
  adoption: 'Candidature adoption',
  volunteer: 'Candidature bénévole',
  abuse_report: 'Signalement maltraitance',
}

export const PORTAL_EVENT_LABELS: Record<PortalTicketEventType, string> = {
  created: 'Demande créée',
  status_change: 'Changement de statut',
  comment_user: 'Message du demandeur',
  message_staff: 'Message équipe SDA',
  attachment_added: 'Pièce jointe ajoutée',
}

// ---------- Permission helpers ----------

function permissionFlagFor(
  ticketType: PortalTicketType,
  ctx: NonNullable<Awaited<ReturnType<typeof getEstablishmentContext>>>
): boolean {
  switch (ticketType) {
    case 'adoption':
      return ctx.permissions.canManageAdoptionApplications
    case 'volunteer':
      return ctx.permissions.canManageVolunteerApplications
    case 'abuse_report':
      return ctx.permissions.canManageAbuseReports
  }
}

function tableFor(ticketType: PortalTicketType): string {
  switch (ticketType) {
    case 'adoption':
      return 'adoption_inquiries'
    case 'volunteer':
      return 'volunteer_applications'
    case 'abuse_report':
      return 'abuse_reports'
  }
}

function pathsFor(ticketType: PortalTicketType, ticketId: string): string[] {
  switch (ticketType) {
    case 'adoption':
      return [
        '/admin/candidatures-adoption',
        `/admin/candidatures-adoption/${ticketId}`,
      ]
    case 'volunteer':
      return [
        '/admin/candidatures-benevoles',
        `/admin/candidatures-benevoles/${ticketId}`,
      ]
    case 'abuse_report':
      return [
        '/admin/signalements-maltraitance',
        `/admin/signalements-maltraitance/${ticketId}`,
      ]
  }
}

// ---------- Queries ----------

/**
 * Récupère la timeline d'événements d'un ticket, enrichie avec le nom/email
 * de l'auteur quand performed_by est connu (via supabaseAdmin → auth.users).
 */
export async function listTicketEvents(
  ticketType: PortalTicketType,
  ticketId: string
): Promise<{ data: PortalTicketEventWithActor[]; error: string | null }> {
  const ctx = await getEstablishmentContext()
  if (!ctx) return { data: [], error: 'Non authentifié' }
  if (!permissionFlagFor(ticketType, ctx)) {
    return { data: [], error: 'Accès refusé' }
  }

  const admin = createAdminClient()
  const result = (await admin
    .from('portal_ticket_events')
    .select('*')
    .eq('ticket_type', ticketType)
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: false })) as {
    data: PortalTicketEvent[] | null
    error: { message: string } | null
  }

  if (result.error) return { data: [], error: result.error.message }
  const events = result.data ?? []

  // Enrich actor name/email
  const actorIds = Array.from(
    new Set(
      events
        .map((e) => e.performed_by)
        .filter((id): id is string => Boolean(id))
    )
  )

  const actorMap = new Map<string, { name: string | null; email: string | null }>()
  if (actorIds.length > 0) {
    const { data: usersInfo } = (await admin.rpc('get_users_info', {
      user_ids: actorIds,
    })) as {
      data:
        | { id: string; email: string; full_name: string | null }[]
        | null
    }
    for (const u of usersInfo ?? []) {
      actorMap.set(u.id, { name: u.full_name, email: u.email })
    }
  }

  const enriched: PortalTicketEventWithActor[] = events.map((e) => {
    const actor = e.performed_by ? actorMap.get(e.performed_by) : undefined
    return {
      ...e,
      actor_name: actor?.name ?? null,
      actor_email: actor?.email ?? null,
    }
  })

  return { data: enriched, error: null }
}

// ---------- Mutations ----------

/**
 * Envoie un message au demandeur sur son ticket portail.
 * Insère un event `message_staff` dans portal_ticket_events.
 * Côté user, il apparaîtra dans sa timeline (RLS s'occupe du filtrage).
 */
export async function sendStaffMessage(
  ticketType: PortalTicketType,
  ticketId: string,
  message: string
): Promise<{ error: string | null }> {
  const ctx = await getEstablishmentContext()
  if (!ctx) return { error: 'Non authentifié' }
  if (!permissionFlagFor(ticketType, ctx)) {
    return { error: 'Accès refusé' }
  }

  const trimmed = message.trim()
  if (!trimmed) return { error: 'Message vide' }
  if (trimmed.length > 5000) {
    return { error: 'Message trop long (5000 caractères max)' }
  }

  // Vérifier que le ticket existe et appartient à l'établissement courant,
  // et qu'il a bien un user_id (sinon pas de destinataire pour le message).
  const admin = createAdminClient()
  const table = tableFor(ticketType)
  const ticketRes = (await admin
    .from(table)
    .select('id, user_id, establishment_id')
    .eq('id', ticketId)
    .eq('establishment_id', ctx.establishment.id)
    .maybeSingle()) as {
    data: { id: string; user_id: string | null } | null
    error: { message: string } | null
  }

  if (ticketRes.error) return { error: ticketRes.error.message }
  if (!ticketRes.data) return { error: 'Ticket introuvable' }
  if (!ticketRes.data.user_id) {
    return {
      error:
        'Aucun compte portail rattaché à ce ticket — impossible d’envoyer un message.',
    }
  }

  // Récupère l'auth user pour le performed_by + nom envoyé en payload
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  // Best-effort nom du staff via get_users_info
  let senderName: string | null = null
  try {
    const { data: usersInfo } = (await admin.rpc('get_users_info', {
      user_ids: [user.id],
    })) as {
      data: { id: string; email: string; full_name: string | null }[] | null
    }
    const info = usersInfo?.[0]
    senderName = info?.full_name || info?.email || null
  } catch {
    // ignore — payload restera sans sender_name
  }

  const { error } = await admin.from('portal_ticket_events').insert({
    ticket_type: ticketType,
    ticket_id: ticketId,
    event_type: 'message_staff',
    payload: { message: trimmed, sender_name: senderName },
    performed_by: user.id,
    performed_by_role: 'staff',
  } as never)

  if (error) return { error: error.message }

  for (const p of pathsFor(ticketType, ticketId)) revalidatePath(p)
  return { error: null }
}
