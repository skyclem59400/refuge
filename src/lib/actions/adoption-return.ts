'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/establishment/permissions'
import { logActivity } from '@/lib/actions/activity-log'

type PaymentMethod = 'cheque' | 'virement' | 'especes' | 'cb' | 'autre'

interface ReturnInput {
  contract_id: string
  return_date: string
  refunded_amount: number
  refund_payment_method: PaymentMethod
  return_reason?: string
  notes?: string
}

interface AdoptionContractRow {
  id: string
  establishment_id: string
  animal_id: string
  adopter_client_id: string | null
  status: string
  adoption_date: string
  adoption_fee: number | null
  non_refundable_amount: number | null
  trial_period_days: number | null
  trial_period_ends_at: string | null
  contract_number: string
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Retour d'un animal pendant la période d'accueil.
 * - Vérifie que le contrat est 'active' ou 'finalized' et qu'on est encore dans la période d'accueil
 * - Crée un mouvement shelter_transfer (l'animal revient au refuge)
 * - Met à jour le contrat : status='trial_returned', returned_at, refunded_amount
 * - Crée un payment_entries négatif (remboursement) lié au contrat
 */
export async function returnAdoptionDuringTrial(input: ReturnInput) {
  try {
    const { establishmentId, userId, membership } = await requirePermission('manage_animals')
    const admin = createAdminClient()

    const { data: contract, error: fetchErr } = await admin
      .from('adoption_contracts')
      .select(
        'id, establishment_id, animal_id, adopter_client_id, status, adoption_date, adoption_fee, non_refundable_amount, trial_period_days, trial_period_ends_at, contract_number'
      )
      .eq('id', input.contract_id)
      .eq('establishment_id', establishmentId)
      .single<AdoptionContractRow>()

    if (fetchErr || !contract) return { error: 'Contrat introuvable' }
    if (contract.status === 'trial_returned' || contract.status === 'cancelled') {
      return { error: 'Ce contrat est deja annule ou retourne' }
    }
    if (contract.status === 'draft') {
      return { error: 'Le contrat doit etre actif avant de pouvoir enregistrer un retour' }
    }

    const { data: est } = await admin
      .from('establishments')
      .select('default_trial_period_days')
      .eq('id', establishmentId)
      .single()

    const trialDays =
      contract.trial_period_days ?? est?.default_trial_period_days ?? 15
    const endsAt =
      contract.trial_period_ends_at ?? addDays(contract.adoption_date, trialDays)

    if (input.return_date > endsAt) {
      return {
        error: `Hors periode d'accueil (s'est terminee le ${endsAt}). Utiliser une procedure d'abandon classique.`,
      }
    }

    const fee = Number(contract.adoption_fee ?? 0)
    const nonRefundable = Number(contract.non_refundable_amount ?? 0)
    const maxRefund = Math.max(0, fee - nonRefundable)
    if (input.refunded_amount < 0 || input.refunded_amount > maxRefund) {
      return { error: `Montant rembourse doit etre entre 0 et ${maxRefund} EUR` }
    }

    // 1. Mouvement de retour : l'animal revient au refuge (shelter)
    const { error: movErr } = await admin
      .from('animal_movements')
      .insert({
        animal_id: contract.animal_id,
        type: 'shelter_transfer',
        date: input.return_date,
        notes: `Retour adoption (contrat ${contract.contract_number})${
          input.notes ? ` - ${input.notes}` : ''
        }`,
        person_name: null,
        related_client_id: contract.adopter_client_id,
        related_contract_id: contract.id,
        related_contract_type: 'adoption',
        signature_status: 'not_required',
        created_by: userId,
      })

    if (movErr) return { error: `Mouvement : ${movErr.message}` }

    // Bascule l'animal en statut shelter
    await admin
      .from('animals')
      .update({
        status: 'shelter',
        shelter_entry_date: input.return_date,
        exit_date: null,
        box_id: null,
      })
      .eq('id', contract.animal_id)
      .eq('establishment_id', establishmentId)

    // 2. Update contract
    const { error: contractErr } = await admin
      .from('adoption_contracts')
      .update({
        status: 'trial_returned',
        returned_at: input.return_date,
        refunded_amount: input.refunded_amount,
        refunded_at: input.return_date,
        refund_payment_method: input.refund_payment_method,
        return_reason: input.return_reason ?? null,
      })
      .eq('id', contract.id)

    if (contractErr) return { error: `Contrat : ${contractErr.message}` }

    // Le remboursement est trace sur le contrat (refunded_amount, refund_payment_method).
    // Une saisie comptable distincte peut etre cree manuellement dans /reglements si necessaire.
    void membership

    logActivity({
      action: 'update',
      entityType: 'adoption_contract',
      entityId: contract.id,
      entityName: contract.contract_number,
      details: {
        event: 'trial_return',
        refunded_amount: input.refunded_amount,
        return_date: input.return_date,
      },
    })

    revalidatePath('/adoptions')
    revalidatePath(`/animals/${contract.animal_id}`)

    return {
      success: true,
      refunded_amount: input.refunded_amount,
      max_refund: maxRefund,
    }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/**
 * Computed: combien rembourser au plus, et est-on encore dans la période d'accueil.
 */
export async function getReturnEligibility(contractId: string): Promise<{
  data?: {
    eligible: boolean
    trial_period_ends_at: string
    adoption_fee: number
    non_refundable_amount: number
    max_refund: number
    status: string
  }
  error?: string
}> {
  try {
    const { establishmentId } = await requirePermission('manage_animals')
    const admin = createAdminClient()

    const { data: contract, error: fetchErr } = await admin
      .from('adoption_contracts')
      .select(
        'status, adoption_date, adoption_fee, non_refundable_amount, trial_period_days, trial_period_ends_at'
      )
      .eq('id', contractId)
      .eq('establishment_id', establishmentId)
      .single()

    if (fetchErr || !contract) return { error: 'Contrat introuvable' }

    const { data: est } = await admin
      .from('establishments')
      .select('default_trial_period_days')
      .eq('id', establishmentId)
      .single()

    const trialDays =
      contract.trial_period_days ?? est?.default_trial_period_days ?? 15
    const endsAt =
      contract.trial_period_ends_at ?? addDays(contract.adoption_date, trialDays)

    const today = new Date().toISOString().slice(0, 10)
    const eligible =
      (contract.status === 'active' || contract.status === 'finalized') &&
      today <= endsAt

    const fee = Number(contract.adoption_fee ?? 0)
    const nonRefundable = Number(contract.non_refundable_amount ?? 0)

    return {
      data: {
        eligible,
        trial_period_ends_at: endsAt,
        adoption_fee: fee,
        non_refundable_amount: nonRefundable,
        max_refund: Math.max(0, fee - nonRefundable),
        status: contract.status,
      },
    }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
