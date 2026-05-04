'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// =============================================================================
// Types
// =============================================================================

export type TicketActionState =
  | { status: 'idle' }
  | { status: 'success'; message?: string }
  | { status: 'error'; message: string }

const StatusEnum = z.enum(['new', 'acknowledged', 'in_progress', 'completed', 'cancelled'])
const PriorityEnum = z.enum(['low', 'normal', 'high', 'critical'])

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
// Changer de statut
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
  const updates: Record<string, unknown> = { status: parsed.data }

  if (parsed.data === 'completed') {
    updates.completed_at = new Date().toISOString()
  }
  if (parsed.data === 'acknowledged') {
    updates.acknowledged_at = new Date().toISOString()
    updates.acknowledged_by = userId
  }

  await admin.from('astreinte_tickets').update(updates).eq('id', ticketId)

  revalidatePath('/astreinte/tickets')
  revalidatePath(`/astreinte/tickets/${ticketId}`)
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
