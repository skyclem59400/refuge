import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import type { Establishment, EstablishmentMember, EstablishmentContext, Permissions, PermissionGroup } from '@/lib/types/database'

const COOKIE_NAME = 'current-establishment-id'

function buildPermissions(groups: PermissionGroup[]): Permissions {
  const has = (field: keyof PermissionGroup) =>
    groups.some(g => g[field] === true)

  return {
    isAdmin: groups.some(g => g.is_system && g.name === 'Administrateur'),
    canManageEstablishment: has('manage_establishment'),
    canManageDocuments: has('manage_documents'),
    canManageClients: has('manage_clients'),
    canManageAnimals: has('manage_animals'),
    canViewAnimals: has('manage_animals') || has('view_animals'),
    canManageHealth: has('manage_health'),
    canManageMovements: has('manage_movements'),
    canManageBoxes: has('manage_boxes'),
    canManagePosts: has('manage_posts'),
    canManageDonations: has('manage_donations'),
    canManageOutings: has('manage_outings'),
    canViewPound: has('view_pound'),
    canViewStatistics: has('view_statistics'),
  }
}

async function fetchMemberGroups(supabase: Awaited<ReturnType<typeof createClient>>, memberId: string): Promise<PermissionGroup[]> {
  const { data: memberGroups } = await supabase
    .from('member_groups')
    .select('group_id')
    .eq('member_id', memberId)

  const groupIds = (memberGroups || []).map((mg: { group_id: string }) => mg.group_id)
  if (groupIds.length === 0) return []

  const { data: groups } = await supabase
    .from('permission_groups')
    .select('*')
    .in('id', groupIds)

  return (groups as PermissionGroup[]) || []
}

export async function getCurrentEstablishmentId(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(COOKIE_NAME)?.value || null
}

export async function getUserEstablishments(): Promise<{ establishments: Establishment[]; memberships: EstablishmentMember[] }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { establishments: [], memberships: [] }

  const { data: memberships } = await supabase
    .from('establishment_members')
    .select('*')
    .eq('user_id', user.id)

  if (!memberships || memberships.length === 0) {
    return { establishments: [], memberships: [] }
  }

  const estabIds = memberships.map(m => m.establishment_id)
  const { data: establishments } = await supabase
    .from('establishments')
    .select('*')
    .in('id', estabIds)
    .order('name')

  return {
    establishments: (establishments as Establishment[]) || [],
    memberships: memberships as EstablishmentMember[],
  }
}

export async function getEstablishmentContext(): Promise<EstablishmentContext | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const currentId = await getCurrentEstablishmentId()

  // Try to find membership for the current cookie value
  let membership: EstablishmentMember | null = null
  if (currentId) {
    const { data } = await supabase
      .from('establishment_members')
      .select('*')
      .eq('user_id', user.id)
      .eq('establishment_id', currentId)
      .single()
    membership = data as EstablishmentMember | null
  }

  // Fallback: pick first establishment
  if (!membership) {
    const { data } = await supabase
      .from('establishment_members')
      .select('*')
      .eq('user_id', user.id)
      .limit(1)
      .single()
    membership = data as EstablishmentMember | null
  }

  if (!membership) return null

  // Fetch establishment
  const { data: establishment } = await supabase
    .from('establishments')
    .select('*')
    .eq('id', membership.establishment_id)
    .single()

  if (!establishment) return null

  // Set cookie if different
  if (membership.establishment_id !== currentId) {
    const cookieStore = await cookies()
    try {
      cookieStore.set(COOKIE_NAME, membership.establishment_id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
      })
    } catch {
      // Called from Server Component — ignore
    }
  }

  // Fetch member's groups and build permissions
  const groups = await fetchMemberGroups(supabase, membership.id)

  return {
    establishment: establishment as Establishment,
    membership,
    permissions: buildPermissions(groups),
  }
}
