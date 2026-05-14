/**
 * Logique de finalisation d'une adoption "active" :
 *  - étiqueter l'adoptant (Adoptant + Adhérent)
 *  - générer la facture (ligne adoption + ligne adhésion 30 €)
 *  - générer le reçu fiscal CERFA pour les 30 € d'adhésion
 *
 * Idempotente : on ne crée pas deux fois la facture ou la donation pour
 * un même contrat (vérifie via la colonne `documents.notes` qui contient
 * la référence du contrat). Best-effort : un échec d'une étape ne casse
 * pas les autres.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { getClientDisplayName } from '@/lib/types/database'

export const ADHESION_AMOUNT_EUR = 30

interface FinalizeResult {
  invoiceId: string | null
  invoiceNumber: string | null
  donationId: string | null
  donationCerfaNumber: string | null
  warnings: string[]
}

interface AdoptionContractRow {
  id: string
  contract_number: string
  establishment_id: string
  animal_id: string
  adopter_client_id: string | null
  adoption_date: string
  adoption_fee: number | null
  status: string
  created_by: string | null
}

const ADOPTION_REF_TAG = 'astreinte-adoption-ref'

export async function finalizeAdoption(
  contractId: string
): Promise<FinalizeResult> {
  const admin = createAdminClient()
  const result: FinalizeResult = {
    invoiceId: null,
    invoiceNumber: null,
    donationId: null,
    donationCerfaNumber: null,
    warnings: [],
  }

  const { data: contract } = await admin
    .from('adoption_contracts')
    .select(
      'id, contract_number, establishment_id, animal_id, adopter_client_id, adoption_date, adoption_fee, status, created_by'
    )
    .eq('id', contractId)
    .single<AdoptionContractRow>()

  if (!contract) {
    result.warnings.push('Contrat introuvable')
    return result
  }

  if (contract.status !== 'active') {
    return result // contrat encore en draft : rien à faire
  }

  const adoptionFee = Number(contract.adoption_fee ?? 0)
  if (adoptionFee <= 0) {
    return result // pas de paiement → rien à facturer
  }

  if (!contract.adopter_client_id) {
    result.warnings.push('Aucun adoptant rattaché — impossible de finaliser.')
    return result
  }

  // 1. Étiqueter le contact (Adoptant + Adhérent)
  try {
    const { data: existing } = await admin
      .from('clients')
      .select('id, name, email, phone, address, postal_code, city, member_since, is_adopter, is_member')
      .eq('id', contract.adopter_client_id)
      .single()

    if (existing) {
      const updates: Record<string, unknown> = {}
      if (!existing.is_adopter) updates.is_adopter = true
      if (!existing.is_member) updates.is_member = true
      if (!existing.member_since) updates.member_since = contract.adoption_date

      if (Object.keys(updates).length > 0) {
        await admin
          .from('clients')
          .update(updates)
          .eq('id', contract.adopter_client_id)
      }
    }
  } catch (err) {
    console.error('[adoption] tag contact failed:', err)
    result.warnings.push('Étiquetage Adoptant/Adhérent échoué.')
  }

  // 2. Récupérer le contact + l'animal pour les libellés
  const [{ data: contact }, { data: animal }] = await Promise.all([
    admin
      .from('clients')
      .select('id, kind, name, first_name, email, phone, address, postal_code, city')
      .eq('id', contract.adopter_client_id)
      .single(),
    admin
      .from('animals')
      .select('name, species')
      .eq('id', contract.animal_id)
      .single(),
  ])

  if (!contact) {
    result.warnings.push('Adoptant introuvable.')
    return result
  }

  const animalName = animal?.name ?? '—'
  const adoptionLabel = `Adoption de ${animalName}`
  const adhesionLabel = "Adhésion annuelle SDA"
  const adoptionLineAmount = Math.max(0, adoptionFee - ADHESION_AMOUNT_EUR)

  // 3. Facture (2 lignes : adoption + adhésion 30 €)
  try {
    // Idempotence stricte : la colonne adoption_contract_id porte un index
    // UNIQUE partiel — un seul document par contrat. On préfère .limit(1)
    // pour rester tolérant si jamais des doublons historiques existent en base.
    const { data: existingDocs } = await admin
      .from('documents')
      .select('id, numero')
      .eq('establishment_id', contract.establishment_id)
      .eq('adoption_contract_id', contract.id)
      .limit(1)

    const existingDoc = existingDocs?.[0]

    if (existingDoc) {
      result.invoiceId = existingDoc.id
      result.invoiceNumber = existingDoc.numero
    } else {
      const { data: numero, error: numError } = await admin.rpc(
        'get_next_document_number',
        { doc_type: 'facture', est_id: contract.establishment_id }
      )

      if (numError || !numero) {
        throw new Error(numError?.message ?? 'Numéro indisponible')
      }

      const lineItems = [
        {
          description: adoptionLabel,
          details: `Contrat d'adoption ${contract.contract_number}`,
          quantity: 1,
          unit_price: adoptionLineAmount,
          total: adoptionLineAmount,
        },
        {
          description: adhesionLabel,
          details: `Don ouvrant droit à reçu fiscal (article 200 du CGI).`,
          quantity: 1,
          unit_price: ADHESION_AMOUNT_EUR,
          total: ADHESION_AMOUNT_EUR,
        },
      ]

      const { data: doc, error: docError } = await admin
        .from('documents')
        .insert({
          establishment_id: contract.establishment_id,
          type: 'facture',
          numero: numero as string,
          date: contract.adoption_date,
          client_id: contact.id,
          client_name: getClientDisplayName(contact),
          client_email: contact.email,
          client_address: contact.address,
          client_postal_code: contact.postal_code,
          client_city: contact.city,
          total: adoptionFee,
          status: 'draft',
          line_items: lineItems,
          adoption_contract_id: contract.id,
          created_by: contract.created_by,
          notes: `Adoption automatique [${ADOPTION_REF_TAG}:${contract.id}] — ${contract.contract_number}`,
        })
        .select('id, numero')
        .single<{ id: string; numero: string }>()

      if (docError || !doc) {
        // Si la contrainte UNIQUE rejette l'insert (race avec un appel
        // parallèle qui vient d'insérer), on relit la ligne existante.
        if (docError?.code === '23505') {
          const { data: race } = await admin
            .from('documents')
            .select('id, numero')
            .eq('establishment_id', contract.establishment_id)
            .eq('adoption_contract_id', contract.id)
            .limit(1)
            .maybeSingle()
          if (race) {
            result.invoiceId = race.id
            result.invoiceNumber = race.numero
          } else {
            throw new Error('Insert facture rejeté par contrainte unique mais ligne introuvable')
          }
        } else {
          throw new Error(docError?.message ?? 'Insert facture échoué')
        }
      } else {
        result.invoiceId = doc.id
        result.invoiceNumber = doc.numero
      }
    }
  } catch (err) {
    console.error('[adoption] create invoice failed:', err)
    result.warnings.push(`Facture non générée : ${(err as Error).message}`)
  }

  // 4. Donation (30 € adhésion) → génère le CERFA
  try {
    // Idempotence : index UNIQUE partiel sur adoption_contract_id
    const { data: existingDonations } = await admin
      .from('donations')
      .select('id, cerfa_number')
      .eq('establishment_id', contract.establishment_id)
      .eq('adoption_contract_id', contract.id)
      .limit(1)

    const existingDonation = existingDonations?.[0]

    if (existingDonation) {
      result.donationId = existingDonation.id
      result.donationCerfaNumber = existingDonation.cerfa_number
    } else {
      const { data: cerfaNumber, error: cerfaError } = await admin.rpc(
        'get_next_cerfa_number',
        { est_id: contract.establishment_id }
      )
      if (cerfaError || !cerfaNumber) {
        throw new Error(cerfaError?.message ?? 'Numéro CERFA indisponible')
      }

      const { data: donation, error: donationError } = await admin
        .from('donations')
        .insert({
          establishment_id: contract.establishment_id,
          client_id: contact.id,
          adoption_contract_id: contract.id,
          donor_name: getClientDisplayName(contact),
          donor_email: contact.email,
          donor_phone: contact.phone,
          donor_address: contact.address,
          donor_postal_code: contact.postal_code,
          donor_city: contact.city,
          amount: ADHESION_AMOUNT_EUR,
          date: contract.adoption_date,
          payment_method: 'autre',
          nature: 'numeraire',
          cerfa_number: cerfaNumber as string,
          cerfa_generated: true,
          cerfa_generated_at: new Date().toISOString(),
          source: 'adoption',
          notes: `Adhésion annuelle générée automatiquement à l'adoption [${ADOPTION_REF_TAG}:${contract.id}] — contrat ${contract.contract_number}`,
          created_by: contract.created_by,
        })
        .select('id, cerfa_number')
        .single<{ id: string; cerfa_number: string }>()

      if (donationError || !donation) {
        if (donationError?.code === '23505') {
          // Race : un autre appel a inséré entre temps. On relit.
          const { data: race } = await admin
            .from('donations')
            .select('id, cerfa_number')
            .eq('establishment_id', contract.establishment_id)
            .eq('adoption_contract_id', contract.id)
            .limit(1)
            .maybeSingle()
          if (race) {
            result.donationId = race.id
            result.donationCerfaNumber = race.cerfa_number
          } else {
            throw new Error('Insert donation rejeté par contrainte unique mais ligne introuvable')
          }
        } else {
          throw new Error(donationError?.message ?? 'Insert donation échoué')
        }
      } else {
        result.donationId = donation.id
        result.donationCerfaNumber = donation.cerfa_number
      }
    }
  } catch (err) {
    console.error('[adoption] create donation/cerfa failed:', err)
    result.warnings.push(`Reçu fiscal non généré : ${(err as Error).message}`)
  }

  return result
}
