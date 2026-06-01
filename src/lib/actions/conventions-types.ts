export type ConventionStatus =
  | 'draft'
  | 'ready'
  | 'sent'
  | 'signed'
  | 'refused'
  | 'cancelled'
  | 'expired'

export type ConventionSignatureMethod = 'paper' | 'electronic'
export type ConventionSignatureStatus = 'pending' | 'signed' | 'rejected'

export interface ConventionContract {
  id: string
  establishment_id: string
  contract_number: string
  epci_code_siren: string | null
  municipality_code_insee: string | null
  scope_name: string
  signatory_name: string
  signatory_role: string | null
  signatory_email: string | null
  signatory_phone: string | null
  signatory_address: string | null
  population_reference: number
  rate_per_inhabitant_cents: number
  yearly_fee_cents: number
  night_intervention_fee_cents: number
  night_holiday_surcharge_cents: number
  duration_years: number
  start_date: string | null
  end_date: string | null
  status: ConventionStatus
  signed_date: string | null
  signature_method: ConventionSignatureMethod | null
  signature_status: ConventionSignatureStatus | null
  signature_sent_at: string | null
  pdf_url: string | null
  pdf_local_path: string | null
  signed_pdf_url: string | null
  documenso_document_id: number | null
  documenso_recipient_id: number | null
  documenso_signing_url: string | null
  signed_at_via_documenso: string | null
  newly_added: boolean
  notes: string | null
  created_by_user_id: string | null
  created_at: string
  updated_at: string
}

export interface ConventionListFilters {
  scope?: 'all' | 'epci' | 'municipality' | string // 'CAC', 'CA2C', 'Sud-Artois', 'indep'
  status?: ConventionStatus | 'all'
  newlyOnly?: boolean
  search?: string
}

export interface ConventionStats {
  total: number
  signed: number
  ready: number
  sent: number
  cancelled: number
  yearly_fee_total_signed_cents: number
  yearly_fee_total_all_cents: number
}

export const STATUS_LABELS: Record<ConventionStatus, string> = {
  draft: 'Brouillon',
  ready: 'À envoyer',
  sent: 'Envoyé',
  signed: 'Signé',
  refused: 'Refusé',
  cancelled: 'Annulé',
  expired: 'Expiré',
}

export const STATUS_CLASSES: Record<ConventionStatus, string> = {
  draft: 'bg-muted/15 text-muted',
  ready: 'bg-warning/20 text-warning',
  sent: 'bg-blue-500/15 text-blue-500',
  signed: 'bg-success/15 text-success',
  refused: 'bg-red-500/15 text-red-500',
  cancelled: 'bg-muted/15 text-muted',
  expired: 'bg-orange-500/15 text-orange-500',
}

export function formatCents(cents: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}
