'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireEstablishment, requirePermission } from '@/lib/establishment/permissions'
import type { Donation, DonationPaymentMethod, DonationNature } from '@/lib/types/database'

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
    const { data: { user } } = await supabase.auth.getUser()

    const { data: donation, error } = await supabase
      .from('donations')
      .insert({
        ...data,
        establishment_id: establishmentId,
        created_by: user?.id,
      })
      .select()
      .single()

    if (error) return { error: error.message }

    revalidatePath('/donations')
    revalidatePath('/dashboard')
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

    const { data: donation, error } = await supabase
      .from('donations')
      .update(data)
      .eq('id', id)
      .eq('establishment_id', establishmentId)
      .select()
      .single()

    if (error) return { error: error.message }

    revalidatePath('/donations')
    revalidatePath('/dashboard')
    return { data: donation as Donation }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function deleteDonation(id: string) {
  try {
    const { establishmentId } = await requirePermission('manage_donations')
    const supabase = await createClient()

    const { error } = await supabase
      .from('donations')
      .delete()
      .eq('id', id)
      .eq('establishment_id', establishmentId)

    if (error) return { error: error.message }

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
