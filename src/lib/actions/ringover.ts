'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireEstablishment, requirePermission } from '@/lib/establishment/permissions'
import type { RingoverConnection, RingoverCall, RingoverNumber } from '@/lib/types/database'

const RINGOVER_API_BASE = 'https://public-api.ringover.com/v2'

// ---------------------------------------------------------------------------
// getRingoverConnection — fetch connection for the current establishment
// ---------------------------------------------------------------------------

export async function getRingoverConnection() {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('ringover_connections')
      .select('*')
      .eq('establishment_id', establishmentId)
      .maybeSingle()

    if (error) return { error: error.message }
    return { data: data as RingoverConnection | null }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ---------------------------------------------------------------------------
// saveRingoverConnection — save/update API key and validate
// ---------------------------------------------------------------------------

export async function saveRingoverConnection(data: {
  api_key: string
  astreinte_number?: string | null
  astreinte_label?: string | null
}) {
  try {
    const { establishmentId } = await requirePermission('manage_establishment')
    const supabase = createAdminClient()

    // Save the connection — validation will happen when loading numbers or syncing
    const { data: connection, error } = await supabase
      .from('ringover_connections')
      .upsert(
        {
          establishment_id: establishmentId,
          api_key: data.api_key,
          astreinte_number: data.astreinte_number || null,
          astreinte_label: data.astreinte_label || null,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'establishment_id' }
      )
      .select()
      .single()

    if (error) return { error: error.message }

    revalidatePath('/pound')
    revalidatePath('/pound/interventions')
    revalidatePath('/appels')
    return { data: connection as RingoverConnection }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ---------------------------------------------------------------------------
// disconnectRingover — delete connection
// ---------------------------------------------------------------------------

export async function disconnectRingover() {
  try {
    const { establishmentId } = await requirePermission('manage_establishment')
    const supabase = createAdminClient()

    const { error } = await supabase
      .from('ringover_connections')
      .delete()
      .eq('establishment_id', establishmentId)

    if (error) return { error: error.message }

    revalidatePath('/pound')
    revalidatePath('/pound/interventions')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ---------------------------------------------------------------------------
// getRingoverNumbers — list available phone numbers/lines
// ---------------------------------------------------------------------------

export async function getRingoverNumbers() {
  try {
    const { establishmentId } = await requirePermission('manage_establishment')
    const supabase = createAdminClient()

    const { data: conn } = await supabase
      .from('ringover_connections')
      .select('api_key')
      .eq('establishment_id', establishmentId)
      .single()

    if (!conn) return { error: 'Ringover non configure' }

    const response = await fetch(`${RINGOVER_API_BASE}/numbers`, {
      headers: { Authorization: conn.api_key },
    })

    if (!response.ok) {
      return { error: `Erreur Ringover API (${response.status})` }
    }

    const body = await response.json()

    // Transform Ringover response to simplified format
    const numbers: RingoverNumber[] = []

    // Ringover /numbers returns a nested structure with number_list
    const numberList = body?.number_list || body?.numbers || []
    if (Array.isArray(numberList)) {
      for (const item of numberList) {
        numbers.push({
          number: item.number || item.format_e164 || '',
          label: item.label || item.alias || item.number || '',
          type: item.type || 'unknown',
        })
      }
    }

    return { data: numbers }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ---------------------------------------------------------------------------
// getRecentAstreinteCalls — fetch recent incoming calls on astreinte line
// ---------------------------------------------------------------------------

export async function getRecentAstreinteCalls() {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    const { data: conn } = await supabase
      .from('ringover_connections')
      .select('*')
      .eq('establishment_id', establishmentId)
      .eq('is_active', true)
      .maybeSingle()

    if (!conn || !conn.astreinte_number) {
      return { data: [] }
    }

    // Fetch recent calls via GET /calls with query parameters
    const params = new URLSearchParams({
      limit_count: '20',
      limit_offset: '0',
    })
    const response = await fetch(`${RINGOVER_API_BASE}/calls?${params}`, {
      headers: {
        Authorization: conn.api_key.trim(),
      },
    })

    if (!response.ok) {
      console.error('[Ringover] Failed to fetch calls:', response.status)
      return { data: [] }
    }

    const body = await response.json()
    const callList = body?.call_list || body?.calls || []

    const astreinteNum = (conn.astreinte_number || '').replace(/[^0-9+]/g, '')

    const calls: RingoverCall[] = []
    if (Array.isArray(callList)) {
      for (const call of callList) {
        // Client-side filter: only keep calls involving the astreinte number
        const from = String(call.from_number || '').replace(/[^0-9+]/g, '')
        const to = String(call.to_number || '').replace(/[^0-9+]/g, '')
        if (astreinteNum && !from.includes(astreinteNum) && !to.includes(astreinteNum)) {
          continue
        }
        calls.push({
          call_id: String(call.cdr_id || call.call_id || ''),
          direction: call.direction || 'in',
          from_number: call.from_number || call.caller_number || '',
          from_name: call.from_name || call.caller_name || call.contact_name || null,
          to_number: call.to_number || call.callee_number || conn.astreinte_number,
          start_time: call.start_date || call.start_time || '',
          duration: call.duration || 0,
          status: call.status || call.call_status || '',
        })
      }
    }

    return { data: calls }
  } catch (e) {
    console.error('[Ringover] Error fetching calls:', e)
    return { data: [] }
  }
}
