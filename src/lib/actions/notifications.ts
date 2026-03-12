'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireEstablishment } from '@/lib/establishment/permissions'
import type { Notification, NotificationPreferences, NotificationType, Permission } from '@/lib/types/database'

// ============================================
// Read actions (use createAdminClient)
// ============================================

export async function getNotifications(filters?: {
  unreadOnly?: boolean
  limit?: number
}) {
  try {
    const { userId, establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('establishment_id', establishmentId)
      .eq('user_id', userId)

    if (filters?.unreadOnly) {
      query = query.eq('read', false)
    }

    query = query.order('created_at', { ascending: false })

    if (filters?.limit) {
      query = query.limit(filters.limit)
    }

    const { data, error } = await query

    if (error) return { error: error.message }
    return { data: data as Notification[] }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function getUnreadCount() {
  try {
    const { userId, establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('establishment_id', establishmentId)
      .eq('user_id', userId)
      .eq('read', false)

    if (error) return { error: error.message }
    return { data: count ?? 0 }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ============================================
// Write actions (use createClient)
// ============================================

export async function markNotificationRead(id: string) {
  try {
    const { userId, establishmentId } = await requireEstablishment()
    const supabase = await createClient()

    const { error } = await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .eq('establishment_id', establishmentId)

    if (error) return { error: error.message }
    return { data: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function markAllRead() {
  try {
    const { userId, establishmentId } = await requireEstablishment()
    const supabase = await createClient()

    const { error } = await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('establishment_id', establishmentId)
      .eq('read', false)

    if (error) return { error: error.message }
    return { data: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ============================================
// Internal actions (use createAdminClient)
// ============================================

export async function createNotification(params: {
  userId: string
  type: NotificationType
  title: string
  body?: string
  link?: string
  metadata?: Record<string, unknown>
}) {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('notifications')
      .insert({
        establishment_id: establishmentId,
        user_id: params.userId,
        type: params.type,
        title: params.title,
        body: params.body || null,
        link: params.link || null,
        metadata: params.metadata || {},
      })
      .select()
      .single()

    if (error) return { error: error.message }
    return { data: data as Notification }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function notifyAdminsWithPermission(params: {
  permission: Permission
  type: NotificationType
  title: string
  body?: string
  link?: string
  metadata?: Record<string, unknown>
}) {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = createAdminClient()

    // Get all permission groups for this establishment that have the specified permission
    const { data: groups, error: groupsError } = await supabase
      .from('permission_groups')
      .select('id')
      .eq('establishment_id', establishmentId)
      .eq(params.permission, true)

    if (groupsError) return { error: groupsError.message }
    if (!groups || groups.length === 0) return { data: [] }

    const groupIds = groups.map((g) => g.id)

    // Get all member_groups linked to these permission groups
    const { data: memberGroups, error: memberGroupsError } = await supabase
      .from('member_groups')
      .select('member_id')
      .in('group_id', groupIds)

    if (memberGroupsError) return { error: memberGroupsError.message }
    if (!memberGroups || memberGroups.length === 0) return { data: [] }

    const memberIds = [...new Set(memberGroups.map((mg) => mg.member_id))]

    // Get distinct user_ids from establishment_members
    const { data: members, error: membersError } = await supabase
      .from('establishment_members')
      .select('user_id')
      .in('id', memberIds)
      .eq('establishment_id', establishmentId)

    if (membersError) return { error: membersError.message }
    if (!members || members.length === 0) return { data: [] }

    const userIds = [...new Set(members.map((m) => m.user_id))]

    // Create a notification for each user
    const notifications = userIds.map((userId) => ({
      establishment_id: establishmentId,
      user_id: userId,
      type: params.type,
      title: params.title,
      body: params.body || null,
      link: params.link || null,
      metadata: params.metadata || {},
    }))

    const { data, error } = await supabase
      .from('notifications')
      .insert(notifications)
      .select()

    if (error) return { error: error.message }
    return { data: data as Notification[] }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ============================================
// Notification Preferences
// ============================================

export async function getNotificationPreferences() {
  try {
    const { userId } = await requireEstablishment()
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error && error.code === 'PGRST116') {
      // No row found — return defaults
      return {
        data: {
          id: '',
          user_id: userId,
          email_enabled: true,
          push_enabled: false,
          push_subscription: null,
          leave_email: true,
          leave_push: false,
          payslip_email: true,
          payslip_push: false,
          created_at: '',
          updated_at: '',
        } as NotificationPreferences,
      }
    }

    if (error) return { error: error.message }
    return { data: data as NotificationPreferences }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function updateNotificationPreferences(
  data: Partial<Omit<NotificationPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
) {
  try {
    const { userId } = await requireEstablishment()
    const supabase = await createClient()

    const { data: result, error } = await supabase
      .from('notification_preferences')
      .upsert(
        {
          user_id: userId,
          ...data,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single()

    if (error) return { error: error.message }
    return { data: result as NotificationPreferences }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
