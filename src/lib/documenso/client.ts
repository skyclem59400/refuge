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

async function apiCallV2Beta<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}/api/v2-beta${path}`, {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init.headers || {}),
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Documenso v2-beta ${res.status} on ${path}: ${text}`)
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

export interface DocumensoDocumentMeta {
  subject?: string
  message?: string
  timezone?: string
  dateFormat?: string
  redirectUrl?: string
  /** Code langue ISO (ex: "fr", "en"). Détermine la langue du template d'email
   * Documenso (boutons, textes du wrapper). Le `subject` et `message` que
   * nous fournissons s'insèrent DANS ce template, donc sans `language: "fr"`
   * on aurait du français inséré dans un template anglais. */
  language?: string
}

export interface CreateDocumentParams {
  title: string
  externalId?: string
  recipients: DocumensoRecipientInput[]
  /** PDF binaire (Buffer Node ou Uint8Array). Sera uploadé sur l'URL S3 retournée par v2-beta. */
  pdfBuffer: Buffer | Uint8Array
  pdfFileName: string
  meta?: DocumensoDocumentMeta
  /** Optionnel : range le doc dans un dossier dès la création (au lieu d'un /update après). */
  folderId?: string
}

interface V2BetaCreateResponse {
  document: {
    id: number
    title: string
    status: DocumensoStatus
    folderId: string | null
    createdAt: string
    updatedAt: string
  }
  uploadUrl: string
  recipients?: Array<{
    id: number
    email: string
    name: string
    role: DocumensoRole
    signingUrl?: string
    token?: string
  }>
}

/**
 * Crée un document Documenso (v2-beta) puis uploade le PDF sur l'URL S3
 * retournée. C'est le flux requis depuis que l'instance Documenso refuse
 * les uploads inline base64 (v1 retourne 500 "Create document is not
 * available without S3 transport").
 *
 * Retourne le document Documenso au format v1 (id, recipients) pour rester
 * compatible avec addField() et sendDocument() qui sont en v1.
 */
export async function createDocument(params: CreateDocumentParams): Promise<DocumensoDocument> {
  const body: Record<string, unknown> = {
    title: params.title,
    externalId: params.externalId,
    recipients: params.recipients.map((r, i) => ({
      email: r.email,
      name: r.name,
      role: r.role || 'SIGNER',
      signingOrder: r.signingOrder ?? i + 1,
    })),
  }
  if (params.folderId) body.folderId = params.folderId
  if (params.meta) {
    body.meta = {
      timezone: 'Europe/Paris',
      dateFormat: 'dd/MM/yyyy HH:mm',
      ...params.meta,
    }
  }

  // 1. Création via v2-beta : retourne uploadUrl S3
  const created = await apiCallV2Beta<V2BetaCreateResponse>('/document/create/beta', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  // 2. Upload du PDF sur l'URL S3 presigned
  const pdfBytes = params.pdfBuffer instanceof Buffer
    ? new Uint8Array(params.pdfBuffer)
    : params.pdfBuffer
  const uploadRes = await fetch(created.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/pdf' },
    body: pdfBytes as BodyInit,
  })
  if (!uploadRes.ok) {
    const text = await uploadRes.text().catch(() => '')
    throw new Error(`Documenso S3 upload failed (${uploadRes.status}): ${text}`)
  }

  // 3. Récupérer le document complet (avec recipients formattés v1) pour la suite du flux
  return getDocument(created.document.id)
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

/**
 * Download the signed PDF as ArrayBuffer (only available once status = COMPLETED).
 *
 * Endpoint utilisé : v2-beta `/api/v2-beta/document/{id}/download` qui retourne
 * directement le PDF binaire (content-type: application/pdf).
 *
 * L'endpoint v1 `/api/v1/documents/{id}/download` retourne désormais du JSON
 * `{ downloadUrl: "<S3 presigned>" }` (depuis la migration S3 de Documenso) —
 * il faudrait suivre cette URL en 2e fetch. v2-beta nous évite ça.
 */
export async function downloadSignedPdf(documentId: number): Promise<ArrayBuffer> {
  const res = await fetch(`${BASE_URL}/api/v2-beta/document/${documentId}/download`, {
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

// ============================================
// Folders (v2-beta API)
// ============================================

export interface DocumensoFolder {
  id: string
  name: string
  parentId: string | null
  type: 'DOCUMENT' | 'TEMPLATE'
  visibility: 'EVERYONE' | 'MANAGER_AND_ABOVE' | 'ADMIN'
  createdAt: string
  updatedAt: string
}

interface FolderListResponse {
  data: DocumensoFolder[]
  count: number
}

/** Crée un dossier de documents (type=DOCUMENT par défaut). */
export async function createFolder(name: string, parentId?: string): Promise<DocumensoFolder> {
  const body: Record<string, unknown> = { name, type: 'DOCUMENT' }
  if (parentId) body.parentId = parentId
  return apiCallV2Beta<DocumensoFolder>('/folder/create', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** Liste les dossiers (root level). */
export async function listFolders(): Promise<DocumensoFolder[]> {
  const res = await apiCallV2Beta<FolderListResponse>('/folder')
  return res.data || []
}

/**
 * Déplace un document dans un dossier (ou retire son dossier si folderId=null).
 * Utilise l'endpoint /document/update qui accepte folderId dans data.
 */
export async function moveDocumentToFolder(documentId: number, folderId: string | null): Promise<unknown> {
  return apiCallV2Beta('/document/update', {
    method: 'POST',
    body: JSON.stringify({
      documentId,
      data: { folderId },
    }),
  })
}
