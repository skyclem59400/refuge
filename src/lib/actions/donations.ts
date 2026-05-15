'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireEstablishment, requirePermission } from '@/lib/establishment/permissions'
import type { Donation, DonationPaymentMethod, DonationNature } from '@/lib/types/database'
import { logActivity } from '@/lib/actions/activity-log'
import { trackChanges } from '@/lib/utils/activity'
import { generateCerfaPdf } from '@/lib/pdf/cerfa-pdf'
import { sendCerfaByEmail } from '@/lib/email/cerfa-email'

export async function getDonations(filters?: { year?: number }) {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    let query = supabase
      .from('donations')
      .select('*')
      .eq('establishment_id', establishmentId)
      .order('date', { ascending: false })

    if (filters?.year) {
      query = query
        .gte('date', `${filters.year}-01-01`)
        .lte('date', `${filters.year}-12-31`)
    }

    const { data, error } = await query
    if (error) return { error: error.message }
    return { data: data as Donation[] }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function getDonation(id: string) {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('donations')
      .select('*')
      .eq('id', id)
      .eq('establishment_id', establishmentId)
      .single()

    if (error || !data) return { error: 'Don introuvable' }
    return { data: data as Donation }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function createDonation(data: {
  client_id: string
  amount: number
  date: string
  payment_method: DonationPaymentMethod
  nature: DonationNature
  notes: string | null
}) {
  try {
    const { establishmentId } = await requirePermission('manage_donations')
    const supabase = await createClient()
    const admin = createAdminClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Snapshot donor info from the client (figé au moment du don, pas live)
    const { data: client, error: clientError } = await admin
      .from('clients')
      .select('id, kind, name, first_name, email, phone, address, postal_code, city')
      .eq('id', data.client_id)
      .eq('establishment_id', establishmentId)
      .single()

    if (clientError || !client) return { error: 'Contact donateur introuvable.' }

    const donorName = client.kind === 'organization' || !client.first_name
      ? client.name
      : `${client.name} ${client.first_name}`

    // Get CERFA number before insert
    const { data: cerfaNumber, error: rpcError } = await admin.rpc('get_next_cerfa_number', {
      est_id: establishmentId,
    })

    if (rpcError) return { error: 'Erreur de numerotation CERFA: ' + rpcError.message }

    const { data: donation, error } = await admin
      .from('donations')
      .insert({
        establishment_id: establishmentId,
        client_id: client.id,
        donor_name: donorName,
        donor_email: client.email,
        donor_phone: client.phone,
        donor_address: client.address,
        donor_postal_code: client.postal_code,
        donor_city: client.city,
        amount: data.amount,
        date: data.date,
        payment_method: data.payment_method,
        nature: data.nature,
        notes: data.notes,
        created_by: user?.id,
        cerfa_number: cerfaNumber,
        cerfa_generated: true,
        cerfa_generated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) return { error: error.message }

    revalidatePath('/donations')
    revalidatePath('/dashboard')
    logActivity({
      action: 'create',
      entityType: 'donation',
      entityId: donation.id,
      entityName: `Don ${cerfaNumber || ''} - ${donorName}`,
      details: { montant: data.amount, donateur: donorName, methode: data.payment_method, nature: data.nature },
    })
    return { data: donation as Donation }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function updateDonation(id: string, data: {
  donor_name: string
  donor_email: string | null
  donor_phone: string | null
  donor_address: string | null
  donor_postal_code: string | null
  donor_city: string | null
  amount: number
  date: string
  payment_method: DonationPaymentMethod
  nature: DonationNature
  notes: string | null
}) {
  try {
    const { establishmentId } = await requirePermission('manage_donations')
    const supabase = await createClient()
    const admin = createAdminClient()

    // Fetch current donation for change tracking
    const { data: currentDonation } = await admin
      .from('donations')
      .select('*')
      .eq('id', id)
      .eq('establishment_id', establishmentId)
      .single()

    const { data: donation, error } = await supabase
      .from('donations')
      .update(data)
      .eq('id', id)
      .eq('establishment_id', establishmentId)
      .select()
      .single()

    if (error) return { error: error.message }

    const changes = trackChanges(currentDonation, data)

    revalidatePath('/donations')
    revalidatePath('/dashboard')
    logActivity({
      action: 'update',
      entityType: 'donation',
      entityId: id,
      entityName: data.donor_name,
      details: changes,
    })
    return { data: donation as Donation }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function deleteDonation(id: string) {
  try {
    const { establishmentId } = await requirePermission('manage_donations')
    const supabase = await createClient()

    const { data: donInfo } = await supabase.from('donations').select('donor_name, amount, cerfa_number').eq('id', id).eq('establishment_id', establishmentId).single()

    const { error } = await supabase
      .from('donations')
      .delete()
      .eq('id', id)
      .eq('establishment_id', establishmentId)

    if (error) return { error: error.message }

    logActivity({
      action: 'delete',
      entityType: 'donation',
      entityId: id,
      entityName: donInfo ? `Don ${donInfo.cerfa_number || ''} - ${donInfo.donor_name}` : undefined,
      details: donInfo ? { montant: donInfo.amount, donateur: donInfo.donor_name } : undefined,
    })
    revalidatePath('/donations')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function generateCerfa(donationId: string) {
  try {
    const { establishmentId } = await requirePermission('manage_donations')
    const supabase = await createClient()

    // Check donation exists and doesn't already have a CERFA
    const { data: existing, error: fetchError } = await supabase
      .from('donations')
      .select('cerfa_number, cerfa_generated')
      .eq('id', donationId)
      .eq('establishment_id', establishmentId)
      .single()

    if (fetchError || !existing) return { error: 'Don introuvable' }
    if (existing.cerfa_generated && existing.cerfa_number) {
      return { error: 'Un recu CERFA a deja ete genere pour ce don' }
    }

    // Get next CERFA number
    const { data: cerfaNumber, error: rpcError } = await supabase.rpc('get_next_cerfa_number', {
      est_id: establishmentId,
    })

    if (rpcError) return { error: 'Erreur de numerotation CERFA: ' + rpcError.message }

    // Update donation with CERFA info
    const { data: donation, error } = await supabase
      .from('donations')
      .update({
        cerfa_number: cerfaNumber,
        cerfa_generated: true,
        cerfa_generated_at: new Date().toISOString(),
      })
      .eq('id', donationId)
      .eq('establishment_id', establishmentId)
      .select()
      .single()

    if (error) return { error: error.message }

    revalidatePath('/donations')
    return { data: donation as Donation }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function getDonationYears(): Promise<number[]> {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('donations')
      .select('date')
      .eq('establishment_id', establishmentId)
      .order('date', { ascending: false })

    if (error || !data) return [new Date().getFullYear()]

    const years = [...new Set(data.map((d) => new Date(d.date).getFullYear()))]
    years.sort((a, b) => b - a)

    return years.length > 0 ? years : [new Date().getFullYear()]
  } catch {
    return [new Date().getFullYear()]
  }
}

export async function sendCerfaEmailAction(
  donationId: string,
  options?: { overrideEmail?: string },
) {
  try {
    const { establishmentId } = await requirePermission('manage_donations')
    const admin = createAdminClient()

    const { data: donation, error: fetchError } = await admin
      .from('donations')
      .select('*')
      .eq('id', donationId)
      .eq('establishment_id', establishmentId)
      .single<Donation>()

    if (fetchError || !donation) return { error: 'Don introuvable' }

    if (!donation.cerfa_generated || !donation.cerfa_number) {
      return { error: 'Générez le reçu CERFA avant de l\'envoyer par email.' }
    }

    const recipient = options?.overrideEmail?.trim() || donation.donor_email
    if (!recipient) {
      return { error: 'Aucun email destinataire : renseignez l\'email du donateur d\'abord.' }
    }

    const { buffer, filename } = await generateCerfaPdf(donationId)
    const { messageId, recipient: sentTo } = await sendCerfaByEmail({
      donation,
      pdfBuffer: buffer,
      pdfFilename: filename,
      to: recipient,
    })

    await admin
      .from('donations')
      .update({
        cerfa_sent_at: new Date().toISOString(),
        cerfa_sent_to: sentTo,
      })
      .eq('id', donationId)

    logActivity({
      action: 'update',
      entityType: 'donation',
      entityId: donationId,
      entityName: `CERFA ${donation.cerfa_number} envoyé à ${sentTo}`,
      details: { messageId, recipient: sentTo },
    })

    revalidatePath('/donations')
    revalidatePath(`/donations/${donationId}`)
    return { success: true, recipient: sentTo }
  } catch (e) {
    console.error('[donations] sendCerfaEmailAction failed:', e)
    return { error: (e as Error).message || 'Échec de l\'envoi du reçu fiscal.' }
  }
}

export async function getDonationStats(year?: number) {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()
    const currentYear = year || new Date().getFullYear()

    const { data, error } = await supabase
      .from('donations')
      .select('amount, date, cerfa_generated')
      .eq('establishment_id', establishmentId)
      .gte('date', `${currentYear}-01-01`)
      .lte('date', `${currentYear}-12-31`)

    if (error) return { error: error.message }

    const donations = data || []
    const totalAmount = donations.reduce((sum, d) => sum + Number(d.amount), 0)
    const totalCount = donations.length
    const cerfaCount = donations.filter(d => d.cerfa_generated).length

    return {
      data: {
        totalAmount,
        totalCount,
        cerfaCount,
        year: currentYear,
      }
    }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
