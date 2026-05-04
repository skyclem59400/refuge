'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requirePermission, requireEstablishment } from '@/lib/establishment/permissions'
import { logActivity } from '@/lib/actions/activity-log'
import type { EstablishmentMember, PermissionGroup, Permission } from '@/lib/types/database'

function stripAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function generatePseudoEmail(pseudo: string): string {
  const clean = stripAccents(pseudo.trim().toLowerCase()).replace(/[^a-z0-9]/g, '-')
  const random = Math.random().toString(36).substring(2, 8)
  return `${clean}-${random}@refuge.internal`
}

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
  siret?: string
  logo_url?: string
  google_calendar_id?: string
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
    logActivity({ action: 'update', entityType: 'establishment', details: { nom: data.name } })
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
      manage_outing_assignments: true,
      manage_adoptions: true,
      manage_veterinarians: true,
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

  // Best-effort : créer un dossier Documenso pour ranger les contrats signés.
  // Dynamic import pour ne pas charger Documenso au build time.
  try {
    const { ensureDocumensoFolder } = await import('@/lib/establishment/documenso-folder')
    await ensureDocumensoFolder(establishment.id, establishment.name)
  } catch (e) {
    console.error('[createEstablishment] documenso folder bootstrap failed:', e)
  }

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
        manage_outing_assignments: data.manage_outing_assignments ?? false,
        manage_adoptions: data.manage_adoptions ?? false,
        manage_veterinarians: data.manage_veterinarians ?? false,
        view_pound: data.view_pound ?? false,
        view_statistics: data.view_statistics ?? false,
      })
      .select()
      .single()

    if (error) return { error: error.message }

    revalidatePath('/etablissement')
    logActivity({ action: 'create', entityType: 'permission_group', entityId: group.id, entityName: data.name })
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

    // Pas de revalidatePath('/etablissement') ici : il déclenchait un re-fetch
    // complet de la page (members, groupes, counts...) qui bloquait l'UI ~30s
    // à chaque toggle de permission. L'UI front gère déjà l'optimistic update.
    // Les autres pages relisent les permissions au prochain chargement.
    logActivity({ action: 'update', entityType: 'permission_group', entityId: groupId, entityName: data.name })
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
      .select('is_system, name')
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

    logActivity({ action: 'delete', entityType: 'permission_group', entityId: groupId, entityName: existing?.name })
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
    logActivity({ action: 'assign', entityType: 'member', entityId: memberId, details: { groupe_id: groupId } })
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
    logActivity({ action: 'update', entityType: 'member', entityId: memberId, details: { retire_du_groupe: groupId } })
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
    logActivity({ action: 'create', entityType: 'member', entityId: member.id, entityName: email })
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
    const typedMember = member as EstablishmentMember
    if (typedMember.user_id === userId) {
      return { error: 'Vous ne pouvez pas vous retirer vous-meme' }
    }

    const isPseudoUser = typedMember.is_pseudo_user
    const memberUserId = typedMember.user_id

    const { error } = await admin
      .from('establishment_members')
      .delete()
      .eq('id', memberId)

    if (error) return { error: error.message }

    // If pseudo user, delete the generated auth user if no other memberships
    if (isPseudoUser) {
      const { data: otherMemberships } = await admin
        .from('establishment_members')
        .select('id')
        .eq('user_id', memberUserId)
        .limit(1)

      if (!otherMemberships || otherMemberships.length === 0) {
        await admin.auth.admin.deleteUser(memberUserId)
      }
    }

    revalidatePath('/etablissement')
    logActivity({
      action: 'delete',
      entityType: 'member',
      entityId: memberId,
      entityName: typedMember.full_name || typedMember.pseudo || typedMember.email || undefined,
    })
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

function enrichMembersWithUserInfo(
  members: EstablishmentMember[],
  usersInfo: { id: string; email: string; full_name: string | null; avatar_url: string | null }[]
) {
  const userMap = new Map(usersInfo.map(u => [u.id, u]))
  for (const member of members) {
    const info = userMap.get(member.user_id)
    if (info) {
      member.email = info.email
      member.full_name = info.full_name
      member.avatar_url = info.avatar_url
    }
  }
}

function enrichMembersWithGroups(
  members: EstablishmentMember[],
  allMemberGroups: { member_id: string; group_id: string }[],
  groupMap: Map<string, PermissionGroup>
) {
  for (const member of members) {
    const memberGroupIds = allMemberGroups
      .filter(mg => mg.member_id === member.id)
      .map(mg => mg.group_id)
    member.groups = memberGroupIds
      .map(gid => groupMap.get(gid))
      .filter(Boolean) as PermissionGroup[]
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

    if (typedMembers.length === 0) return { data: typedMembers }

    // Enrich with user info (email, name, avatar) via SECURITY DEFINER RPC
    const userIds = typedMembers.map(m => m.user_id)
    const { data: usersInfo } = await supabase.rpc('get_users_info', {
      user_ids: userIds,
    })

    if (usersInfo && Array.isArray(usersInfo)) {
      enrichMembersWithUserInfo(typedMembers, usersInfo)
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
      enrichMembersWithGroups(typedMembers, allMemberGroups, groupMap)
    } else {
      for (const member of typedMembers) {
        member.groups = []
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
    const admin = createAdminClient()

    // Get all platform users
    const { data: { users }, error: usersError } = await admin.auth.admin.listUsers()
    if (usersError) return { error: usersError.message }

    // Get ALL establishment members (across all establishments)
    const { data: allMembers } = await admin
      .from('establishment_members')
      .select('user_id')

    const memberUserIds = new Set((allMembers || []).map((m: { user_id: string }) => m.user_id))

    // Only return users who have NO establishment membership at all
    // and who are NOT pseudo users (have a real email, not @refuge.internal)
    const unassigned = users
      .filter(u => !memberUserIds.has(u.id) && u.email && !u.email.endsWith('@refuge.internal'))
      .map(u => ({
        id: u.id,
        email: u.email || '',
        full_name: (u.user_metadata?.full_name || u.user_metadata?.name || null) as string | null,
        avatar_url: (u.user_metadata?.avatar_url || null) as string | null,
        created_at: u.created_at,
      }))

    return { data: unassigned }
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
    logActivity({ action: 'create', entityType: 'member', entityId: member.id })
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
    logActivity({ action: 'create', entityType: 'member', entityId: member.id })
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ============================================================
// Pseudo-based member management
// ============================================================

export async function createPseudoMember(data: {
  pseudo: string
  roleType: 'salarie' | 'benevole'
  groupIds: string[]
}) {
  try {
    const { establishmentId } = await requirePermission('manage_establishment')
    const admin = createAdminClient()

    const pseudoLower = data.pseudo.trim().toLowerCase()

    // Check for duplicate pseudo + role_type in this establishment
    const { data: existing } = await admin
      .from('establishment_members')
      .select('id')
      .eq('establishment_id', establishmentId)
      .eq('pseudo', pseudoLower)
      .eq('role_type', data.roleType)
      .eq('is_pseudo_user', true)
      .limit(1)
      .single()

    if (existing) {
      return { error: `Un ${data.roleType === 'salarie' ? 'salarie' : 'benevole'} avec le pseudo "${data.pseudo}" existe deja` }
    }

    // Generate invisible email
    const generatedEmail = generatePseudoEmail(data.pseudo)

    // Create Supabase auth user (no password yet - user sets it on first login)
    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email: generatedEmail,
      email_confirm: true,
      user_metadata: {
        pseudo: pseudoLower,
        role_type: data.roleType,
        full_name: data.pseudo.trim(),
      },
    })

    if (authError) {
      console.error('Failed to create auth user:', authError)
      return { error: 'Erreur lors de la creation du compte' }
    }

    // Create establishment_members row
    const { data: member, error: memberError } = await admin
      .from('establishment_members')
      .insert({
        establishment_id: establishmentId,
        user_id: authUser.user.id,
        pseudo: pseudoLower,
        role_type: data.roleType,
        is_pseudo_user: true,
        password_set: false,
      })
      .select()
      .single()

    if (memberError) {
      // Rollback: delete the auth user
      await admin.auth.admin.deleteUser(authUser.user.id)
      return { error: memberError.message }
    }

    // Assign to permission groups
    if (data.groupIds.length > 0) {
      const { error: groupError } = await admin
        .from('member_groups')
        .insert(data.groupIds.map(gid => ({ member_id: member.id, group_id: gid })))

      if (groupError) {
        console.error('Failed to assign groups:', groupError)
      }
    }

    revalidatePath('/etablissement')
    logActivity({ action: 'create', entityType: 'member', entityId: member.id, entityName: data.pseudo })
    return { success: true, pseudo: pseudoLower }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function resetPseudoPassword(memberId: string) {
  try {
    await requirePermission('manage_establishment')
    const admin = createAdminClient()

    const { data: member, error: memberError } = await admin
      .from('establishment_members')
      .select('id, user_id, is_pseudo_user')
      .eq('id', memberId)
      .single()

    if (memberError || !member) return { error: 'Membre introuvable' }
    if (!member.is_pseudo_user) return { error: 'Ce membre n\'utilise pas l\'authentification par pseudo' }

    await admin
      .from('establishment_members')
      .update({ password_set: false })
      .eq('id', memberId)

    revalidatePath('/etablissement')
    logActivity({ action: 'update', entityType: 'member', entityId: memberId, details: { action: 'reset_password' } })
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
