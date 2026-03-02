'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { requireEstablishment } from '@/lib/establishment/permissions'

// ---------------------------------------------------------------------------
// logActivity — fire-and-forget audit log entry
// ---------------------------------------------------------------------------

export async function logActivity(params: {
  action: 'create' | 'update' | 'delete' | 'assign'
  entityType: string
  entityId?: string
  entityName?: string
  parentType?: string
  parentId?: string
  details?: Record<string, unknown>
}): Promise<void> {
  try {
    const { userId, establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    await supabase.from('activity_logs').insert({
      establishment_id: establishmentId,
      user_id: userId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      entity_name: params.entityName ?? null,
      parent_type: params.parentType ?? null,
      parent_id: params.parentId ?? null,
      details: params.details ?? {},
    })
  } catch {
    // Fire-and-forget: never block the main action
  }
}

// ---------------------------------------------------------------------------
// getActivityLogs — admin only, fetch activity logs with filters
// ---------------------------------------------------------------------------

export async function getActivityLogs(filters?: {
  entityType?: string
  entityId?: string
  parentType?: string
  parentId?: string
  userId?: string
  limit?: number
}) {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    let query = supabase
      .from('activity_logs')
      .select('*')
      .eq('establishment_id', establishmentId)

    if (filters?.entityType) {
      query = query.eq('entity_type', filters.entityType)
    }
    if (filters?.entityId) {
      query = query.eq('entity_id', filters.entityId)
    }
    if (filters?.parentType) {
      query = query.eq('parent_type', filters.parentType)
    }
    if (filters?.parentId) {
      query = query.eq('parent_id', filters.parentId)
    }
    if (filters?.userId) {
      query = query.eq('user_id', filters.userId)
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(filters?.limit ?? 100)

    if (error) return { error: error.message }
    return { data }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
