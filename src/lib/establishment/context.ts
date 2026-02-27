import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import type { Establishment, EstablishmentMember, EstablishmentContext, Permissions } from '@/lib/types/database'

const COOKIE_NAME = 'current-establishment-id'

function buildPermissions(member: EstablishmentMember): Permissions {
  const isAdmin = member.role === 'admin'
  return {
    isAdmin,
    canManageEstablishment: isAdmin || member.manage_establishment,
    canManageDocuments: isAdmin || member.manage_documents,
    canManageClients: isAdmin || member.manage_clients,
    canManageAnimals: isAdmin || member.manage_animals,
    canViewAnimals: isAdmin || member.view_animals,
    canManageHealth: isAdmin || member.manage_health,
    canManageMovements: isAdmin || member.manage_movements,
    canManageBoxes: isAdmin || member.manage_boxes,
    canManagePosts: isAdmin || member.manage_posts,
    canManageDonations: isAdmin || member.manage_donations,
    canManageOutings: isAdmin || member.manage_outings,
    canViewPound: isAdmin || member.view_pound,
    canViewStatistics: isAdmin || member.view_statistics,
  }
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

  return {
    establishment: establishment as Establishment,
    membership,
    permissions: buildPermissions(membership),
  }
}
