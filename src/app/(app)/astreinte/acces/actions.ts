'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export type ActionState =
  | { status: 'idle' }
  | { status: 'success'; message?: string }
  | { status: 'error'; message: string }

async function requireAuthenticatedUserId(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

// ============================================================================
// DOMAINES
// ============================================================================

const AddDomainSchema = z.object({
  domain: z
    .string()
    .min(3)
    .max(253)
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, 'Domaine invalide.')
    .transform((d) => d.toLowerCase().trim()),
  scope_type: z.enum(['municipality', 'epci', 'national_force', 'organization', 'veterinary']),
  municipality_code_insee: z.string().nullable().optional(),
  organization_label: z.string().max(120).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
})

export async function addAuthorizedDomain(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireAuthenticatedUserId()
  if (!userId) return { status: 'error', message: 'Non authentifié.' }

  const parsed = AddDomainSchema.safeParse({
    domain: formData.get('domain'),
    scope_type: formData.get('scope_type'),
    municipality_code_insee: formData.get('municipality_code_insee') || null,
    organization_label: formData.get('organization_label') || null,
    notes: formData.get('notes') || null,
  })

  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Données invalides.' }
  }

  const admin = createAdminClient()
  const { error } = await admin.from('astreinte_authorized_domains').insert({
    ...parsed.data,
    validated_by: userId,
    active: true,
  })

  if (error) {
    if (error.code === '23505') {
      return { status: 'error', message: 'Ce domaine est déjà dans la liste.' }
    }
    console.error('[astreinte/acces/addDomain]', error)
    return { status: 'error', message: 'Erreur lors de l’ajout.' }
  }

  revalidatePath('/astreinte/acces')
  return { status: 'success', message: `Domaine ${parsed.data.domain} ajouté.` }
}

export async function toggleDomainActive(domain: string, active: boolean): Promise<void> {
  const userId = await requireAuthenticatedUserId()
  if (!userId) return

  const admin = createAdminClient()
  await admin.from('astreinte_authorized_domains').update({ active }).eq('domain', domain)
  revalidatePath('/astreinte/acces')
}

export async function deleteDomain(domain: string): Promise<void> {
  const userId = await requireAuthenticatedUserId()
  if (!userId) return

  const admin = createAdminClient()
  await admin.from('astreinte_authorized_domains').delete().eq('domain', domain)
  revalidatePath('/astreinte/acces')
}

// ============================================================================
// EMAILS
// ============================================================================

const AddEmailSchema = z.object({
  email: z
    .string()
    .email('Adresse email invalide.')
    .max(254)
    .transform((e) => e.toLowerCase().trim()),
  scope_type: z.enum(['municipality', 'veterinary', 'other']),
  municipality_code_insee: z.string().nullable().optional(),
  full_name: z.string().max(120).nullable().optional(),
  role: z.string().max(80).nullable().optional(),
  organization_label: z.string().max(120).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
})

export async function addAuthorizedEmail(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireAuthenticatedUserId()
  if (!userId) return { status: 'error', message: 'Non authentifié.' }

  const parsed = AddEmailSchema.safeParse({
    email: formData.get('email'),
    scope_type: formData.get('scope_type'),
    municipality_code_insee: formData.get('municipality_code_insee') || null,
    full_name: formData.get('full_name') || null,
    role: formData.get('role') || null,
    organization_label: formData.get('organization_label') || null,
    notes: formData.get('notes') || null,
  })

  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Données invalides.' }
  }

  const admin = createAdminClient()
  const { error } = await admin.from('astreinte_authorized_emails').insert({
    ...parsed.data,
    validated_by: userId,
    active: true,
  })

  if (error) {
    if (error.code === '23505') {
      return { status: 'error', message: 'Cet email est déjà dans la liste.' }
    }
    console.error('[astreinte/acces/addEmail]', error)
    return { status: 'error', message: 'Erreur lors de l’ajout.' }
  }

  revalidatePath('/astreinte/acces')
  return { status: 'success', message: `Email ${parsed.data.email} ajouté.` }
}

export async function toggleEmailActive(email: string, active: boolean): Promise<void> {
  const userId = await requireAuthenticatedUserId()
  if (!userId) return

  const admin = createAdminClient()
  await admin.from('astreinte_authorized_emails').update({ active }).eq('email', email)
  revalidatePath('/astreinte/acces')
}

export async function deleteEmail(email: string): Promise<void> {
  const userId = await requireAuthenticatedUserId()
  if (!userId) return

  const admin = createAdminClient()
  await admin.from('astreinte_authorized_emails').delete().eq('email', email)
  revalidatePath('/astreinte/acces')
}
