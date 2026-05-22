import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendSatisfactionSurveyEmail } from '@/lib/email/satisfaction-survey'
import type { SatisfactionSurveyKind } from '@/lib/types/database'

/**
 * Endpoint cron quotidien pour les enquêtes de satisfaction.
 *
 * Configuration (cron externe type cron-job.org) :
 *   POST https://sda.optimus-services.fr/api/cron/satisfaction
 *   Header: Authorization: Bearer <CRON_SECRET>
 *
 * Comportement :
 *   1. Adoption (J+7) — scan animal_movements type='adoption' créés il y a >=7j
 *   2. Foster (J+7) — scan animal_movements type='foster_placement' créés il y a >=7j
 *   3. Donation (J+1) — scan donations créées il y a >=1j
 *   Pour chaque event éligible sans survey existante : crée + envoie le mail.
 *
 * Idempotent : la contrainte UNIQUE(kind, related_id) empêche les doublons.
 * Bornes : max 50 envois par exécution pour éviter timeouts/rate limit Brevo.
 */

const BATCH_LIMIT = 50

interface CronResult {
  ok: boolean
  /** Nombre de mails réellement envoyés (hors collisions/skips/erreurs) */
  sent: { adoption: number; foster: number; donation: number }
  /** Events scannés mais déjà traités (collision UNIQUE = idempotence garantie) */
  already_done: { adoption: number; foster: number; donation: number }
  errors: string[]
}

export async function POST(req: NextRequest) {
  return handleRequest(req)
}

// Autoriser aussi GET pour faciliter les tests manuels et certains crons HTTP
export async function GET(req: NextRequest) {
  return handleRequest(req)
}

async function handleRequest(req: NextRequest): Promise<NextResponse<CronResult | { error: string }>> {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET non configuré côté serveur' }, { status: 500 })
  }
  const authHeader = req.headers.get('authorization') || ''
  const expected = `Bearer ${secret}`
  if (authHeader !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result: CronResult = {
    ok: true,
    sent: { adoption: 0, foster: 0, donation: 0 },
    already_done: { adoption: 0, foster: 0, donation: 0 },
    errors: [],
  }

  const admin = createAdminClient()
  const nowIso = new Date().toISOString()
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const oneDayAgo = new Date(Date.now() - 86_400_000).toISOString()

  // ─────────── Adoption (J+7) ───────────
  try {
    const { data: rows } = await admin
      .from('animal_movements')
      .select('id, animal_id, related_client_id, created_at')
      .eq('type', 'adoption')
      .lte('created_at', sevenDaysAgo)
      .not('related_client_id', 'is', null)
      .limit(BATCH_LIMIT)

    for (const row of rows || []) {
      try {
        const outcome = await processOne(admin, 'adoption', row.id, row.animal_id, row.related_client_id as string, nowIso)
        if (outcome === 'sent') result.sent.adoption += 1
        else result.already_done.adoption += 1
      } catch (e) {
        result.errors.push(`adoption ${row.id}: ${(e as Error).message}`)
      }
    }
  } catch (e) {
    result.errors.push(`scan adoption: ${(e as Error).message}`)
  }

  // ─────────── Foster (J+7) ───────────
  try {
    const { data: rows } = await admin
      .from('animal_movements')
      .select('id, animal_id, related_client_id, created_at')
      .eq('type', 'foster_placement')
      .lte('created_at', sevenDaysAgo)
      .not('related_client_id', 'is', null)
      .limit(BATCH_LIMIT)

    for (const row of rows || []) {
      try {
        const outcome = await processOne(admin, 'foster', row.id, row.animal_id, row.related_client_id as string, nowIso)
        if (outcome === 'sent') result.sent.foster += 1
        else result.already_done.foster += 1
      } catch (e) {
        result.errors.push(`foster ${row.id}: ${(e as Error).message}`)
      }
    }
  } catch (e) {
    result.errors.push(`scan foster: ${(e as Error).message}`)
  }

  // ─────────── Donation (J+1) ───────────
  try {
    const { data: rows } = await admin
      .from('donations')
      .select('id, establishment_id, donor_name, donor_email, created_at')
      .lte('created_at', oneDayAgo)
      .not('donor_email', 'is', null)
      .limit(BATCH_LIMIT)

    for (const row of rows || []) {
      try {
        const outcome = await processOneDonation(admin, row, nowIso)
        if (outcome === 'sent') result.sent.donation += 1
        else result.already_done.donation += 1
      } catch (e) {
        result.errors.push(`donation ${row.id}: ${(e as Error).message}`)
      }
    }
  } catch (e) {
    result.errors.push(`scan donation: ${(e as Error).message}`)
  }

  if (result.errors.length > 0) result.ok = false
  return NextResponse.json(result)
}

/**
 * Pour une adoption ou un foster : récupère email/nom du client, crée la survey,
 * envoie le mail. Idempotent via la contrainte UNIQUE(kind, related_id).
 */
async function processOne(
  admin: ReturnType<typeof createAdminClient>,
  kind: 'adoption' | 'foster',
  movementId: string,
  animalId: string,
  clientId: string,
  nowIso: string
): Promise<'sent' | 'skipped'> {
  // Doublon ?
  const { data: existing } = await admin
    .from('satisfaction_surveys')
    .select('id')
    .eq('kind', kind)
    .eq('related_id', movementId)
    .maybeSingle()
  if (existing) return 'skipped'

  // Récupération client + animal + établissement
  const { data: client } = await admin
    .from('clients')
    .select('id, kind, name, first_name, email, establishment_id')
    .eq('id', clientId)
    .single()
  if (!client || !client.email) {
    throw new Error('client sans email')
  }

  const { data: animal } = await admin
    .from('animals')
    .select('name')
    .eq('id', animalId)
    .maybeSingle()

  const { data: estab } = await admin
    .from('establishments')
    .select('name')
    .eq('id', client.establishment_id)
    .single()

  const displayName = client.kind === 'organization'
    ? client.name
    : (client.first_name ? `${client.first_name} ${client.name}` : client.name)

  const token = crypto.randomUUID().replace(/-/g, '')

  // Insertion survey
  const { error: insErr } = await admin
    .from('satisfaction_surveys')
    .insert({
      establishment_id: client.establishment_id,
      kind,
      related_id: movementId,
      recipient_name: displayName,
      recipient_email: client.email,
      token,
      scheduled_for: nowIso,
    })
  if (insErr) {
    if (insErr.code === '23505') return 'skipped' // race condition uniq → ignore
    throw new Error(insErr.message)
  }

  // Envoi mail
  try {
    await sendSatisfactionSurveyEmail({
      to: client.email,
      toName: displayName,
      kind: kind as SatisfactionSurveyKind,
      token,
      establishmentName: estab?.name || 'Refuge SDA',
      animalName: animal?.name,
    })
    await admin
      .from('satisfaction_surveys')
      .update({ sent_at: nowIso, send_error: null })
      .eq('token', token)
    return 'sent'
  } catch (mailErr) {
    await admin
      .from('satisfaction_surveys')
      .update({ send_error: (mailErr as Error).message.slice(0, 500) })
      .eq('token', token)
    throw mailErr
  }
}

/** Cas spécial donation : email + nom directement dans la table donations */
async function processOneDonation(
  admin: ReturnType<typeof createAdminClient>,
  row: { id: string; establishment_id: string; donor_name: string; donor_email: string | null; created_at: string },
  nowIso: string
): Promise<'sent' | 'skipped'> {
  const { data: existing } = await admin
    .from('satisfaction_surveys')
    .select('id')
    .eq('kind', 'donation')
    .eq('related_id', row.id)
    .maybeSingle()
  if (existing) return 'skipped'
  if (!row.donor_email) throw new Error('don sans email')

  const { data: estab } = await admin
    .from('establishments')
    .select('name')
    .eq('id', row.establishment_id)
    .single()

  const token = crypto.randomUUID().replace(/-/g, '')

  const { error: insErr } = await admin
    .from('satisfaction_surveys')
    .insert({
      establishment_id: row.establishment_id,
      kind: 'donation',
      related_id: row.id,
      recipient_name: row.donor_name,
      recipient_email: row.donor_email,
      token,
      scheduled_for: nowIso,
    })
  if (insErr) {
    if (insErr.code === '23505') return 'skipped'
    throw new Error(insErr.message)
  }

  try {
    await sendSatisfactionSurveyEmail({
      to: row.donor_email,
      toName: row.donor_name,
      kind: 'donation',
      token,
      establishmentName: estab?.name || 'Refuge SDA',
    })
    await admin
      .from('satisfaction_surveys')
      .update({ sent_at: nowIso, send_error: null })
      .eq('token', token)
    return 'sent'
  } catch (mailErr) {
    await admin
      .from('satisfaction_surveys')
      .update({ send_error: (mailErr as Error).message.slice(0, 500) })
      .eq('token', token)
    throw mailErr
  }
}
