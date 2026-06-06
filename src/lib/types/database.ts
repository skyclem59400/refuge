export type RoleType = 'admin' | 'salarie' | 'benevole'
export type ContactCategory = 'client' | 'member' | 'volunteer' | 'board_member' | 'foster_family' | 'veterinarian'
export type ClientKind = 'person' | 'organization'
export type DocumentType = 'devis' | 'facture' | 'avoir'
export type DocumentStatus = 'draft' | 'sent' | 'paid' | 'cancelled' | 'converted' | 'validated'
export type DocumentPaymentMethod = 'cheque' | 'virement' | 'especes' | 'cb' | 'prelevement' | 'autre'
export type Permission = 'manage_establishment' | 'manage_documents' | 'manage_clients' | 'manage_animals' | 'view_animals' | 'manage_health' | 'manage_movements' | 'manage_boxes' | 'manage_posts' | 'manage_donations' | 'view_pound' | 'view_statistics' | 'manage_outings' | 'manage_outing_assignments' | 'manage_adoptions' | 'manage_planning' | 'manage_leaves' | 'view_own_leaves' | 'manage_payslips' | 'manage_veterinarians' | 'view_animal_news' | 'manage_astreinte'

export interface LineItem {
  description: string
  quantity: number
  unit_price: number
  total: number
}

export type BlacklistSource = 'judicial_procedure' | 'manual' | 'incident'
export type BlacklistMatchStrength = 'exact_email' | 'exact_phone' | 'name_birthdate' | 'name_only'

export interface Client {
  id: string
  kind: ClientKind
  name: string
  first_name: string | null
  contact_person: string | null
  email: string | null
  phone: string | null
  address: string | null
  postal_code: string | null
  city: string | null
  type: ContactCategory | null
  is_adopter: boolean
  is_foster: boolean
  is_member: boolean
  member_since: string | null
  notes: string | null
  // Liste noire SDA (cf. migration 20260520d_judicial_blacklist)
  is_blacklisted: boolean
  blacklist_reason: string | null
  blacklist_source: BlacklistSource | null
  blacklisted_at: string | null
  blacklisted_by: string | null
  blacklist_removed_at: string | null
  blacklist_removed_by: string | null
  blacklist_removal_reason: string | null
  birth_date: string | null
  birth_place: string | null
  national_id: string | null
  establishment_id: string
  created_at: string
  updated_at: string
}

export interface BlacklistMatch {
  client_id: string
  match_strength: BlacklistMatchStrength
  client_name: string
  client_first_name: string | null
  blacklist_reason: string | null
  blacklist_source: BlacklistSource | null
  blacklisted_at: string | null
}

export const BLACKLIST_SOURCE_LABELS: Record<BlacklistSource, string> = {
  judicial_procedure: 'Procédure judiciaire',
  manual: 'Inscription manuelle',
  incident: 'Incident',
}

export const BLACKLIST_MATCH_LABELS: Record<BlacklistMatchStrength, string> = {
  exact_email: 'Email identique',
  exact_phone: 'Téléphone identique',
  name_birthdate: 'Nom + prénom + date de naissance',
  name_only: 'Nom + prénom (signal faible)',
}

/** Niveaux qui doivent bloquer automatiquement une adoption / refuser une inquiry publique. */
export const BLOCKING_MATCH_STRENGTHS: BlacklistMatchStrength[] = [
  'exact_email',
  'exact_phone',
  'name_birthdate',
]

export function getClientDisplayName(client: Pick<Client, 'kind' | 'name' | 'first_name'>): string {
  if (client.kind === 'organization') return client.name
  return client.first_name ? `${client.name} ${client.first_name}` : client.name
}

export interface Document {
  id: string
  type: DocumentType
  numero: string
  date: string
  client_id: string | null
  client_name: string
  client_email: string | null
  client_address: string | null
  client_postal_code: string | null
  client_city: string | null
  nb_adultes: number
  prix_adulte: number
  nb_enfants: number
  prix_enfant: number
  total: number
  line_items: LineItem[]
  notes: string | null
  status: DocumentStatus
  converted_from_id: string | null
  converted_to_id: string | null
  cancelled_by_id: string | null
  payment_method: DocumentPaymentMethod | null
  payment_date: string | null
  pdf_url: string | null
  establishment_id: string
  created_at: string
  updated_at: string
  created_by: string | null
}

export interface Establishment {
  id: string
  name: string
  description: string
  email: string
  phone: string
  website: string
  iban: string
  bic: string
  address: string
  legal_name: string
  siret: string
  logo_url: string | null
  type: EstablishmentType
  google_calendar_id: string
  documenso_folder_id: string | null
  adoption_appointment_settings: AdoptionAppointmentSettings
  min_daily_staff: number
  /** Email comptable (config CRA) — destinataire des CRA validés */
  accountant_email: string | null
  accountant_name: string | null
  /** Email clinique véto — destinataire des récaps auto de passage véto */
  vet_recap_email: string | null
  created_at: string
  updated_at: string
}

export type ContractType = 'salarie' | 'auto_entrepreneur' | 'benevole' | 'autre'
export type AvailabilityStatus = 'active' | 'on_extended_leave'

export interface PermissionGroup {
  id: string
  establishment_id: string
  name: string
  description: string
  is_system: boolean
  manage_documents: boolean
  manage_clients: boolean
  manage_establishment: boolean
  manage_animals: boolean
  view_animals: boolean
  manage_health: boolean
  manage_movements: boolean
  manage_boxes: boolean
  manage_posts: boolean
  manage_donations: boolean
  manage_outings: boolean
  manage_outing_assignments: boolean
  manage_adoptions: boolean
  manage_planning: boolean
  view_pound: boolean
  view_statistics: boolean
  manage_leaves: boolean
  view_own_leaves: boolean
  manage_payslips: boolean
  manage_veterinarians: boolean
  view_animal_news: boolean
  // Permissions site public (formulaires globaux)
  manage_adoption_applications: boolean
  manage_volunteer_applications: boolean
  manage_foster_applications: boolean
  manage_abuse_reports: boolean
  // Module astreinte (tickets, communes, accès)
  manage_astreinte: boolean
  created_at: string
  updated_at: string
}

export interface MemberGroup {
  id: string
  member_id: string
  group_id: string
  created_at: string
}

export interface EstablishmentMember {
  id: string
  establishment_id: string
  user_id: string
  is_owner?: boolean
  // Pseudo auth fields
  pseudo: string | null
  role_type: RoleType
  is_pseudo_user: boolean
  password_set: boolean
  // Coverage / staffing
  contract_type: ContractType
  availability_status: AvailabilityStatus
  extended_leave_from: string | null
  extended_leave_until: string | null
  extended_leave_reason: string | null
  // CRA — horaires jours fériés (NULL = ne travaille pas les fériés, défaut)
  holiday_start_am: string | null
  holiday_end_am: string | null
  holiday_start_pm: string | null
  holiday_end_pm: string | null
  created_at: string
  updated_at: string
  // Enriched from auth.users via RPC
  email?: string
  full_name?: string | null
  avatar_url?: string | null
  // Enriched from group resolution
  groups?: PermissionGroup[]
}

export interface Permissions {
  canManageEstablishment: boolean
  canManageDocuments: boolean
  canManageClients: boolean
  canManageAnimals: boolean
  canViewAnimals: boolean
  canManageHealth: boolean
  canManageMovements: boolean
  canManageBoxes: boolean
  canManagePosts: boolean
  canManageDonations: boolean
  canManageOutings: boolean
  canManageOutingAssignments: boolean
  canManageAdoptions: boolean
  canManagePlanning: boolean
  canViewPound: boolean
  canViewStatistics: boolean
  canManageLeaves: boolean
  canViewOwnLeaves: boolean
  canManagePayslips: boolean
  canManageVeterinarians: boolean
  canViewAnimalNews: boolean
  canManageAdoptionApplications: boolean
  canManageVolunteerApplications: boolean
  canManageFosterApplications: boolean
  canManageAbuseReports: boolean
  canManageAstreinte: boolean
  isAdmin: boolean
  isOwner: boolean
}

export interface EstablishmentContext {
  establishment: Establishment
  membership: EstablishmentMember
  permissions: Permissions
}

export interface UnassignedUser {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  created_at: string
}

export interface UserProfile {
  user_id: string
  last_name: string | null
  first_name: string | null
  personal_email: string | null
  phone: string | null
  birth_date: string | null
  address_label: string | null
  address_postcode: string | null
  address_city: string | null
  address_lat: number | null
  address_lng: number | null
  address_ban_id: string | null
  profile_completed: boolean
  profile_completed_at: string | null
  email_migrated: boolean
  created_at: string
  updated_at: string
}

export interface UserProfileInput {
  last_name: string
  first_name: string
  personal_email: string
  phone: string
  birth_date?: string | null
  address_label: string
  address_postcode: string
  address_city: string
  address_lat: number | null
  address_lng: number | null
  address_ban_id: string | null
}

export interface CompanyInfo {
  name: string
  description: string
  email: string
  phone: string
  website: string
  iban: string
  bic: string
  address: string
  legal_name: string
  siret: string
}

// ============================================
// SDA Estormel - Animal Shelter Types
// ============================================

export type AnimalSpecies =
  | 'dog' | 'cat'
  | 'rabbit' | 'guinea_pig' | 'hamster' | 'rat' | 'ferret' | 'chinchilla'
  | 'goat' | 'sheep' | 'pig' | 'cow'
  | 'horse' | 'donkey' | 'pony'
  | 'chicken' | 'duck' | 'goose'
  | 'parakeet' | 'parrot' | 'canary'
  | 'tortoise'
  | 'other'
export type AnimalSex = 'male' | 'female' | 'unknown'
export type AnimalStatus = 'pound' | 'shelter' | 'foster_family' | 'boarding' | 'adopted' | 'returned' | 'transferred' | 'deceased' | 'euthanized'
export type AnimalOrigin = 'found' | 'abandoned' | 'transferred_in' | 'surrender' | 'requisition' | 'divagation'
export type MovementType = 'pound_entry' | 'shelter_transfer' | 'foster_placement' | 'adoption' | 'return_to_owner' | 'transfer_out' | 'death' | 'euthanasia' | 'reservation' | 'reservation_cancelled'
export type HealthRecordType = 'vaccination' | 'sterilization' | 'antiparasitic' | 'consultation' | 'surgery' | 'medication' | 'behavioral_assessment' | 'identification' | 'radio' | 'blood_test' | 'cession'
export type IcadStatus = 'pending' | 'declared' | 'not_required'
export type BoxSpecies =
  | 'dog' | 'cat' | 'mixed'
  | 'rabbit' | 'guinea_pig' | 'hamster' | 'rat' | 'ferret' | 'chinchilla'
  | 'goat' | 'sheep' | 'pig' | 'cow'
  | 'horse' | 'donkey' | 'pony'
  | 'chicken' | 'duck' | 'goose'
  | 'parakeet' | 'parrot' | 'canary'
  | 'tortoise'
  | 'farm' | 'other'
export type BoxStatus = 'available' | 'occupied' | 'maintenance'
export type EstablishmentType = 'farm' | 'shelter' | 'both'
export type SocialPostType = 'search_owner' | 'adoption' | 'event' | 'info' | 'other'
export type SocialPlatform = 'facebook' | 'instagram' | 'both'
export type SocialPostStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'archived'

// Donations & CERFA
export type DonationPaymentMethod = 'cheque' | 'virement' | 'especes' | 'cb' | 'prelevement' | 'helloasso' | 'autre'
export type DonationNature = 'numeraire' | 'nature'
export type DonationSource = 'manual' | 'helloasso'

// I-CAD
export type IcadDeclarationType = 'pound_entry' | 'shelter_transfer' | 'adoption' | 'return_to_owner' | 'transfer_out' | 'death' | 'euthanasia' | 'identification' | 'owner_change' | 'address_change'
export type IcadDeclarationStatus = 'pending' | 'submitted' | 'confirmed' | 'rejected' | 'error' | 'not_required'

export interface Animal {
  id: string
  establishment_id: string
  name: string
  name_secondary: string | null
  species: AnimalSpecies
  breed: string | null
  breed_cross: string | null
  sex: AnimalSex
  birth_date: string | null
  birth_place: string | null
  color: string | null
  weight: number | null
  sterilized: boolean
  arrived_sterilized: boolean
  chip_number: string | null
  tattoo_number: string | null
  tattoo_position: string | null
  medal_number: string | null
  loof_number: string | null
  passport_number: string | null
  sire_number: string | null
  ede_number: string | null
  ring_number: string | null
  identification_date: string | null
  identifying_veterinarian_id: string | null
  icad_updated: boolean
  status: AnimalStatus
  behavior_score: number | null
  description: string | null
  description_external: string | null
  capture_location: string | null
  capture_circumstances: string | null
  // Lieu de récupération structuré (autocomplétion BAN). Source de vérité depuis 2026-05.
  pickup_address_label: string | null
  pickup_postcode: string | null
  pickup_city: string | null
  pickup_lat: number | null
  pickup_lng: number | null
  pickup_ban_id: string | null
  origin_type: AnimalOrigin
  box_id: string | null
  pound_entry_date: string | null
  shelter_entry_date: string | null
  exit_date: string | null
  adoptable: boolean
  reserved: boolean
  /** Mise en avant adoption SOS (badge rouge clignotant côté site, remontée en tête de liste). */
  is_sos: boolean
  /** Brouillon de description publique en attente de relecture/approbation. NULL = pas de brouillon. */
  description_external_pending: string | null
  description_external_pending_updated_at: string | null
  description_external_pending_updated_by: string | null
  /** Utilisateur qui a saisi l'animal (NULL pour les animaux importés anciens). */
  created_by: string | null
  /** Adoptable uniquement par des professionnels (éleveur, éducateur, dresseur, comportementaliste).
   * Affiché comme badge "Pros uniquement" sur la liste publique sda-nord.com. */
  pros_only: boolean
  /** Adoptant pré-réservé (certificat d'engagement en cours). NULL si pas de pré-réservation. */
  pre_reservation_client_id: string | null
  retirement_basket: boolean
  ok_cats: boolean | null
  ok_males: boolean | null
  ok_females: boolean | null
  // Hunimalis sync fields
  hunimalis_id: number | null
  photo_url: string | null
  last_synced_at: string | null
  // Procédure judiciaire
  judicial_procedure: boolean
  judicial_case_number: string | null
  judicial_jurisdiction: string | null
  judicial_seizure_date: string | null
  judicial_owner_name: string | null
  judicial_owner_client_id: string | null
  judicial_billing_recipient: string | null
  judicial_notes: string | null
  judicial_pickup_location: string | null
  judicial_hearing_date: string | null
  judicial_decision_date: string | null
  judicial_appeal_deadline: string | null
  judicial_lawyer_name: string | null
  judicial_lawyer_contact: string | null
  created_at: string
  updated_at: string
}

export type JudicialAttachmentKind =
  | 'seizure_pv'
  | 'requisition_order'
  | 'court_decision'
  | 'vet_report'
  | 'photo_evidence'
  | 'invoice'
  | 'other'

export interface JudicialAttachment {
  id: string
  establishment_id: string
  animal_id: string
  kind: JudicialAttachmentKind
  storage_path: string
  file_name: string | null
  mime_type: string | null
  size_bytes: number | null
  document_date: string | null
  notes: string | null
  uploaded_by: string | null
  created_at: string
  signed_url?: string
}

export interface AnimalPhoto {
  id: string
  animal_id: string
  url: string
  is_primary: boolean
  created_at: string
}

export type MovementSignatureStatus = 'not_required' | 'pending' | 'signed' | 'rejected' | 'cancelled'
export type MovementRelatedContractType = 'foster' | 'adoption'

export interface AnimalMovement {
  id: string
  animal_id: string
  type: MovementType
  date: string
  notes: string | null
  person_name: string | null
  person_contact: string | null
  destination: string | null
  icad_status: IcadStatus
  related_client_id: string | null
  related_client?: { id: string; kind: ClientKind; name: string; first_name: string | null } | null
  signature_status: MovementSignatureStatus | null
  related_contract_id: string | null
  related_contract_type: MovementRelatedContractType | null
  created_by: string | null
  created_at: string
}

export interface AnimalOuting {
  id: string
  animal_id: string
  walked_by: string
  started_at: string
  ended_at: string | null
  duration_minutes: number | null
  notes: string | null
  rating: number | null
  rating_comment: string | null
  created_at: string
}

export interface OutingAssignment {
  id: string
  establishment_id: string
  animal_id: string
  assigned_to: string
  assigned_by: string
  date: string
  outing_id: string | null
  notes: string | null
  created_at: string
}

export interface StaffSchedule {
  id: string
  establishment_id: string
  user_id: string
  date: string
  start_time: string
  end_time: string
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
}

// Common appointment types - but any string is allowed for custom types
export type AppointmentType = string
export type AppointmentStatus = 'pending_validation' | 'scheduled' | 'confirmed' | 'completed' | 'cancelled'
export type AppointmentSource = 'manual' | 'public_portal'

export interface Appointment {
  id: string
  establishment_id: string
  type: AppointmentType
  animal_id: string | null
  assigned_user_id: string | null
  client_name: string | null
  client_phone: string | null
  client_email: string | null
  date: string
  start_time: string
  end_time: string
  notes: string | null
  status: AppointmentStatus
  source: AppointmentSource
  created_by: string
  created_at: string
  updated_at: string
}

export type WeekDayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export interface OpeningRange {
  start: string // 'HH:MM'
  end: string // 'HH:MM'
}

export interface AdoptionAppointmentSettings {
  enabled: boolean
  allowed_user_ids: string[]
  slot_duration_minutes: number
  min_advance_days: number
  max_advance_days: number
  opening_hours: Record<WeekDayKey, OpeningRange[]>
  closed_dates: string[] // ISO date 'YYYY-MM-DD'
}

export const DEFAULT_ADOPTION_APPOINTMENT_SETTINGS: AdoptionAppointmentSettings = {
  enabled: false,
  allowed_user_ids: [],
  slot_duration_minutes: 45,
  min_advance_days: 2,
  max_advance_days: 30,
  opening_hours: {
    mon: [{ start: '14:00', end: '17:00' }],
    tue: [{ start: '14:00', end: '17:00' }],
    wed: [{ start: '14:00', end: '17:00' }],
    thu: [{ start: '14:00', end: '17:00' }],
    fri: [{ start: '14:00', end: '17:00' }],
    sat: [{ start: '14:00', end: '17:00' }],
    sun: [],
  },
  closed_dates: [],
}

export interface ActivityLog {
  id: string
  establishment_id: string
  user_id: string
  action: string
  entity_type: string
  entity_id: string | null
  entity_name: string | null
  parent_type: string | null
  parent_id: string | null
  details: Record<string, unknown>
  created_at: string
}

export interface AnimalHealthRecord {
  id: string
  animal_id: string
  type: HealthRecordType
  date: string
  description: string
  veterinarian: string | null
  veterinarian_id: string | null
  next_due_date: string | null
  cost: number | null
  notes: string | null
  protocol_instance_id: string | null
  protocol_step_id: string | null
  judicial_procedure: boolean
  billed_to: string | null
  invoice_reference: string | null
  invoice_storage_path: string | null
  invoice_file_name: string | null
  invoice_mime_type: string | null
  invoice_size_bytes: number | null
  invoice_uploaded_at: string | null
  created_by: string | null
  created_at: string
}

// ============================================
// Veterinary clinics and practitioners
// ============================================

export interface VeterinaryClinic {
  id: string
  establishment_id: string
  name: string
  address: string | null
  postal_code: string | null
  city: string | null
  phone: string | null
  email: string | null
  website: string | null
  siret: string | null
  notes: string | null
  is_default: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Veterinarian {
  id: string
  clinic_id: string
  first_name: string | null
  last_name: string
  ordre_number: string | null
  specialty: string | null
  phone: string | null
  email: string | null
  is_referent: boolean
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface VeterinaryClinicWithVets extends VeterinaryClinic {
  veterinarians: Veterinarian[]
}

export interface VeterinarianWithClinic extends Veterinarian {
  clinic: Pick<VeterinaryClinic, 'id' | 'name' | 'city'>
}

// ============================================
// Foster Contracts (Convention famille d'accueil)
// ============================================

export type FosterContractStatus = 'draft' | 'active' | 'ended' | 'cancelled'
export type AdoptionContractStatus = 'draft' | 'active' | 'trial_returned' | 'finalized' | 'cancelled'
export type SignatureStatus = 'not_sent' | 'pending' | 'viewed' | 'signed' | 'rejected' | 'failed'

export interface FosterContract {
  id: string
  establishment_id: string
  animal_id: string
  foster_client_id: string
  contract_number: string
  start_date: string
  expected_end_date: string | null
  actual_end_date: string | null
  status: FosterContractStatus
  vet_costs_covered_by_shelter: boolean
  food_provided_by_shelter: boolean
  insurance_required: boolean
  household_consent: boolean
  other_animals_at_home: string | null
  special_conditions: string | null
  signed_at_location: string | null
  signed_at: string | null
  notes: string | null
  pdf_url: string | null
  // Documenso electronic signature workflow
  documenso_document_id: number | null
  documenso_recipient_id: number | null
  documenso_signing_url: string | null
  signature_status: SignatureStatus
  signature_sent_at: string | null
  signature_viewed_at: string | null
  signed_at_via_documenso: string | null
  signed_pdf_url: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface AdoptionContract {
  id: string
  establishment_id: string
  animal_id: string
  adopter_client_id: string
  contract_number: string
  adoption_date: string
  adoption_fee: number
  status: AdoptionContractStatus
  sterilization_required: boolean
  sterilization_deadline: string | null
  sterilization_deposit: number | null
  visit_right_clause: boolean
  non_resale_clause: boolean
  shelter_return_clause: boolean
  household_acknowledgment: boolean
  special_conditions: string | null
  signed_at_location: string | null
  signed_at: string | null
  notes: string | null
  pdf_url: string | null
  documenso_document_id: number | null
  documenso_recipient_id: number | null
  documenso_signing_url: string | null
  signature_status: SignatureStatus
  signature_sent_at: string | null
  signature_viewed_at: string | null
  signed_at_via_documenso: string | null
  signed_pdf_url: string | null
  // Trial period / return / refund
  trial_period_days: number | null
  trial_period_ends_at: string | null
  non_refundable_amount: number | null
  returned_at: string | null
  refunded_amount: number | null
  refunded_at: string | null
  refund_payment_method: string | null
  return_reason: string | null
  cancellation_signature_status: SignatureStatus | null
  cancellation_signed_pdf_url: string | null
  cancellation_pdf_url: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// ============================================
// Engagement Certificate (Certificat d'engagement et de connaissance)
// Premier document obligatoire en France depuis la loi du 30 nov. 2021
// (arrêté du 30 mai 2022). Délai légal de 7 jours après signature avant
// la finalisation de l'adoption.
// ============================================

export type EngagementCertificateStatus =
  | 'draft'      // Créé, pas encore envoyé
  | 'sent'       // Envoyé via Documenso, en attente de signature
  | 'signed'     // Signé par l'adoptant
  | 'expired'    // Délai dépassé sans signature
  | 'cancelled'  // Pré-réservation annulée

export interface EngagementCertificate {
  id: string
  establishment_id: string
  animal_id: string
  adopter_client_id: string
  certificate_number: string
  status: EngagementCertificateStatus
  delivered_at: string | null
  signed_at: string | null
  /** signed_at + 7 jours : date à partir de laquelle l'adoption peut être finalisée */
  can_finalize_at: string | null
  documenso_document_id: number | null
  documenso_recipient_id: number | null
  documenso_signing_url: string | null
  signed_pdf_url: string | null
  signature_sent_at: string | null
  signature_viewed_at: string | null
  signed_at_via_documenso: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// ============================================
// Abandonment Contracts (Contrat d'abandon à distance par anticipation)
// ============================================

export type AbandonmentMotif =
  | 'legal'
  | 'deces_proprietaire'
  | 'demenagement'
  | 'divorce'
  | 'allergies'
  | 'maladie_animal'
  | 'probleme_comportemental'
  | 'difficultes_financieres'
  | 'autre'

export type AbandonmentContractStatus =
  | 'draft'                  // Brouillon, pas envoyé
  | 'pending_signature'      // Envoyé au cédant pour signature
  | 'active'                 // Signé, en attente de remise physique
  | 'handover_completed'     // Animal remis effectivement, mouvement d'entrée déclenché
  | 'cancelled'              // Annulé avant aboutissement

export const ABANDONMENT_MOTIF_LABELS: Record<AbandonmentMotif, string> = {
  legal: 'Abandon légal',
  deces_proprietaire: 'Décès du propriétaire',
  demenagement: 'Déménagement',
  divorce: 'Divorce / séparation',
  allergies: 'Allergies',
  maladie_animal: 'Maladie de l’animal',
  probleme_comportemental: 'Problème comportemental',
  difficultes_financieres: 'Difficultés financières',
  autre: 'Autre',
}

export interface AbandonmentContract {
  id: string
  establishment_id: string
  contract_number: string
  animal_id: string
  cedant_client_id: string
  signature_date: string
  expected_handover_date: string | null
  actual_handover_date: string | null
  motif: AbandonmentMotif
  motif_details: string | null
  amount: number
  note: string | null
  cedant_id_card_number: string | null
  cedant_passport_number: string | null
  status: AbandonmentContractStatus
  signature_status: SignatureStatus | 'manual_paper'
  documenso_document_id: number | null
  documenso_recipient_id: number | null
  documenso_signing_url: string | null
  signature_sent_at: string | null
  signature_viewed_at: string | null
  signed_at_via_documenso: string | null
  signed_pdf_url: string | null
  pdf_url: string | null
  signed_at_location: string | null
  signed_at: string | null
  triggered_movement_id: string | null
  invoice_document_id: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// ============================================
// Health Protocols (modeles de soins avec rappels)
// ============================================

export type ProtocolApplicableSpecies = AnimalSpecies | 'both' | 'all'
export type ProtocolInstanceStatus = 'active' | 'completed' | 'cancelled'

export interface HealthProtocol {
  id: string
  establishment_id: string
  name: string
  description: string | null
  applicable_species: ProtocolApplicableSpecies
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface HealthProtocolStep {
  id: string
  protocol_id: string
  step_order: number
  label: string
  health_record_type: HealthRecordType
  offset_days: number
  recurrence_days: number | null
  description: string | null
  created_at: string
}

export interface HealthProtocolWithSteps extends HealthProtocol {
  steps: HealthProtocolStep[]
}

export interface AnimalProtocolInstance {
  id: string
  animal_id: string
  protocol_id: string
  start_date: string
  status: ProtocolInstanceStatus
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type TreatmentFrequency = 'daily' | 'twice_daily' | 'weekly' | 'custom'

export interface AnimalTreatment {
  id: string
  establishment_id: string
  animal_id: string
  health_record_id: string | null
  name: string
  description: string | null
  frequency: TreatmentFrequency
  times: string[]
  start_date: string
  end_date: string | null
  active: boolean
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface TreatmentAdministration {
  id: string
  treatment_id: string
  date: string
  time_slot: string | null
  administered_by: string
  notes: string | null
  created_at: string
}

export interface Box {
  id: string
  establishment_id: string
  name: string
  species_type: BoxSpecies
  capacity: number
  status: BoxStatus
  zone_id: string | null
  sort_order: number | null
  created_at: string
  updated_at: string
}

export interface BoxZone {
  id: string
  establishment_id: string
  name: string
  parent_id: string | null
  description: string | null
  sort_order: number | null
  created_at: string
  updated_at: string
}

export interface BoxWithZone extends Box {
  zone?: { id: string; name: string; parent_id: string | null } | null
}

export interface SocialPost {
  id: string
  establishment_id: string
  animal_id: string | null
  type: SocialPostType
  platform: SocialPlatform
  content: string
  content_facebook: string | null
  content_instagram: string | null
  photo_urls: string[]
  video_url: string | null
  status: SocialPostStatus
  scheduled_at: string | null
  published_at: string | null
  meta_fb_post_id: string | null
  meta_ig_media_id: string | null
  publish_error: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface MetaConnection {
  id: string
  establishment_id: string
  facebook_page_id: string
  facebook_page_name: string
  facebook_page_access_token: string
  instagram_business_account_id: string | null
  token_expires_at: string | null
  connected_by: string | null
  created_at: string
  updated_at: string
}

export interface IcadDeclaration {
  id: string
  animal_id: string
  movement_id: string | null
  declaration_type: IcadDeclarationType
  status: IcadDeclarationStatus
  icad_reference: string | null
  submitted_at: string | null
  confirmed_at: string | null
  error_message: string | null
  retry_count: number
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Donation {
  id: string
  establishment_id: string
  donor_name: string
  donor_email: string | null
  donor_phone: string | null
  donor_address: string | null
  donor_postal_code: string | null
  donor_city: string | null
  amount: number
  date: string
  payment_method: DonationPaymentMethod
  nature: DonationNature
  source: DonationSource
  helloasso_payment_id: number | null
  helloasso_order_id: number | null
  cerfa_number: string | null
  cerfa_generated: boolean
  cerfa_generated_at: string | null
  cerfa_sent_at: string | null
  cerfa_sent_to: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type HelloAssoSyncStatus = 'idle' | 'syncing' | 'error'

export interface HelloAssoConnection {
  id: string
  establishment_id: string
  client_id: string
  client_secret: string
  organization_slug: string
  access_token: string | null
  refresh_token: string | null
  token_expires_at: string | null
  last_sync_at: string | null
  sync_status: HelloAssoSyncStatus
  sync_error: string | null
  webhook_secret: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// ============================================
// Phone Agent System
// ============================================

export type CallStatus = 'ringing' | 'in_progress' | 'completed' | 'failed' | 'voicemail' | 'no_answer'
export type AgentStatus = 'idle' | 'in_call' | 'processing'
export type CallSentiment = 'positive' | 'neutral' | 'negative'

export interface CallCategory {
  id: string
  establishment_id: string
  name: string
  description: string | null
  color: string
  created_at: string
}

export interface AgentSession {
  id: string
  establishment_id: string
  agent_name: string
  status: AgentStatus
  current_call_id: string | null
  last_active_at: string
  created_at: string
  updated_at: string
}

export interface CallLog {
  id: string
  establishment_id: string
  caller_phone: string
  agent_session_id: string | null
  agent_name: string | null
  status: CallStatus
  duration_seconds: number
  category_id: string | null
  sentiment: CallSentiment | null
  summary: string | null
  action_items: Array<{ text: string; completed: boolean }>
  callback_needed: boolean
  callback_completed: boolean
  callback_completed_at: string | null
  callback_completed_by: string | null
  livekit_room_name: string | null
  started_at: string
  ended_at: string | null
  created_at: string
  updated_at: string
}

export interface CallTranscript {
  id: string
  call_log_id: string
  speaker: 'caller' | 'agent'
  content: string
  timestamp_ms: number
  created_at: string
}

export interface CallLogWithCategory extends CallLog {
  category: CallCategory | null
}

// ============================================
// Pound Interventions
// ============================================

export interface PoundIntervention {
  id: string
  establishment_id: string
  animal_id: string | null
  caller_name: string
  caller_phone: string | null
  caller_email: string | null
  location_street_number: string | null
  location_street: string
  location_city: string
  intervention_date: string
  intervened_by: string
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// ============================================
// Ringover Integration
// ============================================

export interface RingoverConnection {
  id: string
  establishment_id: string
  api_key: string
  astreinte_number: string | null
  astreinte_label: string | null
  accueil_number: string | null
  accueil_label: string | null
  last_sync_at: string | null
  sync_cursor: string | null
  is_active: boolean
  auto_sync_enabled: boolean
  auto_sync_cron: string
  auto_sync_schedule_id: string | null
  created_at: string
  updated_at: string
}

export interface RingoverCall {
  call_id: string
  direction: string
  from_number: string
  from_name: string | null
  to_number: string
  start_time: string
  duration: number
  status: string
}

export interface RingoverNumber {
  number: string
  label: string
  type: string
}

// ============================================
// Ringover Analytics
// ============================================

export interface RingoverCallRecord {
  id: string
  establishment_id: string
  ringover_call_id: string
  direction: 'in' | 'out'
  status: string
  caller_number: string | null
  caller_name: string | null
  callee_number: string | null
  callee_name: string | null
  agent_id: string | null
  agent_name: string | null
  start_time: string
  end_time: string | null
  duration: number
  wait_time: number
  has_voicemail: boolean
  voicemail_url: string | null
  has_recording: boolean
  recording_url: string | null
  tags: string[]
  notes: string | null
  callback_needed: boolean
  callback_completed: boolean
  callback_completed_at: string | null
  callback_completed_by: string | null
  callback_notes: string | null
  raw_data: Record<string, unknown> | null
  synced_at: string
  created_at: string
  updated_at: string
  // Transcription & AI
  transcript: string | null
  transcript_language: string | null
  ai_summary: string | null
  ai_sentiment: 'positive' | 'neutral' | 'negative' | null
  ai_action_items: { text: string; completed: boolean }[] | null
  transcribed_at: string | null
  transcribed_by: string | null
}

export interface RingoverDashboardStats {
  totalCalls: number
  answeredCalls: number
  missedCalls: number
  voicemailCalls: number
  outboundCalls: number
  answerRate: number
  missedRate: number
  avgDuration: number
  avgWaitTime: number
  totalDuration: number
  callbacksPending: number
}

export interface RingoverHourlyData {
  hour: number
  total: number
  answered: number
  missed: number
}

export interface RingoverDailyData {
  date: string
  total: number
  answered: number
  missed: number
  avgWaitTime: number
}

export interface RingoverCallbackItem {
  id: string
  caller_number: string
  caller_name: string | null
  start_time: string
  status: string
  has_voicemail: boolean
  voicemail_url: string | null
  duration: number
  wait_time: number
  callback_completed: boolean
  callback_notes: string | null
  // AI fields
  ai_summary: string | null
  ai_sentiment: 'positive' | 'neutral' | 'negative' | null
}

export interface RingoverTopCaller {
  caller_number: string
  caller_name: string | null
  total_calls: number
  missed_calls: number
  last_call_time: string
}

// ============================================
// Leave Management & Employee Space
// ============================================

export type LeaveRequestStatus = 'pending' | 'approved' | 'refused' | 'cancelled'

export interface LeaveType {
  id: string
  establishment_id: string
  name: string
  code: string
  color: string
  requires_approval: boolean
  deducts_balance: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface LeaveBalance {
  id: string
  establishment_id: string
  member_id: string
  leave_type_id: string
  year: number
  initial_balance: number
  used: number
  adjustment: number
  created_at: string
  updated_at: string
}

export type LeaveGranularity = 'full_day' | 'half_day' | 'hourly'

export interface LeaveRequest {
  id: string
  establishment_id: string
  member_id: string
  leave_type_id: string
  start_date: string
  end_date: string
  half_day_start: boolean
  half_day_end: boolean
  days_count: number
  granularity: LeaveGranularity
  start_time: string | null
  end_time: string | null
  duration_hours: number | null
  status: LeaveRequestStatus
  reason: string | null
  admin_comment: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

export type LeaveAttachmentKind = 'sick_note' | 'extended_leave_proof' | 'other'

export interface LeaveAttachment {
  id: string
  establishment_id: string
  member_id: string
  leave_request_id: string | null
  kind: LeaveAttachmentKind
  storage_path: string
  file_name: string | null
  mime_type: string | null
  size_bytes: number | null
  notes: string | null
  uploaded_by: string | null
  created_at: string
  signed_url?: string
}

export interface LeaveRequestWithDetails extends LeaveRequest {
  leave_type?: LeaveType
  member?: EstablishmentMember
  reviewer?: EstablishmentMember
}

export interface Payslip {
  id: string
  establishment_id: string
  member_id: string
  year: number
  month: number
  label: string | null
  file_path: string
  file_url: string
  file_size: number | null
  uploaded_by: string
  created_at: string
}

/** Type de document RH stocké par membre */
export type MemberDocumentKind = 'contract' | 'amendment' | 'certificate' | 'other'

export const MEMBER_DOCUMENT_KIND_LABELS: Record<MemberDocumentKind, string> = {
  contract: 'Contrat de travail',
  amendment: 'Avenant',
  certificate: 'Attestation / certificat',
  other: 'Autre document',
}

/** Document RH d'un collaborateur : contrat, avenant, attestation, etc. */
export interface MemberDocument {
  id: string
  establishment_id: string
  member_id: string
  kind: MemberDocumentKind
  label: string
  signed_date: string | null
  file_path: string
  file_url: string
  file_size: number | null
  uploaded_by: string
  created_at: string
}

/** Type d'évènement déclencheur d'enquête de satisfaction */
export type SatisfactionSurveyKind = 'adoption' | 'donation' | 'foster'

export const SATISFACTION_KIND_LABELS: Record<SatisfactionSurveyKind, string> = {
  adoption: 'Adoption',
  donation: 'Don',
  foster: 'Famille d\'accueil',
}

/** Enquête NPS envoyée après un évènement (adoption / don / foster) */
export interface SatisfactionSurvey {
  id: string
  establishment_id: string
  kind: SatisfactionSurveyKind
  related_id: string
  recipient_name: string | null
  recipient_email: string
  token: string
  scheduled_for: string
  sent_at: string | null
  send_error: string | null
  completed_at: string | null
  nps_score: number | null
  verbatim: string | null
  resolved_at: string | null
  resolved_by: string | null
  resolution_notes: string | null
  created_at: string
  updated_at: string
}

/** Classification NPS standard : promoteur 9-10, passif 7-8, détracteur 0-6 */
export type NpsBucket = 'promoter' | 'passive' | 'detractor'

export function npsBucketOf(score: number | null): NpsBucket | null {
  if (score === null || score === undefined) return null
  if (score >= 9) return 'promoter'
  if (score >= 7) return 'passive'
  return 'detractor'
}

// ============================================
// Planning vétérinaire (visites quotidiennes — style Google Sheet)
// ============================================

export type VetVisitActKey =
  | 'puce'           // identification
  | 'cession'        // cession véto
  // Vaccins (anciens : conservés en lecture, ne déclenchent plus de rappel auto)
  | 'vaccin_chien'
  | 'vaccin_chat'
  // Vaccins (nouveaux : 3 sous-types par espèce, auto-calcul du prochain rappel
  // via lib/health/vaccine-schedule.ts)
  | 'vaccin_chien_primo'
  | 'vaccin_chien_rappel_mois'
  | 'vaccin_chien_rappel_annuel'
  | 'vaccin_chat_primo'
  | 'vaccin_chat_rappel_mois'
  | 'vaccin_chat_rappel_annuel'
  | 'visite_divers' // = consultation
  | 'importation'
  | 'test_leucose'  // = blood_test
  | 'consultation'
  | 'sterilization'
  | 'antiparasitic'
  | 'radio'

export type VetVisitActs = Partial<Record<VetVisitActKey, boolean>>

export interface VetVisit {
  id: string
  establishment_id: string
  visit_date: string
  time_label: string | null
  location_label: string | null
  veterinarian_id: string | null
  vet_label: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  /** Récap auto envoyé à la clinique vétérinaire */
  recap_sent_at: string | null
  recap_sent_by: string | null
  recap_sent_to: string | null
  recap_storage_path: string | null
  recap_email_message_id: string | null
}

export interface VetVisitLine {
  id: string
  visit_id: string
  animal_id: string
  line_order: number
  acts: VetVisitActs
  chip_number: string | null
  weight: number | null
  cost: number | null
  observations: string | null
  complement: string | null
  validated_at: string | null
  validated_by: string | null
  created_at: string
  updated_at: string
}

export interface VetVisitLineWithAnimal extends VetVisitLine {
  animal: Pick<Animal, 'id' | 'name' | 'species' | 'medal_number' | 'breed' | 'breed_cross' | 'color' | 'box_id' | 'chip_number'>
}

export interface VetVisitWithLines extends VetVisit {
  lines: VetVisitLineWithAnimal[]
}

// ============================================
// Animal Attachments (PDFs, certificats, etc.)
// ============================================

export interface AnimalAttachment {
  id: string
  animal_id: string
  establishment_id: string
  filename: string
  file_path: string
  file_url: string
  mime_type: string | null
  size_bytes: number | null
  label: string | null
  uploaded_by: string | null
  created_at: string
}

// ============================================
// Payment Entries (saisies de règlement)
// ============================================

export type PaymentEntryMethod = 'cheque' | 'virement' | 'especes' | 'cb' | 'prelevement' | 'helloasso' | 'autre'
export type PaymentEntryType = 'pension' | 'adoption' | 'don' | 'fourriere' | 'autre'
export type PaymentEntryInstallment = 'acompte' | 'solde' | 'total'

export interface PaymentEntry {
  id: string
  establishment_id: string
  amount: number
  payment_date: string
  method: PaymentEntryMethod
  payment_type: PaymentEntryType
  installment: PaymentEntryInstallment
  payer_name: string | null
  payer_phone: string | null
  payer_email: string | null
  reference: string | null
  related_document_id: string | null
  related_donation_id: string | null
  related_animal_id: string | null
  related_client_id: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface PaymentEntryWithRelations extends PaymentEntry {
  related_animal?: { id: string; name: string } | null
  related_client?: { id: string; kind: ClientKind; name: string; first_name: string | null } | null
  related_document?: { id: string; numero: string; type: DocumentType } | null
  related_donation?: { id: string; donor_name: string } | null
}

// ============================================
// Notifications
// ============================================

export type NotificationType =
  | 'leave_request_submitted'
  | 'leave_request_approved'
  | 'leave_request_refused'
  | 'payslip_uploaded'
  | 'member_document_uploaded'
  | 'treatment_new'
  | 'health_reminder'
  | 'general'

export interface Notification {
  id: string
  establishment_id: string
  user_id: string
  type: NotificationType
  title: string
  body: string | null
  link: string | null
  read: boolean
  read_at: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface NotificationPreferences {
  id: string
  user_id: string
  email_enabled: boolean
  push_enabled: boolean
  push_subscription: Record<string, unknown> | null
  leave_email: boolean
  leave_push: boolean
  payslip_email: boolean
  payslip_push: boolean
  created_at: string
  updated_at: string
}

// ============================================================
// Parrainage (sponsorships)
// ============================================================
export type SponsorshipStatus = 'active' | 'pending' | 'ended'
export type SponsorshipKind = 'financial_monthly' | 'financial_punctual' | 'symbolic'
export type SponsorshipEndedReason =
  | 'animal_adopted'
  | 'animal_deceased'
  | 'animal_transferred'
  | 'animal_returned'
  | 'sponsor_cancelled'
  | 'sponsor_deceased'
  | 'other'

export interface Sponsorship {
  id: string
  establishment_id: string
  animal_id: string
  client_id: string
  status: SponsorshipStatus
  kind: SponsorshipKind
  monthly_amount: number | null
  started_at: string
  ended_at: string | null
  ended_reason: SponsorshipEndedReason | null
  public_alias: string | null
  show_publicly: boolean
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// Inclut les relations souvent fetchées en même temps
export interface SponsorshipWithAnimal extends Sponsorship {
  animal: Pick<Animal, 'id' | 'name' | 'species' | 'status' | 'photo_url'> | null
}

export interface SponsorshipWithClient extends Sponsorship {
  client: Pick<Client, 'id' | 'kind' | 'name' | 'first_name' | 'email' | 'phone' | 'city'> | null
  total_donated?: number  // Cumul des dons fléchés (calculé en server action)
}

export const SPONSORSHIP_KIND_LABELS: Record<SponsorshipKind, string> = {
  financial_monthly: 'Mensuel',
  financial_punctual: 'Ponctuel',
  symbolic: 'Symbolique',
}

export const SPONSORSHIP_STATUS_LABELS: Record<SponsorshipStatus, string> = {
  active: 'Actif',
  pending: 'En attente',
  ended: 'Terminé',
}

export const SPONSORSHIP_ENDED_REASON_LABELS: Record<SponsorshipEndedReason, string> = {
  animal_adopted: 'Animal adopté',
  animal_deceased: 'Animal décédé',
  animal_transferred: 'Animal transféré',
  animal_returned: 'Animal retourné',
  sponsor_cancelled: 'Parrain a annulé',
  sponsor_deceased: 'Parrain décédé',
  other: 'Autre',
}

// ============================================================
// Partenaires sorties (Akéla & co)
// ============================================================
export type OutingPartnerKind = 'educator' | 'club' | 'walker' | 'foster_pro' | 'other'

export interface OutingPartner {
  id: string
  establishment_id: string
  name: string
  kind: OutingPartnerKind
  default_outing_label: string | null
  contact_phone: string | null
  contact_email: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export const OUTING_PARTNER_KIND_LABELS: Record<OutingPartnerKind, string> = {
  educator: 'Éducateur canin',
  club: 'Club canin',
  walker: 'Promeneur',
  foster_pro: 'FA pro',
  other: 'Autre',
}

// ============================================
// Animal News (Nouvelles post-adoption / FA)
// ============================================

export interface AnimalNewsPhoto {
  url: string
  path: string
}

export interface AnimalNews {
  id: string
  establishment_id: string
  animal_id: string
  photos: AnimalNewsPhoto[]
  text: string | null
  received_from: string | null
  received_at: string
  posted_at: string | null
  posted_in_mosaic_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface AnimalNewsWithAnimal extends AnimalNews {
  animal: Pick<Animal, 'id' | 'name' | 'species' | 'sex' | 'status' | 'exit_date' | 'photo_url' | 'birth_date'>
}

export interface AnimalNewsMosaic {
  id: string
  establishment_id: string
  news_ids: string[]
  title: string | null
  generated_image_url: string | null
  posted_at: string | null
  created_by: string | null
  created_at: string
}

/** Animaux encore sous responsabilité du refuge — module "Suivi des protégés". */
export const SHELTERED_STATUSES: AnimalStatus[] = ['shelter', 'pound', 'boarding', 'foster_family']

/** Animaux sortis du refuge — module "Nouvelles des sortis". */
export const ALUMNI_STATUSES: AnimalStatus[] = ['adopted', 'transferred', 'returned']

/** Catégorie d'une news, dérivée du statut de l'animal. */
export type NewsCategory = 'sheltered' | 'alumni'

/**
 * @deprecated Utilisez SHELTERED_STATUSES ou ALUMNI_STATUSES selon le contexte.
 * Conservé pour rétrocompatibilité de l'ancien onglet unique "Nouvelles".
 */
export const ANIMAL_NEWS_ELIGIBLE_STATUSES: AnimalStatus[] = [...SHELTERED_STATUSES, ...ALUMNI_STATUSES]


// ============================================================
// CRA — Compte-Rendu d'Activité (heures travaillées)
// ============================================================

/** Jour de la semaine (0=dim, 6=sam) */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6

/** Semaine type d'un salarié — base de pré-remplissage des CRA mensuels */
export interface MemberWorkSchedule {
  id: string
  member_id: string
  establishment_id: string
  day_of_week: DayOfWeek
  is_rest_day: boolean
  start_am: string | null   // 'HH:MM:SS'
  end_am: string | null
  start_pm: string | null
  end_pm: string | null
  valid_from: string        // 'YYYY-MM-DD'
  valid_until: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

/** Surcharge d'un jour précis dans le CRA (uniquement si différent du template) */
export interface CraEntry {
  id: string
  member_id: string
  establishment_id: string
  date: string              // 'YYYY-MM-DD'
  is_rest_day: boolean
  start_am: string | null
  end_am: string | null
  start_pm: string | null
  end_pm: string | null
  hours_total: number       // computed côté SQL
  notes: string | null
  entered_by: string | null
  entered_at: string
  updated_at: string
}

/** Statut du workflow CRA pour un (membre, mois) */
export type CraStatus =
  | 'draft'                  // Mary en train de saisir
  | 'submitted'              // Mary a soumis au collaborateur
  | 'validated_by_member'    // Collaborateur a validé — en attente validation admin
  | 'validated_by_admin'     // Admin (Clément/Céline) a validé — prêt pour envoi comptable
  | 'change_requested'       // Collaborateur a demandé modif
  | 'sent'                   // Envoyé au comptable

export interface CraMonthlyStatus {
  id: string
  member_id: string
  establishment_id: string
  year: number
  month: number             // 1-12
  status: CraStatus
  submitted_at: string | null
  submitted_by: string | null
  validated_at: string | null
  validated_by: string | null
  admin_validated_at: string | null
  admin_validated_by: string | null
  change_requested_at: string | null
  change_request_comment: string | null
  sent_at: string | null
  sent_by: string | null
  sent_to: string | null
  created_at: string
  updated_at: string
}

/** Trace d'une demande de modification — Clément est notifié */
export interface CraChangeRequest {
  id: string
  cra_status_id: string
  member_id: string
  establishment_id: string
  requested_at: string
  requested_by: string | null
  comment: string
  resolved_at: string | null
  resolved_by: string | null
  resolution_notes: string | null
}

/** Astreinte : un membre est de garde sur une semaine entière (lundi → lundi).
 * Forfait calculé par le comptable. Une seule personne par semaine et établissement. */
export interface CraAstreinte {
  id: string
  member_id: string
  establishment_id: string
  week_start_monday: string  // 'YYYY-MM-DD' (toujours un lundi)
  notes: string | null
  created_at: string
  created_by: string | null
  updated_at: string
}

/** Astreinte enrichie avec le nom du membre (pour les vues admin/PDF) */
export interface CraAstreinteWithMember extends CraAstreinte {
  member_name: string | null
  member_pseudo: string | null
}

export const CRA_STATUS_LABELS: Record<CraStatus, string> = {
  draft: 'Brouillon',
  submitted: 'Soumis au collaborateur',
  validated_by_member: 'Validé collaborateur — en attente admin',
  validated_by_admin: 'Validé admin — prêt à envoyer',
  change_requested: 'Modification demandée',
  sent: 'Envoyé au comptable',
}

export const CRA_STATUS_COLORS: Record<CraStatus, string> = {
  draft: 'gray',
  submitted: 'blue',
  validated_by_member: 'teal',
  validated_by_admin: 'green',
  change_requested: 'orange',
  sent: 'purple',
}

export const DAY_OF_WEEK_LABELS: Record<DayOfWeek, string> = {
  0: 'Dimanche',
  1: 'Lundi',
  2: 'Mardi',
  3: 'Mercredi',
  4: 'Jeudi',
  5: 'Vendredi',
  6: 'Samedi',
}

export const DAY_OF_WEEK_LABELS_SHORT: Record<DayOfWeek, string> = {
  0: 'Dim',
  1: 'Lun',
  2: 'Mar',
  3: 'Mer',
  4: 'Jeu',
  5: 'Ven',
  6: 'Sam',
}

/** Source d'un jour dans le CRA mensuel pré-rempli */
export type CraDaySource = 'template' | 'override' | 'leave' | 'holiday' | 'extended_leave'

/** Un jour du CRA mensuel (vue dérivée combinant template + overrides + congés) */
export interface CraDay {
  date: string              // 'YYYY-MM-DD'
  weekday: DayOfWeek
  source: CraDaySource
  is_rest_day: boolean
  start_am: string | null
  end_am: string | null
  start_pm: string | null
  end_pm: string | null
  hours_total: number
  leave_label?: string
  leave_type_id?: string
  leave_status?: 'approved' | 'pending'
  holiday_name?: string
  notes?: string | null
}

/** Vue complète d'un mois pour un salarié */
export interface CraMonthlyView {
  member_id: string
  member_name: string
  member_pseudo: string | null
  year: number
  month: number
  days: CraDay[]
  total_worked_hours: number
  total_leave_hours: number
  total_rest_days: number
  astreinte_weeks: string[]  // Liste des lundis de semaines d'astreinte du mois
  status: CraStatus
  status_record_id: string | null
  submitted_at: string | null
  validated_at: string | null
  admin_validated_at: string | null
  change_request_comment: string | null
  sent_at: string | null
  sent_to: string | null
}

// Étend NotificationType avec les types CRA (au runtime, c'est juste du TEXT en DB)
export type CraNotificationType =
  | 'cra_change_requested'
  | 'cra_submitted'
  | 'cra_validated'
  | 'cra_sent'

// =========================================================================
// Public forms (formulaires globaux du site sda-nord.com)
// Source : migration `public_forms_volunteer_abuse_reports` (mai 2026)
// Reçues côté admin Optimus via les vues /admin/candidatures-* et
// /admin/signalements-*. RLS scopée par établissement + permission booléenne.
// =========================================================================

// --- Adoption pre-qualification (extension de adoption_inquiries) ---

export type AdoptionInquiryType = 'specific_animal' | 'pre_qualification'
export type AdoptionInquiryStatus =
  | 'pending'
  | 'qualified'
  | 'interview_scheduled'
  | 'accepted'
  | 'declined'
  | 'archived'

export interface AdoptionInquiry {
  id: string
  establishment_id: string
  animal_id: string | null
  client_id: string | null
  appointment_id: string | null
  inquiry_type: AdoptionInquiryType
  first_name: string
  last_name: string
  email: string
  phone: string
  address: string | null
  postal_code: string | null
  city: string | null
  questionnaire: Record<string, unknown>
  status: AdoptionInquiryStatus
  source: string
  team_notes: string | null
  refusal_reason: string | null
  possible_blacklist_match: boolean
  ip_address: string | null
  user_agent: string | null
  created_at: string
  updated_at: string
  // Portal Sprint 1 — comptes utilisateurs + tickets unifiés
  user_id: string | null
  ticket_number: string
}

// --- Volunteer applications ---

export type VolunteerSkill =
  | 'dog_walking'
  | 'animal_care'
  | 'public_reception'
  | 'transport'
  | 'grooming'
  | 'maintenance'
  | 'communication'
  | 'events'
  | 'admin'

export interface VolunteerAvailability {
  days: Array<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'>
  slots: Array<'morning' | 'afternoon' | 'evening'>
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'occasional'
  start_date?: string
}

export type VolunteerApplicationStatus =
  | 'pending'
  | 'qualified'
  | 'interview_scheduled'
  | 'accepted'
  | 'declined'
  | 'archived'

export interface VolunteerApplication {
  id: string
  establishment_id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  birth_date: string | null
  address: string | null
  postal_code: string | null
  city: string | null
  motivation: string
  availability: VolunteerAvailability
  skills: VolunteerSkill[]
  has_driving_license: boolean
  physical_capacity: 'good' | 'limited' | 'restricted' | null
  has_allergies: boolean
  allergies_details: string | null
  previous_experience: string | null
  clean_record_declared: boolean
  status: VolunteerApplicationStatus
  admin_notes: string | null
  qualified_at: string | null
  qualified_by: string | null
  source: string
  ip_address: string | null
  user_agent: string | null
  created_at: string
  updated_at: string
  // Portal Sprint 1 — comptes utilisateurs + tickets unifiés
  user_id: string | null
  ticket_number: string
}

// --- Foster applications (candidatures famille d'accueil) ---

export type FosterApplicationStatus =
  | 'pending'
  | 'qualified'
  | 'interview_scheduled'
  | 'home_visit_scheduled'
  | 'accepted'
  | 'declined'
  | 'archived'

export type HousingType = 'house' | 'apartment' | 'other'

export type FosterType =
  | 'puppies'
  | 'kittens'
  | 'convalescents'
  | 'timid'
  | 'emergency'
  | 'all'

export interface FosterApplication {
  id: string
  establishment_id: string

  // Identité
  first_name: string
  last_name: string
  email: string
  phone: string
  birth_date: string | null
  profession: string | null
  address: string | null
  postal_code: string | null
  city: string | null

  // Logement
  housing_type: HousingType | null
  has_garden: boolean
  garden_size_text: string | null
  has_separate_room: boolean

  // Foyer
  household_size: number
  has_children: boolean
  children_ages_text: string | null
  household_agreement: boolean

  // Animaux personnels
  has_pets: boolean
  pets_details: string | null
  pets_vaccinated: boolean | null

  // Disponibilité
  available_from: string | null
  can_foster_types: FosterType[]
  max_duration_weeks: number | null
  transport_available: boolean

  // Expérience
  prior_foster_experience: boolean
  prior_experience_details: string | null

  // Motivation + engagement
  motivation: string
  clean_record_declared: boolean

  // Workflow
  status: FosterApplicationStatus
  admin_notes: string | null
  qualified_at: string | null
  qualified_by: string | null

  // Traçabilité
  source: string
  ip_address: string | null
  user_agent: string | null

  // Portal
  user_id: string | null
  ticket_number: string

  created_at: string
  updated_at: string
}

// --- Abuse reports (signalements maltraitance) ---

export type AnimalType = 'dog' | 'cat' | 'farm' | 'wildlife' | 'other'
export type AnimalCondition = 'alive_apparently_ok' | 'injured' | 'dying' | 'dead'
export type AbuseType =
  | 'abandonment'
  | 'neglect'
  | 'physical_violence'
  | 'inadequate_conditions'
  | 'psychological'
  | 'illegal_breeding'
  | 'other'
export type AbuseSeverity = 'urgent' | 'serious' | 'recurring' | 'suspicion'
export type AbuseReportStatus =
  | 'new'
  | 'investigating'
  | 'transmitted_authorities'
  | 'on_site_intervention'
  | 'resolved'
  | 'unfounded'
  | 'archived'

export interface AbuseReport {
  id: string
  establishment_id: string
  reporter_is_anonymous: boolean
  reporter_first_name: string | null
  reporter_last_name: string | null
  reporter_email: string
  reporter_phone: string | null
  location_address: string
  location_city: string
  location_postal_code: string
  location_details: string | null
  location_latitude: number | null
  location_longitude: number | null
  animal_type: AnimalType
  animal_count_estimate: number
  animal_condition: AnimalCondition
  abuse_types: AbuseType[]
  severity: AbuseSeverity
  first_observed_date: string | null
  last_observed_date: string | null
  description: string
  prior_actions: string[]
  prior_actions_details: string | null
  has_witnesses: boolean
  witnesses_contact: string | null
  consent_share_authorities: boolean
  status: AbuseReportStatus
  admin_notes: string | null
  resolved_at: string | null
  resolved_by: string | null
  resolution_summary: string | null
  source: string
  ip_address: string | null
  user_agent: string | null
  created_at: string
  updated_at: string
  // Portal Sprint 1 — comptes utilisateurs + tickets unifiés
  user_id: string | null
  ticket_number: string
}

export interface AbuseReportPhoto {
  id: string
  report_id: string
  storage_path: string
  original_filename: string | null
  size_bytes: number | null
  mime_type: string | null
  uploaded_at: string
}

// =========================================================================
// Portal Sprint 1 — comptes utilisateurs et tickets unifiés
// Voir migration : supabase/migrations/20260529a_portal_sprint1_accounts_and_tickets.sql
// =========================================================================

export interface PortalProfile {
  user_id: string
  first_name: string
  last_name: string
  phone: string | null
  address: string | null
  postal_code: string | null
  city: string | null
  consent_marketing: boolean
  created_at: string
  updated_at: string
}

/** Profil portal enrichi avec l'email récupéré côté admin via supabaseAdmin. */
export interface PortalProfileWithEmail extends PortalProfile {
  email: string | null
}

export type PortalTicketType = 'adoption' | 'volunteer' | 'abuse_report'

export type PortalTicketEventType =
  | 'created'
  | 'status_change'
  | 'comment_user'
  | 'message_staff'
  | 'attachment_added'

export type PortalTicketEventRole = 'user' | 'staff' | 'system'

export interface PortalTicketEvent {
  id: string
  ticket_type: PortalTicketType
  ticket_id: string
  event_type: PortalTicketEventType
  payload: Record<string, unknown>
  performed_by: string | null
  performed_by_role: PortalTicketEventRole
  created_at: string
}

/** Event enrichi avec le nom de l'auteur pour l'affichage admin. */
export interface PortalTicketEventWithActor extends PortalTicketEvent {
  actor_name: string | null
  actor_email: string | null
}
