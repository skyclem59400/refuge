'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireEstablishment, requirePermission } from '@/lib/establishment/permissions'
import type {
  CallStatus,
  CallLogWithCategory,
  CallCategory,
  AgentSession,
  CallTranscript,
} from '@/lib/types/database'

// ============================================
// Read actions (use createAdminClient)
// ============================================

export async function getAllCalls(filters?: { status?: CallStatus; category_id?: string }) {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    let query = supabase
      .from('call_logs')
      .select('*, category:call_categories(*)')
      .eq('establishment_id', establishmentId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    if (filters?.category_id) {
      query = query.eq('category_id', filters.category_id)
    }

    const { data, error } = await query
    if (error) return { error: error.message }
    return { data: data as CallLogWithCategory[] }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function getCallById(id: string) {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('call_logs')
      .select('*, category:call_categories(*)')
      .eq('id', id)
      .eq('establishment_id', establishmentId)
      .single()

    if (error) return { error: error.message }
    return { data: data as CallLogWithCategory }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function getCallTranscripts(callId: string) {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    // Verify the call belongs to this establishment
    const { data: call, error: callError } = await supabase
      .from('call_logs')
      .select('id')
      .eq('id', callId)
      .eq('establishment_id', establishmentId)
      .single()

    if (callError || !call) {
      return { error: 'Appel introuvable' }
    }

    const { data, error } = await supabase
      .from('call_transcripts')
      .select('*')
      .eq('call_log_id', callId)
      .order('timestamp_ms', { ascending: true })

    if (error) return { error: error.message }
    return { data: data as CallTranscript[] }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function getAgentSessions() {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('agent_sessions')
      .select('*')
      .eq('establishment_id', establishmentId)
      .order('last_active_at', { ascending: false })

    if (error) return { error: error.message }
    return { data: data as AgentSession[] }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function getCallCategories() {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('call_categories')
      .select('*')
      .eq('establishment_id', establishmentId)
      .order('name', { ascending: true })

    if (error) return { error: error.message }
    return { data: data as CallCategory[] }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function getCallStats() {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    // Get all calls for the establishment
    const { data: calls, error } = await supabase
      .from('call_logs')
      .select('status, duration_seconds, callback_needed, callback_completed')
      .eq('establishment_id', establishmentId)

    if (error) return { error: error.message }

    const total = calls?.length ?? 0
    const inProgress = calls?.filter(c => c.status === 'in_progress').length ?? 0
    const completedCalls = calls?.filter(c => c.status === 'completed' && c.duration_seconds > 0) ?? []
    const avgDuration = completedCalls.length > 0
      ? Math.round(completedCalls.reduce((sum, c) => sum + c.duration_seconds, 0) / completedCalls.length)
      : 0
    const callbackNeeded = calls?.filter(c => c.callback_needed && !c.callback_completed).length ?? 0

    return {
      data: {
        total,
        inProgress,
        avgDuration,
        callbackNeeded,
      },
    }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ============================================
// Write actions
// ============================================

export async function markCallbackCompleted(callId: string) {
  try {
    const { userId, establishmentId } = await requirePermission('manage_establishment')
    const supabase = createAdminClient()

    // Verify the call belongs to this establishment
    const { data: call, error: callError } = await supabase
      .from('call_logs')
      .select('id')
      .eq('id', callId)
      .eq('establishment_id', establishmentId)
      .single()

    if (callError || !call) {
      return { error: 'Appel introuvable' }
    }

    const { data, error } = await supabase
      .from('call_logs')
      .update({
        callback_completed: true,
        callback_completed_at: new Date().toISOString(),
        callback_completed_by: userId,
      })
      .eq('id', callId)
      .select()
      .single()

    if (error) return { error: error.message }

    revalidatePath('/appels')
    return { data }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function seedDefaultCategories() {
  try {
    const { establishmentId } = await requirePermission('manage_establishment')
    const supabase = createAdminClient()

    // Check if categories already exist
    const { data: existing, error: checkError } = await supabase
      .from('call_categories')
      .select('id')
      .eq('establishment_id', establishmentId)
      .limit(1)

    if (checkError) return { error: checkError.message }

    if (existing && existing.length > 0) {
      return { error: 'Des categories existent deja pour cet etablissement' }
    }

    // Call the SQL function to seed default categories
    const { error } = await supabase.rpc('seed_call_categories', {
      est_id: establishmentId,
    })

    if (error) return { error: error.message }

    revalidatePath('/appels')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
