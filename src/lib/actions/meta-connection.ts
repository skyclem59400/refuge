'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/establishment/permissions'
import type { MetaConnection } from '@/lib/types/database'

export async function getMetaConnection() {
  try {
    const { establishmentId } = await requirePermission('manage_posts')
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('meta_connections')
      .select('*')
      .eq('establishment_id', establishmentId)
      .maybeSingle()

    if (error) return { error: error.message }
    return { data: data as MetaConnection | null }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function saveMetaConnection(data: {
  facebook_page_id: string
  facebook_page_name: string
  facebook_page_access_token: string
  instagram_business_account_id?: string | null
  token_expires_at?: string | null
}) {
  try {
    const { userId, establishmentId } = await requirePermission('manage_establishment')
    const supabase = createAdminClient()

    const { data: connection, error } = await supabase
      .from('meta_connections')
      .upsert({
        establishment_id: establishmentId,
        facebook_page_id: data.facebook_page_id,
        facebook_page_name: data.facebook_page_name,
        facebook_page_access_token: data.facebook_page_access_token,
        instagram_business_account_id: data.instagram_business_account_id || null,
        token_expires_at: data.token_expires_at || null,
        connected_by: userId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'establishment_id' })
      .select()
      .single()

    if (error) return { error: error.message }

    revalidatePath('/publications')
    revalidatePath('/etablissement')
    return { data: connection }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function deleteMetaConnection() {
  try {
    const { establishmentId } = await requirePermission('manage_establishment')
    const supabase = createAdminClient()

    const { error } = await supabase
      .from('meta_connections')
      .delete()
      .eq('establishment_id', establishmentId)

    if (error) return { error: error.message }

    revalidatePath('/publications')
    revalidatePath('/etablissement')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
