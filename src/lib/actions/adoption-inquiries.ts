'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/establishment/permissions'
import { logActivity } from '@/lib/actions/activity-log'
import {
  sendAdoptionInquiryValidated,
  sendAdoptionInquiryRefused,
} from '@/lib/email/adoption-inquiry-email'

export type AdoptionInquiryStatus =
  | 'pending'
  | 'contacted'
  | 'rdv_confirmed'
  | 'rdv_completed'
  | 'accepted'
  | 'refused'
  | 'cancelled'

export interface AdoptionInquiryRow {
  id: string
  establishment_id: string
  animal_id: string
  client_id: string | null
  appointment_id: string | null
  first_name: string
  last_name: string
  email: string
  phone: string
  address: string | null
  postal_code: string | null
  city: string | null
  questionnaire: Record<string, unknown>
  status: AdoptionInquiryStatus
  source: 'public_portal' | 'manual'
  team_notes: string | null
  refusal_reason: string | null
  created_at: string
  updated_at: string
  // Joined
  animal?: { id: string; name: string; species: string; photo_url: string | null } | null
  appointment?: { date: string; start_time: string; end_time: string; status: string } | null
}

// ============================================================
// READ
// ============================================================

export async function getAdoptionInquiries(filters?: { status?: AdoptionInquiryStatus }) {
  try {
    const { establishmentId } = await requirePermission('manage_adoptions')
    const admin = createAdminClient()

    let query = admin
      .from('adoption_inquiries')
      .select(`
        *,
        animal:animals!animal_id(id, name, species),
        appointment:appointments!appointment_id(date, start_time, end_time, status)
      `)
      .eq('establishment_id', establishmentId)

    if (filters?.status) query = query.eq('status', filters.status)

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) return { error: error.message }

    // Récupère les photos primaires des animaux
    const animalIds = (data ?? []).map((r) => (r as { animal_id: string }).animal_id)
    const photoByAnimal: Record<string, string> = {}
    if (animalIds.length > 0) {
      const { data: photos } = await admin
        .from('animal_photos')
        .select('animal_id, url, is_primary')
        .in('animal_id', animalIds)
        .order('is_primary', { ascending: false })
      for (const p of (photos ?? []) as { animal_id: string; url: string; is_primary: boolean }[]) {
        if (!photoByAnimal[p.animal_id]) photoByAnimal[p.animal_id] = p.url
      }
    }

    const enriched = (data ?? []).map((r) => {
      const row = r as AdoptionInquiryRow
      return {
        ...row,
        animal: row.animal
          ? { ...row.animal, photo_url: photoByAnimal[row.animal.id] ?? null }
          : null,
      } as AdoptionInquiryRow
    })

    return { data: enriched }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ============================================================
// WRITE — Validation
// ============================================================

export async function validateAdoptionInquiry(id: string, teamMessage?: string) {
  try {
    const { establishmentId, userId } = await requirePermission('manage_adoptions')
    const admin = createAdminClient()

    const { data: inquiry } = await admin
      .from('adoption_inquiries')
      .select('*, animal:animals!animal_id(id, name), appointment:appointments!appointment_id(*)')
      .eq('id', id)
      .eq('establishment_id', establishmentId)
      .single()

    if (!inquiry) return { error: 'Demande introuvable' }

    type Row = AdoptionInquiryRow & {
      animal: { id: string; name: string } | null
      appointment: { id: string; date: string; start_time: string; status: string } | null
    }
    const row = inquiry as unknown as Row

    if (row.status !== 'pending') {
      return { error: `Demande déjà traitée (statut actuel : ${row.status})` }
    }

    // Update inquiry → rdv_confirmed
    const { error: upInq } = await admin
      .from('adoption_inquiries')
      .update({ status: 'rdv_confirmed', team_notes: teamMessage ?? row.team_notes })
      .eq('id', id)

    if (upInq) return { error: upInq.message }

    // Update appointment → scheduled
    if (row.appointment_id) {
      await admin
        .from('appointments')
        .update({ status: 'scheduled', assigned_user_id: userId })
        .eq('id', row.appointment_id)
    }

    // Email confirmation
    const { data: estabRow } = await admin
      .from('establishments')
      .select('name')
      .eq('id', establishmentId)
      .single()

    if (row.appointment && row.animal) {
      sendAdoptionInquiryValidated({
        to: row.email,
        firstName: row.first_name,
        animalName: row.animal.name,
        appointmentDate: row.appointment.date,
        appointmentTime: row.appointment.start_time.slice(0, 5),
        establishmentName: (estabRow as { name: string } | null)?.name ?? 'SDA Nord',
        teamMessage,
      }).catch((e) => console.error('[validateAdoptionInquiry] email échec', e))
    }

    revalidatePath('/adoptions')
    logActivity({
      action: 'update',
      entityType: 'adoption_inquiry',
      entityId: id,
      entityName: `${row.first_name} ${row.last_name}`,
      details: { status: 'rdv_confirmed' },
    })

    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ============================================================
// WRITE — Refus
// ============================================================

export async function refuseAdoptionInquiry(id: string, reason: string) {
  try {
    if (!reason || reason.trim().length < 10) {
      return { error: 'Merci d\'indiquer un motif de refus (minimum 10 caractères).' }
    }

    const { establishmentId } = await requirePermission('manage_adoptions')
    const admin = createAdminClient()

    const { data: inquiry } = await admin
      .from('adoption_inquiries')
      .select('*, animal:animals!animal_id(id, name)')
      .eq('id', id)
      .eq('establishment_id', establishmentId)
      .single()

    if (!inquiry) return { error: 'Demande introuvable' }
    const row = inquiry as unknown as AdoptionInquiryRow & { animal: { id: string; name: string } | null }

    if (row.status === 'refused' || row.status === 'cancelled') {
      return { error: 'Demande déjà clôturée' }
    }

    // Update inquiry → refused
    const { error: upInq } = await admin
      .from('adoption_inquiries')
      .update({ status: 'refused', refusal_reason: reason })
      .eq('id', id)

    if (upInq) return { error: upInq.message }

    // Annuler le RDV pour libérer le créneau
    if (row.appointment_id) {
      await admin
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', row.appointment_id)
    }

    // Email refus
    const { data: estabRow } = await admin
      .from('establishments')
      .select('name')
      .eq('id', establishmentId)
      .single()

    if (row.animal) {
      sendAdoptionInquiryRefused({
        to: row.email,
        firstName: row.first_name,
        animalName: row.animal.name,
        establishmentName: (estabRow as { name: string } | null)?.name ?? 'SDA Nord',
        reason,
      }).catch((e) => console.error('[refuseAdoptionInquiry] email échec', e))
    }

    revalidatePath('/adoptions')
    logActivity({
      action: 'update',
      entityType: 'adoption_inquiry',
      entityId: id,
      entityName: `${row.first_name} ${row.last_name}`,
      details: { status: 'refused', reason },
    })

    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ============================================================
// WRITE — Notes équipe (sans changement de statut)
// ============================================================

export async function updateInquiryNotes(id: string, teamNotes: string) {
  try {
    const { establishmentId } = await requirePermission('manage_adoptions')
    const admin = createAdminClient()

    const { error } = await admin
      .from('adoption_inquiries')
      .update({ team_notes: teamNotes })
      .eq('id', id)
      .eq('establishment_id', establishmentId)

    if (error) return { error: error.message }
    revalidatePath('/adoptions')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ============================================================
// WRITE — Marquer status manuel (rdv_completed, accepted)
// ============================================================

export async function setInquiryStatus(id: string, status: AdoptionInquiryStatus) {
  try {
    const { establishmentId } = await requirePermission('manage_adoptions')
    const admin = createAdminClient()

    const { error } = await admin
      .from('adoption_inquiries')
      .update({ status })
      .eq('id', id)
      .eq('establishment_id', establishmentId)

    if (error) return { error: error.message }
    revalidatePath('/adoptions')
    logActivity({
      action: 'update',
      entityType: 'adoption_inquiry',
      entityId: id,
      details: { status },
    })
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
