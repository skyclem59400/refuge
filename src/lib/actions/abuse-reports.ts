'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { revalidatePath } from 'next/cache'
import type {
  AbuseReport,
  AbuseReportPhoto,
  AbuseType,
  AbuseSeverity,
  AbuseReportStatus,
  AnimalType,
} from '@/lib/types/database'

// ---------- Labels FR ----------

export const ABUSE_TYPE_LABELS: Record<AbuseType, string> = {
  abandonment: 'Abandon',
  neglect: 'Négligence',
  physical_violence: 'Violence physique',
  inadequate_conditions: 'Conditions inadaptées',
  psychological: 'Maltraitance psychologique',
  illegal_breeding: 'Élevage illégal',
  other: 'Autre',
}

export const SEVERITY_LABELS: Record<AbuseSeverity, string> = {
  urgent: 'Urgent (vie en danger)',
  serious: 'Grave',
  recurring: 'Récurrent',
  suspicion: 'Suspicion',
}

export const STATUS_LABELS: Record<AbuseReportStatus, string> = {
  new: 'Nouveau',
  investigating: 'En cours',
  transmitted_authorities: 'Transmis autorités',
  on_site_intervention: 'Intervention sur place',
  resolved: 'Résolu',
  unfounded: 'Non-fondé',
  archived: 'Archivé',
}

export const ANIMAL_TYPE_LABELS: Record<AnimalType, string> = {
  dog: 'Chien',
  cat: 'Chat',
  farm: 'Animal de ferme',
  wildlife: 'Faune sauvage',
  other: 'Autre',
}

// ---------- Helpers ----------

const SEVERITY_ORDER: Record<AbuseSeverity, number> = {
  urgent: 0,
  serious: 1,
  recurring: 2,
  suspicion: 3,
}

const STORAGE_BUCKET = 'abuse-report-photos'
const SIGNED_URL_TTL_SECONDS = 60

export interface AbuseReportPhotoWithUrl {
  id: string
  signedUrl: string
  original_filename: string | null
  mime_type: string | null
  size_bytes: number | null
}

async function getPhotosWithSignedUrls(
  reportId: string
): Promise<AbuseReportPhotoWithUrl[]> {
  const admin = createAdminClient()

  const photosResult = (await admin
    .from('abuse_report_photos')
    .select('*')
    .eq('report_id', reportId)
    .order('uploaded_at', { ascending: true })) as {
    data: AbuseReportPhoto[] | null
    error: { message: string } | null
  }

  if (photosResult.error || !photosResult.data) return []

  const out: AbuseReportPhotoWithUrl[] = []
  for (const photo of photosResult.data) {
    const { data } = await admin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(photo.storage_path, SIGNED_URL_TTL_SECONDS)
    if (data?.signedUrl) {
      out.push({
        id: photo.id,
        signedUrl: data.signedUrl,
        original_filename: photo.original_filename,
        mime_type: photo.mime_type,
        size_bytes: photo.size_bytes,
      })
    }
  }
  return out
}

// ---------- Server actions ----------

interface ListFilters {
  status?: AbuseReportStatus | null
  severity?: AbuseSeverity | null
  search?: string | null
  limit?: number
}

export async function listAbuseReports({
  status,
  severity,
  search,
  limit = 200,
}: ListFilters = {}): Promise<{ data: AbuseReport[]; error?: string }> {
  const ctx = await getEstablishmentContext()
  if (!ctx) return { data: [], error: 'Non authentifié' }
  if (!ctx.permissions.canManageAbuseReports) {
    return { data: [], error: 'Accès refusé' }
  }

  const admin = createAdminClient()

  let q = admin
    .from('abuse_reports')
    .select('*')
    .eq('establishment_id', ctx.establishment.id)
    .limit(limit)

  if (status) q = q.eq('status', status)
  if (severity) q = q.eq('severity', severity)
  if (search?.trim()) {
    const s = `%${search.trim()}%`
    q = q.or(
      `reporter_email.ilike.${s},reporter_first_name.ilike.${s},reporter_last_name.ilike.${s},location_city.ilike.${s},location_postal_code.ilike.${s},description.ilike.${s}`
    )
  }

  const result = (await q) as {
    data: AbuseReport[] | null
    error: { message: string } | null
  }
  if (result.error) return { data: [], error: result.error.message }

  const rows = result.data || []
  // Tri : urgent en haut, puis par date desc
  rows.sort((a, b) => {
    const sa = SEVERITY_ORDER[a.severity] ?? 99
    const sb = SEVERITY_ORDER[b.severity] ?? 99
    if (sa !== sb) return sa - sb
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  return { data: rows }
}

export async function getAbuseReport(id: string): Promise<{
  report: AbuseReport | null
  photos: AbuseReportPhotoWithUrl[]
  error?: string
}> {
  const ctx = await getEstablishmentContext()
  if (!ctx) return { report: null, photos: [], error: 'Non authentifié' }
  if (!ctx.permissions.canManageAbuseReports) {
    return { report: null, photos: [], error: 'Accès refusé' }
  }

  const admin = createAdminClient()

  const reportResult = (await admin
    .from('abuse_reports')
    .select('*')
    .eq('id', id)
    .eq('establishment_id', ctx.establishment.id)
    .single()) as {
    data: AbuseReport | null
    error: { message: string } | null
  }

  if (reportResult.error || !reportResult.data) {
    return {
      report: null,
      photos: [],
      error: reportResult.error?.message || 'Signalement introuvable',
    }
  }

  const photos = await getPhotosWithSignedUrls(id)
  return { report: reportResult.data, photos }
}

export async function getAbuseReportStats(): Promise<{
  total: number
  urgent: number
  byStatus: Record<AbuseReportStatus, number>
  error?: string
}> {
  const ctx = await getEstablishmentContext()
  const emptyByStatus: Record<AbuseReportStatus, number> = {
    new: 0,
    investigating: 0,
    transmitted_authorities: 0,
    on_site_intervention: 0,
    resolved: 0,
    unfounded: 0,
    archived: 0,
  }
  if (!ctx) return { total: 0, urgent: 0, byStatus: emptyByStatus, error: 'Non authentifié' }
  if (!ctx.permissions.canManageAbuseReports) {
    return { total: 0, urgent: 0, byStatus: emptyByStatus, error: 'Accès refusé' }
  }

  const admin = createAdminClient()

  const result = (await admin
    .from('abuse_reports')
    .select('status, severity')
    .eq('establishment_id', ctx.establishment.id)) as {
    data: { status: AbuseReportStatus; severity: AbuseSeverity }[] | null
    error: { message: string } | null
  }

  const rows = result.data || []
  let urgent = 0
  for (const row of rows) {
    emptyByStatus[row.status] = (emptyByStatus[row.status] || 0) + 1
    if (row.severity === 'urgent' && row.status !== 'resolved' && row.status !== 'archived' && row.status !== 'unfounded') {
      urgent++
    }
  }

  return { total: rows.length, urgent, byStatus: emptyByStatus }
}

export async function updateAbuseReportStatus(
  id: string,
  status: AbuseReportStatus,
  notes?: string | null,
  resolutionSummary?: string | null
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getEstablishmentContext()
  if (!ctx) return { ok: false, error: 'Non authentifié' }
  if (!ctx.permissions.canManageAbuseReports) {
    return { ok: false, error: 'Accès refusé' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const resolverEmail = user?.email || 'admin'

  const admin = createAdminClient()

  const patch: Record<string, unknown> = {
    status,
    admin_notes: notes ?? null,
    updated_at: new Date().toISOString(),
  }

  if (status === 'resolved') {
    patch.resolved_at = new Date().toISOString()
    patch.resolved_by = resolverEmail
    patch.resolution_summary = resolutionSummary ?? null
  }

  const { error } = await admin
    .from('abuse_reports')
    .update(patch as never)
    .eq('id', id)
    .eq('establishment_id', ctx.establishment.id)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/admin/signalements-maltraitance')
  revalidatePath(`/admin/signalements-maltraitance/${id}`)
  return { ok: true }
}
