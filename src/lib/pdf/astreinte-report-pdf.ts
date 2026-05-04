import { promises as fs } from 'fs'
import path from 'path'
import { createAdminClient } from '@/lib/supabase/server'
import { renderHtmlToPdf } from './render'
import {
  buildAstreinteReportHtml,
  type AstreinteReportData,
} from './astreinte-report-template'

const REPORT_BUCKET = 'astreinte-reports'
const PHOTO_BUCKET = 'astreinte-photos'

async function readLogoBase64(): Promise<string | undefined> {
  try {
    const logoPath = path.join(process.cwd(), 'public', 'logo-sda.png')
    const buffer = await fs.readFile(logoPath)
    return `data:image/png;base64,${buffer.toString('base64')}`
  } catch {
    return undefined
  }
}

async function downloadPhotoBase64(
  storagePath: string
): Promise<string | null> {
  const admin = createAdminClient()
  const { data, error } = await admin.storage.from(PHOTO_BUCKET).download(storagePath)
  if (error || !data) return null
  const arrayBuffer = await data.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const mime = data.type || 'image/jpeg'
  return `data:${mime};base64,${buffer.toString('base64')}`
}

interface BuildResult {
  buffer: Buffer
  filename: string
  storagePath: string
  data: AstreinteReportData
}

export async function buildAstreinteReportPdf(ticketId: string): Promise<BuildResult> {
  const admin = createAdminClient()

  const { data: ticket, error } = await admin
    .from('astreinte_tickets')
    .select('*')
    .eq('id', ticketId)
    .single()

  if (error || !ticket) {
    throw new Error('Ticket introuvable')
  }

  const { data: photos } = await admin
    .from('astreinte_ticket_photos')
    .select('storage_path')
    .eq('ticket_id', ticketId)
    .order('uploaded_at', { ascending: true })
    .limit(6)

  const photoBase64s: string[] = []
  for (const p of photos ?? []) {
    const b64 = await downloadPhotoBase64(p.storage_path)
    if (b64) photoBase64s.push(b64)
  }

  const userIds = [
    ticket.acknowledged_by,
    ticket.on_site_by,
    ticket.completed_by,
    ticket.assigned_to,
  ].filter((u): u is string => Boolean(u))

  let agentName: string | null = null
  if (userIds.length > 0) {
    const { data: usersInfo } = await admin.rpc('get_users_info', { user_ids: userIds })
    const agentId =
      ticket.completed_by ?? ticket.on_site_by ?? ticket.assigned_to ?? ticket.acknowledged_by
    const found = (usersInfo ?? []).find((u: { id: string }) => u.id === agentId)
    if (found) agentName = found.full_name ?? found.email ?? null
  }

  let municipalityName: string | null = null
  if (ticket.municipality_code_insee) {
    const { data: muni } = await admin
      .from('astreinte_municipalities')
      .select('name')
      .eq('code_insee', ticket.municipality_code_insee)
      .maybeSingle()
    municipalityName = muni?.name ?? null
  }

  const logoBase64 = await readLogoBase64()

  const data: AstreinteReportData = {
    ticketNumber: ticket.ticket_number,
    createdAt: ticket.created_at,
    acknowledgedAt: ticket.acknowledged_at,
    onRouteAt: ticket.on_route_at,
    onSiteAt: ticket.on_site_at,
    completedAt: ticket.completed_at,
    agentName,
    declarantName: ticket.declarant_name,
    declarantOrganization: ticket.declarant_organization,
    declarantEmail: ticket.declarant_email,
    declarantPhone: ticket.declarant_phone,
    municipalityName,
    locationAddress: ticket.location_address,
    interventionType: ticket.intervention_type,
    animalSpecies: ticket.animal_species,
    animalCount: ticket.animal_count ?? 1,
    animalBreed: ticket.animal_breed,
    animalSize: ticket.animal_size,
    animalColor: ticket.animal_color,
    animalInjured: ticket.animal_injured,
    animalDangerous: ticket.animal_dangerous,
    description: ticket.description,
    outcome: ticket.intervention_outcome,
    destination: ticket.intervention_destination,
    comments: ticket.intervention_comments,
    isNightIntervention: ticket.is_night_intervention ?? false,
    logoBase64,
    photoBase64s,
  }

  const html = buildAstreinteReportHtml(data)
  const buffer = await renderHtmlToPdf(html)

  const filename = `compte-rendu-${ticket.ticket_number}.pdf`
  const storagePath = `${ticket.id}/${filename}`

  return { buffer, filename, storagePath, data }
}

export async function persistAstreinteReportPdf(
  ticketId: string
): Promise<{ storagePath: string; buffer: Buffer; filename: string; data: AstreinteReportData }> {
  const { buffer, filename, storagePath, data } = await buildAstreinteReportPdf(ticketId)

  const admin = createAdminClient()
  const { error: uploadError } = await admin.storage
    .from(REPORT_BUCKET)
    .upload(storagePath, buffer, {
      contentType: 'application/pdf',
      upsert: true,
    })

  if (uploadError) {
    throw new Error(`Upload du PDF échoué : ${uploadError.message}`)
  }

  await admin
    .from('astreinte_tickets')
    .update({
      report_pdf_path: storagePath,
      report_generated_at: new Date().toISOString(),
    })
    .eq('id', ticketId)

  return { storagePath, buffer, filename, data }
}
