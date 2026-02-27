import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import type { Permission, EstablishmentMember, PermissionGroup } from '@/lib/types/database'

const COOKIE_NAME = 'current-establishment-id'

interface AuthContext {
  userId: string
  establishmentId: string
  membership: EstablishmentMember
}

async function resolveAuth(): Promise<AuthContext> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifie')

  const cookieStore = await cookies()
  const establishmentId = cookieStore.get(COOKIE_NAME)?.value

  let membership: EstablishmentMember | null = null

  if (establishmentId) {
    const { data } = await supabase
      .from('establishment_members')
      .select('*')
      .eq('user_id', user.id)
      .eq('establishment_id', establishmentId)
      .single()
    membership = data as EstablishmentMember | null
  }

  // Fallback: pick first establishment if cookie missing or invalid
  if (!membership) {
    const { data } = await supabase
      .from('establishment_members')
      .select('*')
      .eq('user_id', user.id)
      .limit(1)
      .single()
    membership = data as EstablishmentMember | null
  }

  if (!membership) throw new Error('Aucun etablissement selectionne')

  return {
    userId: user.id,
    establishmentId: membership.establishment_id,
    membership,
  }
}

export async function requireEstablishment(): Promise<AuthContext> {
  return resolveAuth()
}

export async function requirePermission(permission: Permission): Promise<AuthContext> {
  const ctx = await resolveAuth()

  // Fetch member's groups
  const supabase = await createClient()
  const { data: memberGroups } = await supabase
    .from('member_groups')
    .select('group_id')
    .eq('member_id', ctx.membership.id)

  const groupIds = (memberGroups || []).map((mg: { group_id: string }) => mg.group_id)

  if (groupIds.length === 0) {
    throw new Error('Permissions insuffisantes')
  }

  const { data: groups } = await supabase
    .from('permission_groups')
    .select('*')
    .in('id', groupIds)

  const hasPermission = (groups as PermissionGroup[] || []).some(
    (g) => g[permission] === true
  )

  if (!hasPermission) {
    throw new Error('Permissions insuffisantes')
  }

  return ctx
}
