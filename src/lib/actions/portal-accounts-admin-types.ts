// Types pour la vue admin des comptes du portail public.
// Extrait hors du fichier 'use server' (cf. memory gotcha-next16-use-server-exports).

export interface PortalAccountRow {
  user_id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  phone: string | null
  city: string | null
  postal_code: string | null
  consent_marketing: boolean
  created_at: string
  linked_client: { id: string; name: string } | null
  counts: {
    adoption: number
    volunteer: number
    foster: number
  }
}

export interface PortalAccountFilters {
  search?: string | null
  /** true = uniquement liés à un client Optimus, false = uniquement non liés, undefined = tous */
  linkedOnly?: boolean
  limit?: number
}
