'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requirePermission, requireEstablishment } from '@/lib/establishment/permissions'
import type { EstablishmentMember, UnassignedUser, PermissionGroup, Permission } from '@/lib/types/database'

// ============================================================
// Establishment CRUD
// ============================================================

export async function updateEstablishment(data: {
  name: string
  description?: string
  email?: string
  phone?: string
  website?: string
  iban?: string
  bic?: string
  address?: string
  legal_name?: string
  logo_url?: string
}) {
  try {
    const { establishmentId } = await requirePermission('manage_establishment')
    const supabase = await createClient()

    const { error } = await supabase
      .from('establishments')
      .update(data)
      .eq('id', establishmentId)

    if (error) return { error: error.message }

    revalidatePath('/etablissement')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function createEstablishment(data: {
  name: string
  description?: string
  email?: string
  phone?: string
  website?: string
  iban?: string
  bic?: string
  address?: string
  legal_name?: string
}) {
  // Auth check via normal client
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifie' }

  const SUPER_ADMIN_EMAIL = 'clement.scailteux@gmail.com'
  if (user.email !== SUPER_ADMIN_EMAIL) {
    return { error: 'Seul l\'administrateur principal peut creer un etablissement' }
  }

  // Use admin client to bypass RLS for creation
  const admin = createAdminClient()

  const { data: establishment, error } = await admin
    .from('establishments')
    .insert(data)
    .select()
    .single()

  if (error) return { error: error.message }

  // Create default permission groups
  const { data: adminGroup, error: adminGroupError } = await admin
    .from('permission_groups')
    .insert({
      establishment_id: establishment.id,
      name: 'Administrateur',
      description: 'Acces complet a toutes les fonctionnalites',
      is_system: true,
      manage_documents: true,
      manage_clients: true,
      manage_establishment: true,
      manage_animals: true,
      view_animals: true,
      manage_health: true,
      manage_movements: true,
      manage_boxes: true,
      manage_posts: true,
      manage_donations: true,
      manage_outings: true,
      view_pound: true,
      view_statistics: true,
    })
    .select()
    .single()

  if (adminGroupError) return { error: adminGroupError.message }

  await admin
    .from('permission_groups')
    .insert({
      establishment_id: establishment.id,
      name: 'Membre',
      description: 'Acces en lecture seule',
      is_system: false,
      view_animals: true,
      view_pound: true,
      view_statistics: true,
    })

  // Creator becomes member + assigned to admin group
  const { data: member, error: memberError } = await admin
    .from('establishment_members')
    .insert({
      establishment_id: establishment.id,
      user_id: user.id,
    })
    .select()
    .single()

  if (memberError) return { error: memberError.message }

  await admin
    .from('member_groups')
    .insert({
      member_id: member.id,
      group_id: adminGroup.id,
    })

  revalidatePath('/')
  return { data: establishment }
}

// ============================================================
// Permission Groups CRUD
// ============================================================

export async function getPermissionGroups() {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('permission_groups')
      .select('*')
      .eq('establishment_id', establishmentId)
      .order('is_system', { ascending: false })
      .order('name')

    if (error) return { error: error.message }
    return { data: (data as PermissionGroup[]) || [] }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function createPermissionGroup(data: {
  name: string
  description?: string
} & Partial<Record<Permission, boolean>>) {
  try {
    const { establishmentId } = await requirePermission('manage_establishment')
    const admin = createAdminClient()

    const { data: group, error } = await admin
      .from('permission_groups')
      .insert({
        establishment_id: establishmentId,
        name: data.name,
        description: data.description || '',
        manage_documents: data.manage_documents ?? false,
        manage_clients: data.manage_clients ?? false,
        manage_establishment: data.manage_establishment ?? false,
        manage_animals: data.manage_animals ?? false,
        view_animals: data.view_animals ?? false,
        manage_health: data.manage_health ?? false,
        manage_movements: data.manage_movements ?? false,
        manage_boxes: data.manage_boxes ?? false,
        manage_posts: data.manage_posts ?? false,
        manage_donations: data.manage_donations ?? false,
        manage_outings: data.manage_outings ?? false,
        view_pound: data.view_pound ?? false,
        view_statistics: data.view_statistics ?? false,
      })
      .select()
      .single()

    if (error) return { error: error.message }

    revalidatePath('/etablissement')
    return { data: group as PermissionGroup }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function updatePermissionGroup(groupId: string, data: Partial<{
  name: string
  description: string
} & Record<Permission, boolean>>) {
  try {
    await requirePermission('manage_establishment')
    const admin = createAdminClient()

    // Block editing system group name
    const { data: existing } = await admin
      .from('permission_groups')
      .select('is_system')
      .eq('id', groupId)
      .single()

    if (existing?.is_system && data.name) {
      return { error: 'Impossible de renommer un groupe systeme' }
    }

    const { error } = await admin
      .from('permission_groups')
      .update(data)
      .eq('id', groupId)

    if (error) return { error: error.message }

    revalidatePath('/etablissement')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function deletePermissionGroup(groupId: string) {
  try {
    await requirePermission('manage_establishment')
    const admin = createAdminClient()

    // Block deleting system groups
    const { data: existing } = await admin
      .from('permission_groups')
      .select('is_system')
      .eq('id', groupId)
      .single()

    if (existing?.is_system) {
      return { error: 'Impossible de supprimer un groupe systeme' }
    }

    const { error } = await admin
      .from('permission_groups')
      .delete()
      .eq('id', groupId)

    if (error) return { error: error.message }

    revalidatePath('/etablissement')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ============================================================
// Member-Group assignment
// ============================================================

export async function assignMemberToGroup(memberId: string, groupId: string) {
  try {
    await requirePermission('manage_establishment')
    const admin = createAdminClient()

    const { error } = await admin
      .from('member_groups')
      .insert({ member_id: memberId, group_id: groupId })

    if (error) {
      if (error.code === '23505') return { error: 'Deja dans ce groupe' }
      return { error: error.message }
    }

    revalidatePath('/etablissement')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function removeMemberFromGroup(memberId: string, groupId: string) {
  try {
    await requirePermission('manage_establishment')
    const admin = createAdminClient()

    const { error } = await admin
      .from('member_groups')
      .delete()
      .eq('member_id', memberId)
      .eq('group_id', groupId)

    if (error) return { error: error.message }

    revalidatePath('/etablissement')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ============================================================
// Members management
// ============================================================

export async function addMember(email: string, groupIds: string[]) {
  try {
    const { establishmentId } = await requirePermission('manage_establishment')
    const supabase = await createClient()
    const admin = createAdminClient()

    // Lookup user by email via RPC
    const { data: userId, error: lookupError } = await supabase.rpc('get_user_id_by_email', {
      lookup_email: email,
    })

    if (lookupError || !userId) {
      return { error: 'Aucun utilisateur trouve avec cet email' }
    }

    // Check if already member (admin client to avoid RLS recursion)
    const { data: existing } = await admin
      .from('establishment_members')
      .select('id')
      .eq('establishment_id', establishmentId)
      .eq('user_id', userId)
      .single()

    if (existing) {
      return { error: 'Cet utilisateur est deja membre de cet etablissement' }
    }

    const { data: member, error } = await admin
      .from('establishment_members')
      .insert({
        establishment_id: establishmentId,
        user_id: userId,
      })
      .select()
      .single()

    if (error) return { error: error.message }

    // Assign to groups
    if (groupIds.length > 0) {
      const { error: groupError } = await admin
        .from('member_groups')
        .insert(groupIds.map(gid => ({ member_id: member.id, group_id: gid })))

      if (groupError) return { error: groupError.message }
    }

    revalidatePath('/etablissement')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function removeMember(memberId: string) {
  try {
    const { userId, establishmentId } = await requirePermission('manage_establishment')
    const admin = createAdminClient()

    // Fetch member to check
    const { data: member } = await admin
      .from('establishment_members')
      .select('*')
      .eq('id', memberId)
      .eq('establishment_id', establishmentId)
      .single()

    if (!member) return { error: 'Membre introuvable' }

    // Prevent self-removal
    if ((member as EstablishmentMember).user_id === userId) {
      return { error: 'Vous ne pouvez pas vous retirer vous-meme' }
    }

    const { error } = await admin
      .from('establishment_members')
      .delete()
      .eq('id', memberId)

    if (error) return { error: error.message }

    revalidatePath('/etablissement')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function getEstablishmentMembers() {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = await createClient()

    const { data: members, error } = await supabase
      .from('establishment_members')
      .select('*')
      .eq('establishment_id', establishmentId)
      .order('created_at')

    if (error) return { error: error.message }

    const typedMembers = (members as EstablishmentMember[]) || []

    // Enrich with user info (email, name, avatar) via SECURITY DEFINER RPC
    if (typedMembers.length > 0) {
      const userIds = typedMembers.map(m => m.user_id)
      const { data: usersInfo } = await supabase.rpc('get_users_info', {
        user_ids: userIds,
      })

      if (usersInfo && Array.isArray(usersInfo)) {
        const userMap = new Map(
          usersInfo.map((u: { id: string; email: string; full_name: string | null; avatar_url: string | null }) => [u.id, u])
        )
        for (const member of typedMembers) {
          const info = userMap.get(member.user_id)
          if (info) {
            member.email = info.email
            member.full_name = info.full_name
            member.avatar_url = info.avatar_url
          }
        }
      }

      // Enrich with groups
      const memberIds = typedMembers.map(m => m.id)
      const { data: allMemberGroups } = await supabase
        .from('member_groups')
        .select('member_id, group_id')
        .in('member_id', memberIds)

      if (allMemberGroups && allMemberGroups.length > 0) {
        const allGroupIds = [...new Set(allMemberGroups.map((mg: { group_id: string }) => mg.group_id))]
        const { data: groups } = await supabase
          .from('permission_groups')
          .select('*')
          .in('id', allGroupIds)

        const groupMap = new Map((groups as PermissionGroup[] || []).map(g => [g.id, g]))

        for (const member of typedMembers) {
          const memberGroupIds = allMemberGroups
            .filter((mg: { member_id: string }) => mg.member_id === member.id)
            .map((mg: { group_id: string }) => mg.group_id)
          member.groups = memberGroupIds
            .map((gid: string) => groupMap.get(gid))
            .filter(Boolean) as PermissionGroup[]
        }
      } else {
        for (const member of typedMembers) {
          member.groups = []
        }
      }
    }

    return { data: typedMembers }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function getUnassignedUsers() {
  try {
    await requirePermission('manage_establishment')
    const supabase = await createClient()

    const { data, error } = await supabase.rpc('get_unassigned_users')

    if (error) return { error: error.message }

    return { data: (data as UnassignedUser[]) || [] }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function getInvitableUsers() {
  try {
    const { establishmentId } = await requirePermission('manage_establishment')
    const admin = createAdminClient()

    // Get all platform users via admin auth API
    const { data: { users }, error: usersError } = await admin.auth.admin.listUsers()
    if (usersError) return { error: usersError.message }

    // Get current establishment members
    const { data: members } = await admin
      .from('establishment_members')
      .select('user_id')
      .eq('establishment_id', establishmentId)

    const memberUserIds = new Set((members || []).map((m: { user_id: string }) => m.user_id))

    // Filter out existing members, return the rest
    const invitable = users
      .filter(u => !memberUserIds.has(u.id))
      .map(u => ({
        id: u.id,
        email: u.email || '',
        full_name: (u.user_metadata?.full_name || u.user_metadata?.name || null) as string | null,
        avatar_url: (u.user_metadata?.avatar_url || null) as string | null,
        created_at: u.created_at,
      }))

    return { data: invitable }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function addMemberById(userId: string, groupIds: string[]) {
  try {
    const { establishmentId } = await requirePermission('manage_establishment')
    const admin = createAdminClient()

    // Check if already member of THIS establishment
    const { data: existing } = await admin
      .from('establishment_members')
      .select('id')
      .eq('establishment_id', establishmentId)
      .eq('user_id', userId)
      .single()

    if (existing) {
      return { error: 'Cet utilisateur est deja membre de cet etablissement' }
    }

    const { data: member, error } = await admin
      .from('establishment_members')
      .insert({
        establishment_id: establishmentId,
        user_id: userId,
      })
      .select()
      .single()

    if (error) return { error: error.message }

    // Assign to groups
    if (groupIds.length > 0) {
      const { error: groupError } = await admin
        .from('member_groups')
        .insert(groupIds.map(gid => ({ member_id: member.id, group_id: gid })))

      if (groupError) return { error: groupError.message }
    }

    revalidatePath('/etablissement')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function addPendingUser(userId: string, groupIds: string[]) {
  try {
    const { establishmentId } = await requirePermission('manage_establishment')
    // Use admin client to bypass RLS (self-referencing policies cause infinite recursion)
    const admin = createAdminClient()

    // Check if already member
    const { data: existing } = await admin
      .from('establishment_members')
      .select('id')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (existing) {
      return { error: 'Cet utilisateur est deja membre d\'un etablissement' }
    }

    const { data: member, error } = await admin
      .from('establishment_members')
      .insert({
        establishment_id: establishmentId,
        user_id: userId,
      })
      .select()
      .single()

    if (error) return { error: error.message }

    // Assign to groups
    if (groupIds.length > 0) {
      const { error: groupError } = await admin
        .from('member_groups')
        .insert(groupIds.map(gid => ({ member_id: member.id, group_id: gid })))

      if (groupError) return { error: groupError.message }
    }

    revalidatePath('/etablissement')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
