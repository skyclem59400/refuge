'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission, requireEstablishment } from '@/lib/establishment/permissions'
import type { EstablishmentMember } from '@/lib/types/database'

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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifie' }

  const { data: establishment, error } = await supabase
    .from('establishments')
    .insert(data)
    .select()
    .single()

  if (error) return { error: error.message }

  // Creator becomes admin
  const { error: memberError } = await supabase
    .from('establishment_members')
    .insert({
      establishment_id: establishment.id,
      user_id: user.id,
      role: 'admin',
      manage_documents: true,
      manage_clients: true,
      manage_establishment: true,
    })

  if (memberError) return { error: memberError.message }

  revalidatePath('/')
  return { data: establishment }
}

export async function addMember(email: string, permissions: {
  manage_documents?: boolean
  manage_clients?: boolean
  manage_establishment?: boolean
}) {
  try {
    const { establishmentId } = await requirePermission('manage_establishment')
    const supabase = await createClient()

    // Lookup user by email via RPC
    const { data: userId, error: lookupError } = await supabase.rpc('get_user_id_by_email', {
      lookup_email: email,
    })

    if (lookupError || !userId) {
      return { error: 'Aucun utilisateur trouve avec cet email' }
    }

    // Check if already member
    const { data: existing } = await supabase
      .from('establishment_members')
      .select('id')
      .eq('establishment_id', establishmentId)
      .eq('user_id', userId)
      .single()

    if (existing) {
      return { error: 'Cet utilisateur est deja membre de cet etablissement' }
    }

    const { error } = await supabase
      .from('establishment_members')
      .insert({
        establishment_id: establishmentId,
        user_id: userId,
        role: 'member',
        manage_documents: permissions.manage_documents ?? false,
        manage_clients: permissions.manage_clients ?? false,
        manage_establishment: permissions.manage_establishment ?? false,
      })

    if (error) return { error: error.message }

    revalidatePath('/etablissement')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function updateMemberPermissions(memberId: string, permissions: {
  manage_documents?: boolean
  manage_clients?: boolean
  manage_establishment?: boolean
}) {
  try {
    await requirePermission('manage_establishment')
    const supabase = await createClient()

    const { error } = await supabase
      .from('establishment_members')
      .update(permissions)
      .eq('id', memberId)

    if (error) return { error: error.message }

    revalidatePath('/etablissement')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function removeMember(memberId: string) {
  try {
    const { userId, establishmentId } = await requirePermission('manage_establishment')
    const supabase = await createClient()

    // Fetch member to check
    const { data: member } = await supabase
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

    const { error } = await supabase
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
    }

    return { data: typedMembers }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
