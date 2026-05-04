'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { persistAstreinteReportPdf } from '@/lib/pdf/astreinte-report-pdf'
import { sendAstreinteReport } from '@/lib/email/astreinte-report-email'

// =============================================================================
// Types
// =============================================================================

export type TicketActionState =
  | { status: 'idle' }
  | { status: 'success'; message?: string }
  | { status: 'error'; message: string }

const StatusEnum = z.enum(['new', 'acknowledged', 'on_route', 'on_site', 'in_progress', 'completed', 'cancelled'])
const PriorityEnum = z.enum(['low', 'normal', 'high', 'critical'])
const OutcomeEnum = z.enum([
  'animal_recovered', 'not_found', 'refused', 'deceased', 'transferred_owner', 'other',
])
const DestinationEnum = z.enum([
  'refuge_sda', 'veterinary', 'owner_returned', 'euthanasia', 'on_site_release', 'other',
])

async function requireUserId(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

// =============================================================================
// Prendre en charge (new → acknowledged)
// =============================================================================

export async function acknowledgeTicket(ticketId: string): Promise<void> {
  const userId = await requireUserId()
  if (!userId) return

  const admin = createAdminClient()
  await admin
    .from('astreinte_tickets')
    .update({
      status: 'acknowledged',
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: userId,
    })
    .eq('id', ticketId)

  revalidatePath('/astreinte/tickets')
  revalidatePath(`/astreinte/tickets/${ticketId}`)
}

// =============================================================================
// Changer de statut (transition simple, sans rapport)
// =============================================================================

export async function changeTicketStatus(
  ticketId: string,
  newStatus: string
): Promise<void> {
  const userId = await requireUserId()
  if (!userId) return

  const parsed = StatusEnum.safeParse(newStatus)
  if (!parsed.success) return

  const admin = createAdminClient()
  const now = new Date().toISOString()
  const updates: Record<string, unknown> = { status: parsed.data }

  if (parsed.data === 'acknowledged') {
    updates.acknowledged_at = now
    updates.acknowledged_by = userId
  }
  if (parsed.data === 'on_route') {
    updates.on_route_at = now
    updates.on_route_by = userId
  }
  if (parsed.data === 'on_site') {
    updates.on_site_at = now
    updates.on_site_by = userId
  }
  if (parsed.data === 'completed') {
    updates.completed_at = now
    updates.completed_by = userId
  }

  await admin.from('astreinte_tickets').update(updates).eq('id', ticketId)

  revalidatePath('/astreinte/tickets')
  revalidatePath(`/astreinte/tickets/${ticketId}`)
}

// =============================================================================
// Marquer "en route" (acknowledged → on_route)
// =============================================================================

export async function setTicketOnRoute(ticketId: string): Promise<void> {
  await changeTicketStatus(ticketId, 'on_route')
}

// =============================================================================
// Marquer "sur place" (on_route → on_site)
// =============================================================================

export async function setTicketOnSite(ticketId: string): Promise<void> {
  await changeTicketStatus(ticketId, 'on_site')
}

// =============================================================================
// Clôturer avec compte-rendu (génère PDF + envoie email)
// =============================================================================

const CompleteSchema = z.object({
  ticket_id: z.string().uuid(),
  outcome: OutcomeEnum,
  destination: DestinationEnum,
  comments: z.string().min(2, 'Précisez quelques observations.').max(5000),
})

export async function completeInterventionWithReport(
  _prev: TicketActionState,
  formData: FormData
): Promise<TicketActionState> {
  const userId = await requireUserId()
  if (!userId) return { status: 'error', message: 'Non authentifié.' }

  const parsed = CompleteSchema.safeParse({
    ticket_id: formData.get('ticket_id'),
    outcome: formData.get('outcome'),
    destination: formData.get('destination'),
    comments: formData.get('comments'),
  })

  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Données invalides.',
    }
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  // 1. Statut completed + métadonnées rapport
  const { error: updateError } = await admin
    .from('astreinte_tickets')
    .update({
      status: 'completed',
      completed_at: now,
      completed_by: userId,
      intervention_outcome: parsed.data.outcome,
      intervention_destination: parsed.data.destination,
      intervention_comments: parsed.data.comments,
    })
    .eq('id', parsed.data.ticket_id)

  if (updateError) {
    console.error('[astreinte] complete update error:', updateError)
    return { status: 'error', message: 'Erreur lors de la clôture.' }
  }

  // 2. Génération PDF + upload Storage
  let pdfResult: Awaited<ReturnType<typeof persistAstreinteReportPdf>> | null = null
  try {
    pdfResult = await persistAstreinteReportPdf(parsed.data.ticket_id)
  } catch (err) {
    console.error('[astreinte] PDF generation failed:', err)
    revalidatePath(`/astreinte/tickets/${parsed.data.ticket_id}`)
    return {
      status: 'error',
      message: 'Ticket clôturé mais génération du PDF échouée. Réessayez l’envoi.',
    }
  }

  // 3. Envoi email avec PDF en pièce jointe
  try {
    const sendResult = await sendAstreinteReport({
      data: pdfResult.data,
      pdfBuffer: pdfResult.buffer,
      pdfFilename: pdfResult.filename,
    })

    await admin
      .from('astreinte_tickets')
      .update({
        report_sent_at: new Date().toISOString(),
        report_sent_to: sendResult.recipients,
      })
      .eq('id', parsed.data.ticket_id)

    await admin.from('astreinte_ticket_events').insert({
      ticket_id: parsed.data.ticket_id,
      event_type: 'report_sent',
      performed_by: userId,
      message: `Compte-rendu envoyé à ${sendResult.recipients.join(', ')}`,
      metadata: { recipients: sendResult.recipients, message_id: sendResult.messageId },
      visible_to_declarant: true,
    })
  } catch (err) {
    console.error('[astreinte] email send failed:', err)
    revalidatePath(`/astreinte/tickets/${parsed.data.ticket_id}`)
    return {
      status: 'error',
      message: 'Ticket clôturé et PDF généré, mais l’envoi email a échoué.',
    }
  }

  revalidatePath('/astreinte/tickets')
  revalidatePath(`/astreinte/tickets/${parsed.data.ticket_id}`)
  return { status: 'success', message: 'Compte-rendu envoyé au déclarant et à la fourrière.' }
}

// =============================================================================
// Renvoyer le compte-rendu (regénère PDF + email)
// =============================================================================

export async function resendInterventionReport(ticketId: string): Promise<TicketActionState> {
  const userId = await requireUserId()
  if (!userId) return { status: 'error', message: 'Non authentifié.' }

  try {
    const result = await persistAstreinteReportPdf(ticketId)
    const sendResult = await sendAstreinteReport({
      data: result.data,
      pdfBuffer: result.buffer,
      pdfFilename: result.filename,
    })

    const admin = createAdminClient()
    await admin
      .from('astreinte_tickets')
      .update({
        report_sent_at: new Date().toISOString(),
        report_sent_to: sendResult.recipients,
      })
      .eq('id', ticketId)

    await admin.from('astreinte_ticket_events').insert({
      ticket_id: ticketId,
      event_type: 'report_sent',
      performed_by: userId,
      message: `Compte-rendu réenvoyé à ${sendResult.recipients.join(', ')}`,
      metadata: { recipients: sendResult.recipients, message_id: sendResult.messageId },
      visible_to_declarant: true,
    })

    revalidatePath(`/astreinte/tickets/${ticketId}`)
    return { status: 'success', message: 'Compte-rendu renvoyé.' }
  } catch (err) {
    console.error('[astreinte] resend report failed:', err)
    return { status: 'error', message: 'Échec du renvoi du compte-rendu.' }
  }
}

// =============================================================================
// Changer la priorité
// =============================================================================

export async function changeTicketPriority(
  ticketId: string,
  newPriority: string
): Promise<void> {
  const userId = await requireUserId()
  if (!userId) return

  const parsed = PriorityEnum.safeParse(newPriority)
  if (!parsed.success) return

  const admin = createAdminClient()
  await admin
    .from('astreinte_tickets')
    .update({ priority: parsed.data })
    .eq('id', ticketId)

  revalidatePath('/astreinte/tickets')
  revalidatePath(`/astreinte/tickets/${ticketId}`)
}

// =============================================================================
// Attribuer à un agent (assignation)
// =============================================================================

export async function assignTicket(
  ticketId: string,
  assignedToUserId: string | null
): Promise<void> {
  const userId = await requireUserId()
  if (!userId) return

  const admin = createAdminClient()
  await admin
    .from('astreinte_tickets')
    .update({
      assigned_to: assignedToUserId,
      assigned_at: assignedToUserId ? new Date().toISOString() : null,
    })
    .eq('id', ticketId)

  revalidatePath('/astreinte/tickets')
  revalidatePath(`/astreinte/tickets/${ticketId}`)
}

// =============================================================================
// Ajouter une note (interne SDA ou message au déclarant)
// =============================================================================

const AddNoteSchema = z.object({
  ticket_id: z.string().uuid(),
  message: z.string().min(2).max(2000),
  visible_to_declarant: z.coerce.boolean().default(false),
})

export async function addTicketNote(
  _prev: TicketActionState,
  formData: FormData
): Promise<TicketActionState> {
  const userId = await requireUserId()
  if (!userId) return { status: 'error', message: 'Non authentifié.' }

  const parsed = AddNoteSchema.safeParse({
    ticket_id: formData.get('ticket_id'),
    message: formData.get('message'),
    visible_to_declarant: formData.get('visible_to_declarant') === 'true',
  })

  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Données invalides.' }
  }

  const admin = createAdminClient()
  const { error } = await admin.from('astreinte_ticket_events').insert({
    ticket_id: parsed.data.ticket_id,
    event_type: 'comment',
    performed_by: userId,
    message: parsed.data.message,
    visible_to_declarant: parsed.data.visible_to_declarant,
  })

  if (error) {
    console.error('[astreinte/tickets/addNote]', error)
    return { status: 'error', message: 'Erreur lors de l’ajout.' }
  }

  revalidatePath(`/astreinte/tickets/${parsed.data.ticket_id}`)
  return { status: 'success' }
}
