import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import type { Permission, EstablishmentMember } from '@/lib/types/database'

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

  if (ctx.membership.role === 'admin') return ctx

  const hasPermission = (() => {
    switch (permission) {
      case 'manage_establishment': return ctx.membership.manage_establishment
      case 'manage_documents': return ctx.membership.manage_documents
      case 'manage_clients': return ctx.membership.manage_clients
      case 'manage_animals': return ctx.membership.manage_animals
      case 'view_animals': return ctx.membership.view_animals
      case 'manage_health': return ctx.membership.manage_health
      case 'manage_movements': return ctx.membership.manage_movements
      case 'manage_boxes': return ctx.membership.manage_boxes
      case 'manage_posts': return ctx.membership.manage_posts
      case 'manage_donations': return ctx.membership.manage_donations
      case 'view_pound': return ctx.membership.view_pound
      case 'view_statistics': return ctx.membership.view_statistics
      case 'manage_outings': return ctx.membership.manage_outings
      default: return false
    }
  })()

  if (!hasPermission) {
    throw new Error('Permissions insuffisantes')
  }

  return ctx
}
