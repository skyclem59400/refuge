export type ClientType = 'particulier' | 'organisation'
export type DocumentType = 'devis' | 'facture' | 'avoir'
export type DocumentStatus = 'draft' | 'sent' | 'paid' | 'cancelled' | 'converted' | 'validated'
export type EstablishmentRole = 'admin' | 'member'
export type Permission = 'manage_establishment' | 'manage_documents' | 'manage_clients'

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
  type: ClientType | null
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
  isAdmin: boolean
}

export interface EstablishmentContext {
  establishment: Establishment
  membership: EstablishmentMember
  permissions: Permissions
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
