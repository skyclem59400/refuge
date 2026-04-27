// Documenso API v1 client.
// Doc: https://app.documenso.com/api/v1/openapi
// Endpoints used:
//   POST  /api/v1/documents              create draft + upload + recipients
//   POST  /api/v1/documents/{id}/fields  position signature fields
//   POST  /api/v1/documents/{id}/send    send for signing
//   GET   /api/v1/documents/{id}         fetch status + recipients
//   GET   /api/v1/documents/{id}/download fetch signed PDF

const BASE_URL = process.env.DOCUMENSO_BASE_URL || 'https://signature.optimus-services.fr'
const API_TOKEN = process.env.DOCUMENSO_API_TOKEN || ''

function requireToken(): string {
  if (!API_TOKEN) {
    throw new Error('DOCUMENSO_API_TOKEN not configured. Set it in environment variables.')
  }
  return API_TOKEN
}

function authHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${requireToken()}`,
    'Content-Type': 'application/json',
  }
}

async function apiCall<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init.headers || {}),
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Documenso API ${res.status} on ${path}: ${text}`)
  }
  return res.json() as Promise<T>
}

// ============================================
// Types
// ============================================

export type DocumensoRole = 'SIGNER' | 'CC' | 'APPROVER' | 'VIEWER'
export type DocumensoStatus = 'DRAFT' | 'PENDING' | 'COMPLETED' | 'REJECTED'
export type DocumensoFieldType = 'SIGNATURE' | 'INITIALS' | 'NAME' | 'EMAIL' | 'DATE' | 'TEXT'

export interface DocumensoRecipientInput {
  email: string
  name: string
  role?: DocumensoRole
  signingOrder?: number
}

export interface DocumensoRecipient {
  id: number
  email: string
  name: string
  role: DocumensoRole
  signingStatus: 'NOT_SIGNED' | 'SIGNED' | 'REJECTED'
  sendStatus: 'NOT_SENT' | 'SENT'
  signedAt: string | null
  signingUrl?: string
  token?: string
}

export interface DocumensoDocument {
  id: number
  externalId: string | null
  title: string
  status: DocumensoStatus
  documentDataId: string
  createdAt: string
  updatedAt: string
  completedAt: string | null
  Recipient?: DocumensoRecipient[]
  recipients?: DocumensoRecipient[]
}

export interface DocumensoFieldInput {
  recipientId: number
  type: DocumensoFieldType
  pageNumber: number
  pageX: number
  pageY: number
  pageWidth: number
  pageHeight: number
}

// ============================================
// Operations
// ============================================

export interface CreateDocumentParams {
  title: string
  externalId?: string
  recipients: DocumensoRecipientInput[]
  pdfBase64: string
  pdfFileName: string
}

export interface CreateDocumentResult {
  document: DocumensoDocument
  uploadUrl?: string
}

/**
 * Create a draft document with recipients. Documenso v1 expects the PDF
 * payload to be passed at creation time as base64.
 */
export async function createDocument(params: CreateDocumentParams): Promise<DocumensoDocument> {
  const body = {
    title: params.title,
    externalId: params.externalId,
    recipients: params.recipients.map((r, i) => ({
      email: r.email,
      name: r.name,
      role: r.role || 'SIGNER',
      signingOrder: r.signingOrder ?? i + 1,
    })),
    documentDataType: 'BYTES_64',
    documentDataData: params.pdfBase64,
    fileName: params.pdfFileName,
  }
  return apiCall<DocumensoDocument>('/api/v1/documents', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** Add a signature field to a recipient on a document. */
export async function addField(documentId: number, field: DocumensoFieldInput): Promise<unknown> {
  return apiCall(`/api/v1/documents/${documentId}/fields`, {
    method: 'POST',
    body: JSON.stringify(field),
  })
}

/** Trigger the email send to all recipients (moves status DRAFT -> PENDING). */
export async function sendDocument(documentId: number, opts?: { sendEmail?: boolean }): Promise<DocumensoDocument> {
  return apiCall(`/api/v1/documents/${documentId}/send`, {
    method: 'POST',
    body: JSON.stringify({ sendEmail: opts?.sendEmail ?? true }),
  })
}

/** Get current state of a document (status, recipients with signed timestamps). */
export async function getDocument(documentId: number): Promise<DocumensoDocument> {
  return apiCall<DocumensoDocument>(`/api/v1/documents/${documentId}`)
}

/** Download the signed PDF as ArrayBuffer (only available once status = COMPLETED). */
export async function downloadSignedPdf(documentId: number): Promise<ArrayBuffer> {
  const res = await fetch(`${BASE_URL}/api/v1/documents/${documentId}/download`, {
    headers: { Authorization: `Bearer ${requireToken()}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Documenso download ${res.status}: ${text}`)
  }
  return res.arrayBuffer()
}

/** Convenience: check if all recipients of a doc have signed. */
export function isDocumentFullySigned(doc: DocumensoDocument): boolean {
  if (doc.status === 'COMPLETED') return true
  const recipients = doc.recipients ?? doc.Recipient ?? []
  return recipients.length > 0 && recipients.every((r) => r.signingStatus === 'SIGNED')
}
