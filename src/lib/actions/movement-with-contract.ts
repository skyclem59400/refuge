'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/establishment/permissions'
import { logActivity } from '@/lib/actions/activity-log'
import { recordMovement } from '@/lib/actions/animals'
import { createFosterContract } from '@/lib/actions/foster-contracts'
import { createAdoptionContract } from '@/lib/actions/adoption-contracts'
import { sendContractForSignature } from '@/lib/actions/foster-contract-signature'
import { sendAdoptionContractForSignature } from '@/lib/actions/adoption-contract-signature'
import type { AnimalStatus, IcadStatus } from '@/lib/types/database'

// ============================================
// Foster placement: movement + foster_contract + Documenso send
// ============================================

export interface FosterPlacementInput {
  animalId: string
  date: string
  notes?: string | null
  icadStatus?: IcadStatus
  fosterClientId: string
  // Contract terms
  startDate: string
  expectedEndDate?: string | null
  vetCostsCoveredByShelter?: boolean
  foodProvidedByShelter?: boolean
  insuranceRequired?: boolean
  householdConsent?: boolean
  otherAnimalsAtHome?: string | null
  specialConditions?: string | null
  signedAtLocation?: string | null
  // Optional: skip electronic signature (paper fallback)
  skipElectronicSignature?: boolean
}

export async function recordFosterPlacementWithContract(input: FosterPlacementInput) {
  try {
    // Permission check + email validation
    const { establishmentId } = await requirePermission('manage_movements')
    const admin = createAdminClient()

    const { data: foster } = await admin
      .from('clients')
      .select('id, name, email')
      .eq('id', input.fosterClientId)
      .eq('establishment_id', establishmentId)
      .single()

    if (!foster) {
      return { error: "Famille d'accueil introuvable" }
    }
    if (!input.skipElectronicSignature && !foster.email?.trim()) {
      return { error: "L'email de la famille d'accueil est obligatoire pour la signature électronique. Renseignez-le dans le répertoire ou cochez la signature papier." }
    }

    // 1. Create the foster_contract in draft
    const contractRes = await createFosterContract({
      animal_id: input.animalId,
      foster_client_id: input.fosterClientId,
      start_date: input.startDate,
      expected_end_date: input.expectedEndDate ?? null,
      status: 'draft',
      vet_costs_covered_by_shelter: input.vetCostsCoveredByShelter ?? true,
      food_provided_by_shelter: input.foodProvidedByShelter ?? false,
      insurance_required: input.insuranceRequired ?? false,
      household_consent: input.householdConsent ?? false,
      other_animals_at_home: input.otherAnimalsAtHome ?? null,
      special_conditions: input.specialConditions ?? null,
      signed_at_location: input.signedAtLocation ?? null,
    })

    if (contractRes.error || !contractRes.data) {
      return { error: `Création du contrat impossible : ${contractRes.error ?? 'inconnu'}` }
    }
    const contract = contractRes.data

    // 2. Create the movement linked to the contract — pending signature
    const wantsSignature = !input.skipElectronicSignature
    const movementRes = await recordMovement(input.animalId, {
      type: 'foster_placement',
      date: input.date,
      notes: input.notes ?? null,
      person_name: foster.name,
      person_contact: foster.email ?? null,
      icad_status: input.icadStatus ?? 'pending',
      related_client_id: foster.id,
      signature_status: wantsSignature ? 'pending' : 'not_required',
      related_contract_id: contract.id,
      related_contract_type: 'foster',
    })

    if (movementRes.error || !movementRes.data) {
      // Best-effort cleanup: delete the orphan contract
      await admin.from('foster_contracts').delete().eq('id', contract.id)
      return { error: `Création du mouvement impossible : ${movementRes.error}` }
    }

    // 3. Send the contract for electronic signature (if not skipped)
    if (wantsSignature) {
      const sendRes = await sendContractForSignature(contract.id)
      if (sendRes.error) {
        // Movement + contract were persisted with signature_status='pending',
        // but Documenso send failed so the contract has no documenso_document_id.
        // Surface this loudly to the user so they can retry from the timeline.
        return {
          data: {
            movementId: movementRes.data.id,
            contractId: contract.id,
            warning: `⚠️ Le mouvement et le contrat ont été créés mais l'envoi pour signature a échoué : ${sendRes.error}\n\nLe mouvement reste en attente. Cliquez sur "Renvoyer email" sur la timeline pour relancer la signature, ou "Annuler" pour supprimer le tout.`,
          },
        }
      }
    }

    revalidatePath(`/animals/${input.animalId}`)
    return {
      data: {
        movementId: movementRes.data.id,
        contractId: contract.id,
      },
    }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ============================================
// Adoption: movement + adoption_contract + Documenso send
// ============================================

export interface AdoptionInput {
  animalId: string
  date: string
  notes?: string | null
  icadStatus?: IcadStatus
  adopterClientId: string
  adoptionFee?: number
  sterilizationRequired?: boolean
  sterilizationDeadline?: string | null
  sterilizationDeposit?: number | null
  visitRightClause?: boolean
  nonResaleClause?: boolean
  shelterReturnClause?: boolean
  householdAcknowledgment?: boolean
  specialConditions?: string | null
  signedAtLocation?: string | null
  skipElectronicSignature?: boolean
}

export async function recordAdoptionWithContract(input: AdoptionInput) {
  try {
    const { establishmentId } = await requirePermission('manage_movements')
    const admin = createAdminClient()

    const { data: adopter } = await admin
      .from('clients')
      .select('id, name, email')
      .eq('id', input.adopterClientId)
      .eq('establishment_id', establishmentId)
      .single()

    if (!adopter) {
      return { error: 'Adoptant introuvable' }
    }
    if (!input.skipElectronicSignature && !adopter.email?.trim()) {
      return { error: "L'email de l'adoptant est obligatoire pour la signature électronique. Renseignez-le dans le répertoire ou cochez la signature papier." }
    }

    const contractRes = await createAdoptionContract({
      animal_id: input.animalId,
      adopter_client_id: input.adopterClientId,
      adoption_date: input.date,
      adoption_fee: input.adoptionFee ?? 0,
      status: 'draft',
      sterilization_required: input.sterilizationRequired ?? true,
      sterilization_deadline: input.sterilizationDeadline ?? null,
      sterilization_deposit: input.sterilizationDeposit ?? null,
      visit_right_clause: input.visitRightClause ?? true,
      non_resale_clause: input.nonResaleClause ?? true,
      shelter_return_clause: input.shelterReturnClause ?? true,
      household_acknowledgment: input.householdAcknowledgment ?? false,
      special_conditions: input.specialConditions ?? null,
      signed_at_location: input.signedAtLocation ?? null,
    })

    if (contractRes.error || !contractRes.data) {
      return { error: `Création du contrat impossible : ${contractRes.error ?? 'inconnu'}` }
    }
    const contract = contractRes.data

    const wantsSignature = !input.skipElectronicSignature
    const movementRes = await recordMovement(input.animalId, {
      type: 'adoption',
      date: input.date,
      notes: input.notes ?? null,
      person_name: adopter.name,
      person_contact: adopter.email ?? null,
      icad_status: input.icadStatus ?? 'pending',
      related_client_id: adopter.id,
      signature_status: wantsSignature ? 'pending' : 'not_required',
      related_contract_id: contract.id,
      related_contract_type: 'adoption',
    })

    if (movementRes.error || !movementRes.data) {
      await admin.from('adoption_contracts').delete().eq('id', contract.id)
      return { error: `Création du mouvement impossible : ${movementRes.error}` }
    }

    if (wantsSignature) {
      const sendRes = await sendAdoptionContractForSignature(contract.id)
      if (sendRes.error) {
        return {
          data: {
            movementId: movementRes.data.id,
            contractId: contract.id,
            warning: `⚠️ Le mouvement et le contrat d'adoption ont été créés mais l'envoi pour signature a échoué : ${sendRes.error}\n\nLe mouvement reste en attente. Cliquez sur "Renvoyer email" sur la timeline pour relancer, ou "Annuler" pour supprimer le tout.`,
          },
        }
      }
    }

    revalidatePath(`/animals/${input.animalId}`)
    return {
      data: {
        movementId: movementRes.data.id,
        contractId: contract.id,
      },
    }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ============================================
// Finalisation : when a contract is signed, propagate to the linked movement
// (set signature_status='signed' + apply the animal status change that was
// pending). Called by the Documenso webhook AND by manual sign actions.
// ============================================

const movementStatusMap: Record<string, AnimalStatus> = {
  shelter_transfer: 'shelter',
  foster_placement: 'foster_family',
  adoption: 'adopted',
  return_to_owner: 'returned',
  transfer_out: 'transferred',
  death: 'deceased',
  euthanasia: 'euthanized',
}

export async function finalizeMovementOnSignature(params: {
  contractId: string
  contractType: 'foster' | 'adoption'
  status: 'signed' | 'rejected' | 'cancelled'
}) {
  const admin = createAdminClient()

  const { data: movements } = await admin
    .from('animal_movements')
    .select('id, animal_id, type, date, signature_status')
    .eq('related_contract_id', params.contractId)
    .eq('related_contract_type', params.contractType)
    .eq('signature_status', 'pending')

  if (!movements || movements.length === 0) return { ignored: 'no pending movement linked' }

  for (const mv of movements) {
    const { error: updErr } = await admin
      .from('animal_movements')
      .update({ signature_status: params.status })
      .eq('id', mv.id)
    if (updErr) {
      console.error('finalizeMovementOnSignature: update movement failed', updErr.message)
      continue
    }

    if (params.status !== 'signed') continue

    // Apply the animal status change that was deferred at movement creation
    const newStatus = movementStatusMap[mv.type]
    if (!newStatus) continue

    const updateData: Record<string, string | null> = { status: newStatus }
    const exitTypes = ['adoption', 'return_to_owner', 'transfer_out', 'death', 'euthanasia']
    if (exitTypes.includes(mv.type)) {
      updateData.exit_date = mv.date
    }

    const { error: animUpdErr } = await admin
      .from('animals')
      .update(updateData)
      .eq('id', mv.animal_id)

    if (animUpdErr) {
      console.error('finalizeMovementOnSignature: animal status update failed', animUpdErr.message)
      continue
    }

    revalidatePath(`/animals/${mv.animal_id}`)
    logActivity({
      action: 'update',
      entityType: 'movement',
      entityId: mv.id,
      parentType: 'animal',
      parentId: mv.animal_id,
      details: { signature_status: params.status },
    })
  }

  return { ok: true, processed: movements.length }
}

// ============================================
// Manual override : mark a pending movement as signed (paper fallback) and
// optionally upload the scanned PDF to the contract bucket.
// ============================================

export async function markMovementSignedManually(params: {
  movementId: string
  scannedPdfBase64?: string | null
  scannedPdfFileName?: string | null
}) {
  try {
    const { establishmentId } = await requirePermission('manage_movements')
    const admin = createAdminClient()
    const supabase = await createClient()

    const { data: movement } = await admin
      .from('animal_movements')
      .select('id, animal_id, type, related_contract_id, related_contract_type, signature_status')
      .eq('id', params.movementId)
      .single()

    if (!movement) return { error: 'Mouvement introuvable' }

    // Verify the animal belongs to the user's establishment
    const { data: animal } = await admin
      .from('animals')
      .select('id, establishment_id')
      .eq('id', movement.animal_id)
      .single()
    if (!animal || animal.establishment_id !== establishmentId) {
      return { error: 'Mouvement hors de votre établissement' }
    }

    if (movement.signature_status !== 'pending') {
      return { error: `Ce mouvement n'est pas en attente de signature (statut actuel : ${movement.signature_status})` }
    }

    // Optionally upload the scanned signed PDF to the right bucket
    let signedPdfUrl: string | null = null
    if (params.scannedPdfBase64 && movement.related_contract_id && movement.related_contract_type) {
      const bucketName = movement.related_contract_type === 'adoption' ? 'adoption-contracts' : 'foster-contracts'
      const fileName = params.scannedPdfFileName?.replace(/[^a-zA-Z0-9._-]/g, '_') || `signed_${movement.related_contract_id}_${Date.now()}.pdf`
      const finalName = `manual_${movement.related_contract_id}_${Date.now()}_${fileName}`
      const buf = Buffer.from(params.scannedPdfBase64, 'base64')
      const { data: upload, error: uploadErr } = await admin.storage
        .from(bucketName)
        .upload(finalName, buf, { contentType: 'application/pdf', upsert: false })
      if (uploadErr) {
        return { error: `Échec de l'upload du PDF scanné : ${uploadErr.message}` }
      }
      const { data: pub } = admin.storage.from(bucketName).getPublicUrl(upload.path)
      signedPdfUrl = pub.publicUrl

      // Update the linked contract row too
      const contractTable = movement.related_contract_type === 'adoption' ? 'adoption_contracts' : 'foster_contracts'
      await admin
        .from(contractTable)
        .update({
          signature_status: 'signed',
          signed_pdf_url: signedPdfUrl,
          signed_at_via_documenso: new Date().toISOString(),
        })
        .eq('id', movement.related_contract_id)
    }

    // Finalise the movement (which will apply the animal status)
    if (movement.related_contract_id && movement.related_contract_type) {
      await finalizeMovementOnSignature({
        contractId: movement.related_contract_id,
        contractType: movement.related_contract_type,
        status: 'signed',
      })
    } else {
      // No linked contract: just unblock the movement directly
      await supabase.from('animal_movements').update({ signature_status: 'signed' }).eq('id', params.movementId)
    }

    revalidatePath(`/animals/${movement.animal_id}`)
    return { data: { signedPdfUrl } }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ============================================
// Admin delete : remove any movement (active or pending) and its linked
// contract if any. Reserved to administrators of the establishment.
// Does NOT roll back the animal's current status — the admin is expected to
// manually fix the status afterwards if needed.
// ============================================

export async function deleteMovementAsAdmin(movementId: string) {
  try {
    const ctx = await requirePermission('manage_movements')
    if (!ctx.groups?.some((g) => g.is_system && g.name === 'Administrateur')) {
      return { error: 'Suppression réservée aux administrateurs de l\'établissement' }
    }

    const admin = createAdminClient()
    const supabase = await createClient()

    const { data: movement } = await admin
      .from('animal_movements')
      .select('id, animal_id, type, related_contract_id, related_contract_type')
      .eq('id', movementId)
      .single()

    if (!movement) return { error: 'Mouvement introuvable' }

    const { data: animal } = await admin
      .from('animals')
      .select('id, establishment_id')
      .eq('id', movement.animal_id)
      .single()
    if (!animal || animal.establishment_id !== ctx.establishmentId) {
      return { error: 'Mouvement hors de votre établissement' }
    }

    // Delete the linked contract row (the storage PDF stays as orphan,
    // Supabase blocks direct storage.objects deletes).
    if (movement.related_contract_id && movement.related_contract_type) {
      const contractTable = movement.related_contract_type === 'adoption' ? 'adoption_contracts' : 'foster_contracts'
      await admin.from(contractTable).delete().eq('id', movement.related_contract_id)
    }

    const { error: delErr } = await supabase
      .from('animal_movements')
      .delete()
      .eq('id', movementId)

    if (delErr) return { error: delErr.message }

    revalidatePath(`/animals/${movement.animal_id}`)
    logActivity({
      action: 'delete',
      entityType: 'movement',
      entityId: movementId,
      parentType: 'animal',
      parentId: movement.animal_id,
      details: { reason: 'admin_manual_delete', type: movement.type },
    })
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ============================================
// Cancel a pending movement (deletes the contract too)
// ============================================

export async function cancelPendingMovement(movementId: string) {
  try {
    const { establishmentId } = await requirePermission('manage_movements')
    const admin = createAdminClient()
    const supabase = await createClient()

    const { data: movement } = await admin
      .from('animal_movements')
      .select('id, animal_id, related_contract_id, related_contract_type, signature_status')
      .eq('id', movementId)
      .single()

    if (!movement) return { error: 'Mouvement introuvable' }

    const { data: animal } = await admin
      .from('animals')
      .select('id, establishment_id')
      .eq('id', movement.animal_id)
      .single()
    if (!animal || animal.establishment_id !== establishmentId) {
      return { error: 'Mouvement hors de votre établissement' }
    }

    if (movement.signature_status !== 'pending') {
      return { error: `Ce mouvement n'est pas en attente (statut : ${movement.signature_status})` }
    }

    // Delete the linked contract (best-effort)
    if (movement.related_contract_id && movement.related_contract_type) {
      const contractTable = movement.related_contract_type === 'adoption' ? 'adoption_contracts' : 'foster_contracts'
      await admin.from(contractTable).delete().eq('id', movement.related_contract_id)
    }

    // Delete the movement row entirely (it was never legally effective)
    const { error: delErr } = await supabase
      .from('animal_movements')
      .delete()
      .eq('id', movementId)

    if (delErr) return { error: delErr.message }

    revalidatePath(`/animals/${movement.animal_id}`)
    logActivity({
      action: 'delete',
      entityType: 'movement',
      entityId: movementId,
      parentType: 'animal',
      parentId: movement.animal_id,
      details: { reason: 'pending_signature_cancelled' },
    })
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
