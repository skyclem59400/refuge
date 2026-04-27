export type RoleType = 'admin' | 'salarie' | 'benevole'
export type ContactCategory = 'client' | 'member' | 'volunteer' | 'board_member' | 'foster_family' | 'veterinarian'
export type DocumentType = 'devis' | 'facture' | 'avoir'
export type DocumentStatus = 'draft' | 'sent' | 'paid' | 'cancelled' | 'converted' | 'validated'
export type DocumentPaymentMethod = 'cheque' | 'virement' | 'especes' | 'cb' | 'prelevement' | 'autre'
export type Permission = 'manage_establishment' | 'manage_documents' | 'manage_clients' | 'manage_animals' | 'view_animals' | 'manage_health' | 'manage_movements' | 'manage_boxes' | 'manage_posts' | 'manage_donations' | 'view_pound' | 'view_statistics' | 'manage_outings' | 'manage_outing_assignments' | 'manage_adoptions' | 'manage_planning' | 'manage_leaves' | 'view_own_leaves' | 'manage_payslips'

export interface LineItem {
  description: string
  quantity: number
  unit_price: number
  total: number
}

export interface Client {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  postal_code: string | null
  city: string | null
  type: ContactCategory | null
  notes: string | null
  establishment_id: string
  created_at: string
  updated_at: string
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
  created_at: string
  updated_at: string
}

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

export type AnimalSpecies = 'cat' | 'dog'
export type AnimalSex = 'male' | 'female' | 'unknown'
export type AnimalStatus = 'pound' | 'shelter' | 'foster_family' | 'boarding' | 'adopted' | 'returned' | 'transferred' | 'deceased' | 'euthanized'
export type AnimalOrigin = 'found' | 'abandoned' | 'transferred_in' | 'surrender' | 'requisition' | 'divagation'
export type MovementType = 'pound_entry' | 'shelter_transfer' | 'foster_placement' | 'adoption' | 'return_to_owner' | 'transfer_out' | 'death' | 'euthanasia'
export type HealthRecordType = 'vaccination' | 'sterilization' | 'antiparasitic' | 'consultation' | 'surgery' | 'medication' | 'behavioral_assessment'
export type IcadStatus = 'pending' | 'declared' | 'not_required'
export type BoxSpecies = 'cat' | 'dog' | 'mixed'
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
  chip_number: string | null
  tattoo_number: string | null
  tattoo_position: string | null
  medal_number: string | null
  loof_number: string | null
  passport_number: string | null
  identification_date: string | null
  identifying_veterinarian_id: string | null
  icad_updated: boolean
  status: AnimalStatus
  behavior_score: number | null
  description: string | null
  description_external: string | null
  capture_location: string | null
  capture_circumstances: string | null
  origin_type: AnimalOrigin
  box_id: string | null
  pound_entry_date: string | null
  shelter_entry_date: string | null
  exit_date: string | null
  adoptable: boolean
  reserved: boolean
  retirement_basket: boolean
  ok_cats: boolean | null
  ok_males: boolean | null
  ok_females: boolean | null
  // Hunimalis sync fields
  hunimalis_id: number | null
  photo_url: string | null
  last_synced_at: string | null
  created_at: string
  updated_at: string
}

export interface AnimalPhoto {
  id: string
  animal_id: string
  url: string
  is_primary: boolean
  created_at: string
}

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
export type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled'

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
  created_by: string
  created_at: string
  updated_at: string
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

// ============================================
// Health Protocols (modeles de soins avec rappels)
// ============================================

export type ProtocolApplicableSpecies = 'cat' | 'dog' | 'both'
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
  created_at: string
  updated_at: string
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
  status: LeaveRequestStatus
  reason: string | null
  admin_comment: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
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

// ============================================
// Notifications
// ============================================

export type NotificationType =
  | 'leave_request_submitted'
  | 'leave_request_approved'
  | 'leave_request_refused'
  | 'payslip_uploaded'
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
