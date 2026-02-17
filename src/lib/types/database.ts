export type ClientType = 'particulier' | 'organisation'
export type DocumentType = 'devis' | 'facture'
export type DocumentStatus = 'draft' | 'sent' | 'paid' | 'cancelled'

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
  notes: string | null
  status: DocumentStatus
  converted_from_id: string | null
  converted_to_id: string | null
  pdf_url: string | null
  created_at: string
  updated_at: string
  created_by: string | null
}

export interface CompanyInfo {
  name: string
  description: string
  email: string
  phone: string
  website: string
  iban: string
  address: string
}
