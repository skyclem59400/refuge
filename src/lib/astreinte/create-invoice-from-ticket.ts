import { createAdminClient } from '@/lib/supabase/server'

const DEFAULT_NIGHT_FEE = 250 // tarif par défaut si aucun fee défini sur commune ou EPCI
const TYPE_LABELS: Record<string, string> = {
  divagation: 'divagation animale',
  dangerous: 'animal dangereux',
  requisition: 'réquisition judiciaire',
  veterinary_emergency: 'urgence vétérinaire',
}

interface AstreinteTicket {
  id: string
  ticket_number: string
  intervention_type: string
  is_night_intervention: boolean
  municipality_code_insee: string | null
  location_address: string | null
  intervention_outcome: string | null
  acknowledged_at: string | null
  completed_at: string | null
  optimus_invoice_id: string | null
}

interface Municipality {
  code_insee: string
  name: string
  postal_codes: string[]
  epci_code_siren: string | null
  billing_entity: string
  billing_address: string | null
  billing_postal_code: string | null
  billing_city: string | null
  billing_email: string | null
  night_intervention_fee: number | null
}

interface Epci {
  code_siren: string
  short_name: string
  full_name: string
  billing_name: string | null
  billing_address: string | null
  billing_postal_code: string | null
  billing_city: string | null
  billing_email: string | null
  night_intervention_fee: number | null
}

interface BillingTarget {
  name: string
  email: string | null
  address: string | null
  postal_code: string | null
  city: string | null
  fee: number
}

export interface CreateInvoiceResult {
  invoiceId: string
  invoiceNumber: string
  total: number
  clientName: string
}

/**
 * Génère automatiquement une facture pour une intervention de NUIT
 * (is_night_intervention=true) lorsque l'animal a été récupéré.
 * Adresse la facture à la commune ou à l'EPCI selon la convention
 * (commune.billing_entity).
 *
 * Idempotente : si optimus_invoice_id est déjà rempli, retourne l'existant.
 */
export async function createInvoiceFromTicket(
  ticketId: string,
  establishmentId: string,
  createdByUserId: string
): Promise<CreateInvoiceResult | null> {
  const admin = createAdminClient()

  const { data: ticket } = await admin
    .from('astreinte_tickets')
    .select(
      'id, ticket_number, intervention_type, is_night_intervention, municipality_code_insee, location_address, intervention_outcome, acknowledged_at, completed_at, optimus_invoice_id'
    )
    .eq('id', ticketId)
    .single<AstreinteTicket>()

  if (!ticket) return null
  if (!ticket.is_night_intervention) return null
  if (ticket.intervention_outcome !== 'animal_recovered') return null

  // Idempotence
  if (ticket.optimus_invoice_id) {
    const { data: existing } = await admin
      .from('documents')
      .select('id, numero, total, client_name')
      .eq('id', ticket.optimus_invoice_id)
      .maybeSingle()
    if (existing) {
      return {
        invoiceId: existing.id,
        invoiceNumber: existing.numero,
        total: Number(existing.total),
        clientName: existing.client_name,
      }
    }
  }

  if (!ticket.municipality_code_insee) {
    throw new Error('Aucune commune renseignée — impossible de facturer.')
  }

  const { data: muni } = await admin
    .from('astreinte_municipalities')
    .select(
      'code_insee, name, postal_codes, epci_code_siren, billing_entity, billing_address, billing_postal_code, billing_city, billing_email, night_intervention_fee'
    )
    .eq('code_insee', ticket.municipality_code_insee)
    .maybeSingle<Municipality>()

  if (!muni) {
    throw new Error(`Commune ${ticket.municipality_code_insee} introuvable.`)
  }

  // Détermine l'entité facturée
  let target: BillingTarget
  if (muni.billing_entity === 'epci' && muni.epci_code_siren) {
    const { data: epci } = await admin
      .from('astreinte_epci')
      .select(
        'code_siren, short_name, full_name, billing_name, billing_address, billing_postal_code, billing_city, billing_email, night_intervention_fee'
      )
      .eq('code_siren', muni.epci_code_siren)
      .maybeSingle<Epci>()

    if (!epci) {
      throw new Error(`EPCI ${muni.epci_code_siren} introuvable.`)
    }

    target = {
      name: epci.billing_name ?? epci.full_name,
      email: epci.billing_email,
      address: epci.billing_address,
      postal_code: epci.billing_postal_code,
      city: epci.billing_city,
      fee: Number(epci.night_intervention_fee ?? muni.night_intervention_fee ?? DEFAULT_NIGHT_FEE),
    }
  } else {
    target = {
      name: `Mairie de ${muni.name}`,
      email: muni.billing_email,
      address: muni.billing_address,
      postal_code: muni.billing_postal_code ?? muni.postal_codes?.[0] ?? null,
      city: muni.billing_city ?? muni.name,
      fee: Number(muni.night_intervention_fee ?? DEFAULT_NIGHT_FEE),
    }
  }

  // Find-or-create client
  const { data: existingClient } = await admin
    .from('clients')
    .select('id')
    .eq('establishment_id', establishmentId)
    .eq('name', target.name)
    .maybeSingle()

  let clientId: string
  if (existingClient) {
    clientId = existingClient.id
  } else {
    const { data: newClient, error: clientError } = await admin
      .from('clients')
      .insert({
        establishment_id: establishmentId,
        name: target.name,
        email: target.email,
        address: target.address,
        postal_code: target.postal_code,
        city: target.city,
        type: 'organisation',
      })
      .select('id')
      .single<{ id: string }>()
    if (clientError || !newClient) {
      throw new Error(`Création client échouée : ${clientError?.message ?? 'inconnu'}`)
    }
    clientId = newClient.id
  }

  // Numéro de facture via RPC existante
  const { data: numero, error: numeroError } = await admin.rpc(
    'get_next_document_number',
    { doc_type: 'facture', est_id: establishmentId }
  )

  if (numeroError || !numero) {
    throw new Error(`Numéro de facture indisponible : ${numeroError?.message ?? 'inconnu'}`)
  }

  const today = new Date().toISOString().slice(0, 10)
  const interventionLabel = TYPE_LABELS[ticket.intervention_type] ?? ticket.intervention_type
  const dateLabel = ticket.acknowledged_at
    ? new Date(ticket.acknowledged_at).toLocaleDateString('fr-FR')
    : new Date().toLocaleDateString('fr-FR')

  const lineItems = [
    {
      description: `Intervention astreinte de nuit — ${interventionLabel}`,
      details: `Ticket ${ticket.ticket_number} · Commune : ${muni.name}${
        ticket.location_address ? ` · ${ticket.location_address}` : ''
      } · Date : ${dateLabel}`,
      quantity: 1,
      unit_price: target.fee,
      total: target.fee,
    },
  ]

  const { data: doc, error: docError } = await admin
    .from('documents')
    .insert({
      establishment_id: establishmentId,
      type: 'facture',
      numero: numero as string,
      date: today,
      client_id: clientId,
      client_name: target.name,
      client_email: target.email,
      client_address: target.address,
      client_postal_code: target.postal_code,
      client_city: target.city,
      total: target.fee,
      status: 'draft',
      line_items: lineItems,
      created_by: createdByUserId,
      notes: `Facturation automatique — intervention de nuit SDA Astreinte (${ticket.ticket_number}).`,
    })
    .select('id, numero, total, client_name')
    .single<{ id: string; numero: string; total: number; client_name: string }>()

  if (docError || !doc) {
    throw new Error(`Création facture échouée : ${docError?.message ?? 'inconnu'}`)
  }

  await admin
    .from('astreinte_tickets')
    .update({ optimus_invoice_id: doc.id })
    .eq('id', ticketId)

  return {
    invoiceId: doc.id,
    invoiceNumber: doc.numero,
    total: Number(doc.total),
    clientName: doc.client_name,
  }
}
