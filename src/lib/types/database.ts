export type ContactCategory = 'client' | 'member' | 'volunteer' | 'board_member' | 'foster_family' | 'veterinarian'
export type DocumentType = 'devis' | 'facture' | 'avoir'
export type DocumentStatus = 'draft' | 'sent' | 'paid' | 'cancelled' | 'converted' | 'validated'
export type EstablishmentRole = 'admin' | 'member'
export type Permission = 'manage_establishment' | 'manage_documents' | 'manage_clients' | 'manage_animals' | 'view_animals' | 'manage_health' | 'manage_movements' | 'manage_boxes' | 'manage_posts' | 'manage_donations' | 'view_pound' | 'view_statistics' | 'manage_outings'

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
  logo_url: string | null
  type: EstablishmentType
  created_at: string
  updated_at: string
}

export interface EstablishmentMember {
  id: string
  establishment_id: string
  user_id: string
  role: EstablishmentRole
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
  view_pound: boolean
  view_statistics: boolean
  created_at: string
  updated_at: string
  // Enriched from auth.users via RPC
  email?: string
  full_name?: string | null
  avatar_url?: string | null
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
  canViewPound: boolean
  canViewStatistics: boolean
  isAdmin: boolean
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
}

// ============================================
// SDA Estormel - Animal Shelter Types
// ============================================

export type AnimalSpecies = 'cat' | 'dog'
export type AnimalSex = 'male' | 'female' | 'unknown'
export type AnimalStatus = 'pound' | 'shelter' | 'foster_family' | 'boarding' | 'adopted' | 'returned' | 'transferred' | 'deceased' | 'euthanized'
export type AnimalOrigin = 'found' | 'abandoned' | 'transferred_in' | 'surrender' | 'requisition' | 'divagation'
export type MovementType = 'pound_entry' | 'shelter_transfer' | 'adoption' | 'return_to_owner' | 'transfer_out' | 'death' | 'euthanasia'
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
  icad_updated: boolean
  status: AnimalStatus
  behavior_score: number | null
  description: string | null
  capture_location: string | null
  capture_circumstances: string | null
  origin_type: AnimalOrigin
  box_id: string | null
  pound_entry_date: string | null
  shelter_entry_date: string | null
  exit_date: string | null
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
  created_at: string
}

export interface AnimalHealthRecord {
  id: string
  animal_id: string
  type: HealthRecordType
  date: string
  description: string
  veterinarian: string | null
  next_due_date: string | null
  cost: number | null
  notes: string | null
  created_by: string | null
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
