/**
 * HelloAsso API v5 Client
 *
 * OAuth2 client_credentials flow with automatic token refresh.
 * Amounts from HelloAsso are in centimes — divide by 100 for EUR.
 * Pagination uses continuationToken — stop when data array is empty.
 */

import { createAdminClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOKEN_ENDPOINT = 'https://api.helloasso.com/oauth2/token'
const API_BASE = 'https://api.helloasso.com/v5'

// ---------------------------------------------------------------------------
// HelloAsso API response types
// ---------------------------------------------------------------------------

export interface HelloAssoTokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number // seconds
}

export interface HelloAssoPayer {
  email: string
  firstName: string
  lastName: string
  address?: string
  city?: string
  zipCode?: string
  country?: string
  company?: string
}

export interface HelloAssoPaymentItem {
  id: number
  amount: number // centimes
  type: string
  state: string
}

export interface HelloAssoPayment {
  id: number
  date: string // ISO 8601
  amount: number // centimes
  state: string // 'Authorized' | 'Refused' | etc.
  paymentReceiptUrl?: string
  payer: HelloAssoPayer
  order?: {
    id: number
    formSlug: string
    formType: string
  }
  items: HelloAssoPaymentItem[]
  cashOutState?: string
  meta?: {
    createdAt: string
    updatedAt: string
  }
}

export interface HelloAssoPaymentsResponse {
  data: HelloAssoPayment[]
  pagination: {
    pageSize: number
    totalCount: number
    pageIndex: number
    totalPages: number
    continuationToken: string | null
  }
}

export interface HelloAssoOrganization {
  name: string
  role?: string
  type?: string
  url?: string
  description?: string
  logo?: string
  fiscalReceiptEligibility?: boolean
  category?: string
  city?: string
  zipCode?: string
  banner?: string
}

export interface HelloAssoPaymentsParams {
  from?: string // ISO date
  to?: string // ISO date
  pageSize?: number
  continuationToken?: string
  states?: string // e.g. 'Authorized'
}

// ---------------------------------------------------------------------------
// OAuth2 — authenticate with client_credentials
// ---------------------------------------------------------------------------

export async function authenticate(
  clientId: string,
  clientSecret: string
): Promise<HelloAssoTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  })

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HelloAsso authentication failed (${res.status}): ${text}`)
  }

  return res.json() as Promise<HelloAssoTokenResponse>
}

// ---------------------------------------------------------------------------
// OAuth2 — refresh an existing token
// ---------------------------------------------------------------------------

export async function refreshAccessToken(
  clientId: string,
  refreshToken: string
): Promise<HelloAssoTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    refresh_token: refreshToken,
  })

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HelloAsso token refresh failed (${res.status}): ${text}`)
  }

  return res.json() as Promise<HelloAssoTokenResponse>
}

// ---------------------------------------------------------------------------
// Token management — ensure a valid access token for a given connection
// ---------------------------------------------------------------------------

/**
 * Returns a valid access_token for the given HelloAsso connection.
 * If the current token is expired (or about to expire within 60s),
 * it refreshes the token and persists the new tokens in Supabase.
 */
export async function getValidAccessToken(connectionId: string): Promise<string> {
  const supabase = createAdminClient()

  const { data: conn, error } = await supabase
    .from('helloasso_connections')
    .select('*')
    .eq('id', connectionId)
    .single()

  if (error || !conn) {
    throw new Error('HelloAsso connection not found')
  }

  // Check if we have a token and it is still valid (with 60s buffer)
  const now = Date.now()
  const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0
  const isExpired = !conn.access_token || now >= expiresAt - 60_000

  if (!isExpired) {
    return conn.access_token as string
  }

  // Try refresh first, fall back to full re-authentication
  let tokens: HelloAssoTokenResponse

  if (conn.refresh_token) {
    try {
      tokens = await refreshAccessToken(conn.client_id, conn.refresh_token)
    } catch {
      // Refresh token may be revoked — re-authenticate from scratch
      tokens = await authenticate(conn.client_id, conn.client_secret)
    }
  } else {
    tokens = await authenticate(conn.client_id, conn.client_secret)
  }

  // Persist new tokens
  const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  const { error: updateError } = await supabase
    .from('helloasso_connections')
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: tokenExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', connectionId)

  if (updateError) {
    throw new Error(`Failed to persist HelloAsso tokens: ${updateError.message}`)
  }

  return tokens.access_token
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function apiGet<T>(accessToken: string, path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HelloAsso API error ${res.status} on ${path}: ${text}`)
  }

  return res.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// API methods
// ---------------------------------------------------------------------------

/**
 * Fetch a paginated list of payments for an organization.
 */
export async function getPayments(
  accessToken: string,
  orgSlug: string,
  params?: HelloAssoPaymentsParams
): Promise<HelloAssoPaymentsResponse> {
  const qs = new URLSearchParams()

  if (params?.from) qs.set('from', params.from)
  if (params?.to) qs.set('to', params.to)
  if (params?.pageSize) qs.set('pageSize', String(params.pageSize))
  if (params?.continuationToken) qs.set('continuationToken', params.continuationToken)
  if (params?.states) qs.set('states', params.states)

  const queryString = qs.toString()
  const path = `/organizations/${orgSlug}/payments${queryString ? `?${queryString}` : ''}`

  return apiGet<HelloAssoPaymentsResponse>(accessToken, path)
}

/**
 * Fetch all payments using automatic pagination.
 * Stops when the data array is empty (NOT when continuationToken is null).
 */
export async function getAllPayments(
  accessToken: string,
  orgSlug: string,
  params?: Omit<HelloAssoPaymentsParams, 'continuationToken'>
): Promise<HelloAssoPayment[]> {
  const allPayments: HelloAssoPayment[] = []
  let continuationToken: string | undefined

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const response = await getPayments(accessToken, orgSlug, {
      ...params,
      pageSize: params?.pageSize ?? 100,
      continuationToken,
    })

    // Stop when data array is empty
    if (!response.data || response.data.length === 0) {
      break
    }

    allPayments.push(...response.data)

    // Move to next page
    if (response.pagination.continuationToken) {
      continuationToken = response.pagination.continuationToken
    } else {
      break
    }
  }

  return allPayments
}

/**
 * Fetch organization details.
 */
export async function getOrganization(
  accessToken: string,
  orgSlug: string
): Promise<HelloAssoOrganization> {
  return apiGet<HelloAssoOrganization>(accessToken, `/organizations/${orgSlug}`)
}
