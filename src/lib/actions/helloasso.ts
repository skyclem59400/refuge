'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/establishment/permissions'
import {
  authenticate,
  getAllPayments,
  getValidAccessToken,
} from '@/lib/helloasso/client'
import type { HelloAssoConnection, Donation } from '@/lib/types/database'

// ---------------------------------------------------------------------------
// getHelloAssoConnection — fetch connection for the current establishment
// ---------------------------------------------------------------------------

export async function getHelloAssoConnection() {
  try {
    const { establishmentId } = await requirePermission('manage_donations')
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('helloasso_connections')
      .select('*')
      .eq('establishment_id', establishmentId)
      .maybeSingle()

    if (error) return { error: error.message }
    return { data: data as HelloAssoConnection | null }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ---------------------------------------------------------------------------
// saveHelloAssoConnection — save/update credentials and authenticate
// ---------------------------------------------------------------------------

export async function saveHelloAssoConnection(data: {
  client_id: string
  client_secret: string
  organization_slug: string
}) {
  try {
    const { establishmentId } = await requirePermission('manage_donations')
    const supabase = createAdminClient()

    // Authenticate immediately to validate credentials
    const tokens = await authenticate(data.client_id, data.client_secret)
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    const { data: connection, error } = await supabase
      .from('helloasso_connections')
      .upsert(
        {
          establishment_id: establishmentId,
          client_id: data.client_id,
          client_secret: data.client_secret,
          organization_slug: data.organization_slug,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: tokenExpiresAt,
          is_active: true,
          sync_status: 'idle' as const,
          sync_error: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'establishment_id' }
      )
      .select()
      .single()

    if (error) return { error: error.message }

    revalidatePath('/donations')
    return { data: connection as HelloAssoConnection }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ---------------------------------------------------------------------------
// disconnectHelloAsso — delete connection
// ---------------------------------------------------------------------------

export async function disconnectHelloAsso() {
  try {
    const { establishmentId } = await requirePermission('manage_donations')
    const supabase = createAdminClient()

    const { error } = await supabase
      .from('helloasso_connections')
      .delete()
      .eq('establishment_id', establishmentId)

    if (error) return { error: error.message }

    revalidatePath('/donations')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ---------------------------------------------------------------------------
// syncHelloAssoDonations — fetch payments from HelloAsso and import as donations
// ---------------------------------------------------------------------------

export async function syncHelloAssoDonations() {
  try {
    const { establishmentId } = await requirePermission('manage_donations')
    const supabase = createAdminClient()

    // Fetch the connection
    const { data: conn, error: connError } = await supabase
      .from('helloasso_connections')
      .select('*')
      .eq('establishment_id', establishmentId)
      .single()

    if (connError || !conn) {
      return { error: 'Aucune connexion HelloAsso configuree' }
    }

    // Mark sync as in progress
    await supabase
      .from('helloasso_connections')
      .update({ sync_status: 'syncing', sync_error: null, updated_at: new Date().toISOString() })
      .eq('id', conn.id)

    try {
      // Get a valid access token (auto-refresh if needed)
      const accessToken = await getValidAccessToken(conn.id)

      // Fetch all authorized payments from the last 3 years
      const threeYearsAgo = new Date()
      threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3)

      const payments = await getAllPayments(accessToken, conn.organization_slug, {
        states: 'Authorized',
        from: threeYearsAgo.toISOString(),
      })

      if (payments.length === 0) {
        await supabase
          .from('helloasso_connections')
          .update({
            sync_status: 'idle',
            last_sync_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', conn.id)

        revalidatePath('/donations')
        return { data: { imported: 0, skipped: 0 } }
      }

      // Fetch existing helloasso_payment_ids to deduplicate
      const paymentIds = payments.map((p) => p.id)
      const { data: existingDonations } = await supabase
        .from('donations')
        .select('helloasso_payment_id')
        .eq('establishment_id', establishmentId)
        .eq('source', 'helloasso')
        .in('helloasso_payment_id', paymentIds)

      const existingPaymentIds = new Set(
        (existingDonations || []).map((d) => d.helloasso_payment_id)
      )

      // Filter out already imported payments
      const newPayments = payments.filter((p) => !existingPaymentIds.has(p.id))

      let imported = 0

      for (const payment of newPayments) {
        // Generate CERFA number for each imported donation
        const { data: cerfaNumber, error: rpcError } = await supabase.rpc(
          'get_next_cerfa_number',
          { est_id: establishmentId }
        )

        if (rpcError) {
          console.error(`Failed to get CERFA number for payment ${payment.id}:`, rpcError.message)
          continue
        }

        // Build donor name from payer info
        const donorName = [payment.payer.firstName, payment.payer.lastName]
          .filter(Boolean)
          .join(' ')
          .trim() || 'Donateur HelloAsso'

        // Build donor address from payer fields
        const donorAddress = payment.payer.address || null
        const donorCity = payment.payer.city || null
        const donorPostalCode = payment.payer.zipCode || null

        // Amount from HelloAsso is in centimes — convert to EUR
        const amountEur = payment.amount / 100

        const donationRecord: Omit<Donation, 'id' | 'created_at' | 'updated_at'> = {
          establishment_id: establishmentId,
          donor_name: donorName,
          donor_email: payment.payer.email || null,
          donor_phone: null,
          donor_address: donorAddress,
          donor_postal_code: donorPostalCode,
          donor_city: donorCity,
          amount: amountEur,
          date: payment.date ? payment.date.split('T')[0] : new Date().toISOString().split('T')[0],
          payment_method: 'helloasso',
          nature: 'numeraire',
          source: 'helloasso',
          helloasso_payment_id: payment.id,
          helloasso_order_id: payment.order?.id ?? null,
          cerfa_number: cerfaNumber,
          cerfa_generated: true,
          cerfa_generated_at: new Date().toISOString(),
          notes: null,
          created_by: null,
        }

        const { error: insertError } = await supabase
          .from('donations')
          .insert(donationRecord)

        if (insertError) {
          console.error(`Failed to insert donation for payment ${payment.id}:`, insertError.message)
          continue
        }

        imported++
      }

      // Mark sync as complete
      await supabase
        .from('helloasso_connections')
        .update({
          sync_status: 'idle',
          last_sync_at: new Date().toISOString(),
          sync_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conn.id)

      revalidatePath('/donations')
      revalidatePath('/dashboard')
      return {
        data: {
          imported,
          skipped: payments.length - newPayments.length,
        },
      }
    } catch (syncError) {
      // Mark sync as failed
      const errorMessage = (syncError as Error).message
      await supabase
        .from('helloasso_connections')
        .update({
          sync_status: 'error',
          sync_error: errorMessage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conn.id)

      return { error: `Erreur de synchronisation: ${errorMessage}` }
    }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ---------------------------------------------------------------------------
// getHelloAssoStats — stats for HelloAsso donations for a given year
// ---------------------------------------------------------------------------

export async function getHelloAssoStats(year?: number) {
  try {
    const { establishmentId } = await requirePermission('manage_donations')
    const supabase = createAdminClient()
    const targetYear = year ?? new Date().getFullYear()

    // Fetch HelloAsso donations for the target year
    const { data: donations, error } = await supabase
      .from('donations')
      .select('amount, date')
      .eq('establishment_id', establishmentId)
      .eq('source', 'helloasso')
      .gte('date', `${targetYear}-01-01`)
      .lte('date', `${targetYear}-12-31`)

    if (error) return { error: error.message }

    const donationList = donations || []

    // Fetch last_sync_at from connection
    const { data: conn } = await supabase
      .from('helloasso_connections')
      .select('last_sync_at')
      .eq('establishment_id', establishmentId)
      .maybeSingle()

    return {
      data: {
        helloassoCount: donationList.length,
        helloassoTotal: donationList.reduce((sum, d) => sum + Number(d.amount), 0),
        lastSyncAt: conn?.last_sync_at ?? null,
      },
    }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
