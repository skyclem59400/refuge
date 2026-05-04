'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const UpdateCommuneSchema = z.object({
  code_insee: z.string().min(5).max(5),
  convention_status: z.enum(['active', 'pending', 'none', 'terminated']),
  convention_start_date: z.string().nullable(),
  convention_end_date: z.string().nullable(),
  convention_contact_name: z.string().max(120).nullable(),
  convention_contact_email: z.string().email().nullable().or(z.literal('')),
  convention_contact_phone: z.string().max(40).nullable(),
  convention_yearly_fee: z.number().nullable(),
  day_intervention_fee: z.number().nullable(),
  night_intervention_fee: z.number().nullable(),
  notes: z.string().max(2000).nullable(),
})

export type UpdateCommuneState =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; message: string }

export async function updateCommune(
  _prev: UpdateCommuneState,
  formData: FormData
): Promise<UpdateCommuneState> {
  // Vérification user authentifié
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { status: 'error', message: 'Vous devez être connecté.' }
  }

  function num(val: FormDataEntryValue | null): number | null {
    if (!val || val === '') return null
    const n = parseFloat(String(val))
    return Number.isFinite(n) ? n : null
  }

  function str(val: FormDataEntryValue | null): string | null {
    if (!val || val === '') return null
    return String(val).trim()
  }

  const parsed = UpdateCommuneSchema.safeParse({
    code_insee: formData.get('code_insee'),
    convention_status: formData.get('convention_status'),
    convention_start_date: str(formData.get('convention_start_date')),
    convention_end_date: str(formData.get('convention_end_date')),
    convention_contact_name: str(formData.get('convention_contact_name')),
    convention_contact_email: str(formData.get('convention_contact_email')) || '',
    convention_contact_phone: str(formData.get('convention_contact_phone')),
    convention_yearly_fee: num(formData.get('convention_yearly_fee')),
    day_intervention_fee: num(formData.get('day_intervention_fee')),
    night_intervention_fee: num(formData.get('night_intervention_fee')),
    notes: str(formData.get('notes')),
  })

  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Données invalides.',
    }
  }

  const { code_insee, ...payload } = parsed.data
  const cleanPayload = {
    ...payload,
    convention_contact_email: payload.convention_contact_email || null,
  }

  // Update via admin client (les RLS authentifiées seraient OK aussi mais on bypass pour fiabilité côté server action)
  const admin = createAdminClient()
  const { error } = await admin
    .from('astreinte_municipalities')
    .update(cleanPayload)
    .eq('code_insee', code_insee)

  if (error) {
    console.error('[astreinte/communes/update]', error)
    return { status: 'error', message: 'Erreur lors de la sauvegarde.' }
  }

  revalidatePath('/astreinte/communes')
  revalidatePath(`/astreinte/communes/${code_insee}`)

  return { status: 'success' }
}
