import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { jsonWithCors, preflightWithCors } from '@/lib/public/cors'
import { verifyTurnstile } from '@/lib/public/turnstile'
import { sendAdoptionInquiryConfirmation } from '@/lib/email/adoption-inquiry-email'
import {
  DEFAULT_ADOPTION_APPOINTMENT_SETTINGS,
  type AdoptionAppointmentSettings,
} from '@/lib/types/database'

export const dynamic = 'force-dynamic'

export async function OPTIONS(req: NextRequest) {
  return preflightWithCors(req.headers.get('origin'))
}

interface InquiryPayload {
  animal_id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  address?: string
  postal_code?: string
  city?: string
  date: string // YYYY-MM-DD
  start_time: string // HH:MM
  questionnaire: Record<string, unknown>
  turnstile_token: string
}

/**
 * POST /api/public/adoption/inquiry
 *
 * Flow :
 *  1. Vérif Turnstile
 *  2. Vérif animal adoptable + settings enabled
 *  3. Vérif pas de demande pending pour cet email sur cet animal
 *  4. Sélectionne un user disponible sur le créneau choisi (re-check)
 *  5. Crée ou retrouve le client (kind=person)
 *  6. Crée l'appointment (status=pending_validation, source=public_portal)
 *  7. Crée l'adoption_inquiry liée
 *  8. (TODO) notification équipe + email accusé réception
 */
export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin')
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const userAgent = req.headers.get('user-agent') ?? null

  let body: InquiryPayload
  try {
    body = (await req.json()) as InquiryPayload
  } catch {
    return jsonWithCors({ error: 'Body JSON invalide' }, origin, { status: 400 })
  }

  // 1. Validation minimale
  const required = ['animal_id', 'first_name', 'last_name', 'email', 'phone', 'date', 'start_time', 'turnstile_token']
  for (const k of required) {
    if (!body[k as keyof InquiryPayload]) {
      return jsonWithCors({ error: `Champ requis manquant : ${k}` }, origin, { status: 400 })
    }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    return jsonWithCors({ error: 'Email invalide' }, origin, { status: 400 })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    return jsonWithCors({ error: 'Date invalide' }, origin, { status: 400 })
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(body.start_time)) {
    return jsonWithCors({ error: 'Heure invalide' }, origin, { status: 400 })
  }

  // 2. Turnstile
  const turnstileOk = await verifyTurnstile(body.turnstile_token, ip)
  if (!turnstileOk) {
    return jsonWithCors({ error: 'Échec de la vérification anti-robot' }, origin, { status: 400 })
  }

  const admin = createAdminClient()

  try {
    // 3. Animal + settings
    const { data: animalRow } = await admin
      .from('animals')
      .select('id, establishment_id, adoptable, name, establishments!inner(id, adoption_appointment_settings)')
      .eq('id', body.animal_id)
      .single()

    if (!animalRow) {
      return jsonWithCors({ error: 'Animal introuvable' }, origin, { status: 404 })
    }
    const animal = animalRow as unknown as {
      id: string
      establishment_id: string
      adoptable: boolean
      name: string
      establishments: { id: string; adoption_appointment_settings: Partial<AdoptionAppointmentSettings> }
    }
    if (!animal.adoptable) {
      return jsonWithCors({ error: 'Animal non adoptable' }, origin, { status: 403 })
    }
    const settings = { ...DEFAULT_ADOPTION_APPOINTMENT_SETTINGS, ...animal.establishments.adoption_appointment_settings }
    if (!settings.enabled || !settings.allowed_user_ids || settings.allowed_user_ids.length === 0) {
      return jsonWithCors({ error: 'Demandes publiques désactivées pour cet animal' }, origin, { status: 403 })
    }

    // 4. Pas déjà une demande pending pour cet email sur cet animal
    const { data: existing } = await admin
      .from('adoption_inquiries')
      .select('id')
      .eq('email', body.email.toLowerCase())
      .eq('animal_id', animal.id)
      .in('status', ['pending', 'contacted', 'rdv_confirmed'])
      .maybeSingle()

    if (existing) {
      return jsonWithCors(
        { error: 'Une demande est déjà en cours pour cet animal avec cet email. Consultez votre espace ou contactez le refuge.' },
        origin,
        { status: 409 },
      )
    }

    // 5. Recalcul d'un user disponible sur le créneau demandé
    const endTime = addMinutes(body.start_time, settings.slot_duration_minutes ?? 45)

    const [{ data: scheduleRows }, { data: existingAppts }] = await Promise.all([
      admin
        .from('staff_schedule')
        .select('user_id, start_time, end_time')
        .eq('establishment_id', animal.establishment_id)
        .eq('date', body.date)
        .in('user_id', settings.allowed_user_ids),
      admin
        .from('appointments')
        .select('assigned_user_id, start_time, end_time')
        .eq('establishment_id', animal.establishment_id)
        .eq('date', body.date)
        .in('status', ['pending_validation', 'scheduled', 'confirmed']),
    ])

    const sched = (scheduleRows ?? []) as { user_id: string; start_time: string; end_time: string }[]
    const appts = (existingAppts ?? []) as { assigned_user_id: string | null; start_time: string; end_time: string }[]

    const candidateUser = settings.allowed_user_ids.find((uid) => {
      const onShift = sched.some(
        (s) => s.user_id === uid && timeToMin(s.start_time) <= timeToMin(body.start_time) && timeToMin(s.end_time) >= timeToMin(endTime),
      )
      if (!onShift) return false
      const overlap = appts.some(
        (a) => a.assigned_user_id === uid && timeToMin(a.start_time) < timeToMin(endTime) && timeToMin(body.start_time) < timeToMin(a.end_time),
      )
      return !overlap
    })

    if (!candidateUser) {
      return jsonWithCors(
        { error: 'Ce créneau vient d\'être réservé. Veuillez en choisir un autre.' },
        origin,
        { status: 409 },
      )
    }

    // 6. Client : retrouver ou créer
    const emailLower = body.email.toLowerCase()
    let clientId: string | null = null

    const { data: existingClient } = await admin
      .from('clients')
      .select('id')
      .eq('establishment_id', animal.establishment_id)
      .eq('email', emailLower)
      .eq('kind', 'person')
      .maybeSingle()

    if (existingClient) {
      clientId = (existingClient as { id: string }).id
      // Mise à jour soft (pas écraser les champs déjà renseignés)
      await admin
        .from('clients')
        .update({
          first_name: body.first_name,
          name: body.last_name,
          phone: body.phone,
          address: body.address ?? null,
          postal_code: body.postal_code ?? null,
          city: body.city ?? null,
        })
        .eq('id', clientId)
    } else {
      const { data: newClient, error: clientErr } = await admin
        .from('clients')
        .insert({
          establishment_id: animal.establishment_id,
          kind: 'person',
          first_name: body.first_name,
          name: body.last_name,
          email: emailLower,
          phone: body.phone,
          address: body.address ?? null,
          postal_code: body.postal_code ?? null,
          city: body.city ?? null,
        })
        .select('id')
        .single()
      if (clientErr || !newClient) {
        return jsonWithCors({ error: 'Création du contact impossible : ' + clientErr?.message }, origin, { status: 500 })
      }
      clientId = (newClient as { id: string }).id
    }

    // 7. Appointment
    const clientName = `${body.first_name} ${body.last_name}`.trim()
    const { data: appointment, error: apptErr } = await admin
      .from('appointments')
      .insert({
        establishment_id: animal.establishment_id,
        type: 'adoption',
        animal_id: animal.id,
        assigned_user_id: candidateUser,
        client_name: clientName,
        client_email: emailLower,
        client_phone: body.phone,
        date: body.date,
        start_time: body.start_time,
        end_time: endTime,
        notes: `Demande d'adoption portail public — ${animal.name}`,
        status: 'pending_validation',
        source: 'public_portal',
        created_by: null,
      })
      .select('id')
      .single()

    if (apptErr || !appointment) {
      return jsonWithCors({ error: 'Création du rendez-vous impossible : ' + apptErr?.message }, origin, { status: 500 })
    }

    // 8. Adoption inquiry
    const { data: inquiry, error: inqErr } = await admin
      .from('adoption_inquiries')
      .insert({
        establishment_id: animal.establishment_id,
        animal_id: animal.id,
        client_id: clientId,
        appointment_id: (appointment as { id: string }).id,
        first_name: body.first_name,
        last_name: body.last_name,
        email: emailLower,
        phone: body.phone,
        address: body.address ?? null,
        postal_code: body.postal_code ?? null,
        city: body.city ?? null,
        questionnaire: body.questionnaire ?? {},
        status: 'pending',
        source: 'public_portal',
        ip_address: ip,
        user_agent: userAgent,
      })
      .select('id')
      .single()

    if (inqErr || !inquiry) {
      // Rollback appointment pour cohérence
      await admin.from('appointments').delete().eq('id', (appointment as { id: string }).id)
      return jsonWithCors({ error: 'Enregistrement de la demande impossible : ' + inqErr?.message }, origin, { status: 500 })
    }

    // 9. Email accusé de réception (fire-and-forget : ne pas bloquer la réponse
    //    si Brevo a un hoquet — l'utilisateur a déjà sa confirmation à l'écran)
    const { data: estabRow } = await admin
      .from('establishments')
      .select('name')
      .eq('id', animal.establishment_id)
      .single()

    sendAdoptionInquiryConfirmation({
      to: emailLower,
      firstName: body.first_name,
      animalName: animal.name,
      appointmentDate: body.date,
      appointmentTime: body.start_time,
      establishmentName: (estabRow as { name: string } | null)?.name ?? 'SDA Nord',
    }).catch((e) => {
      console.error('[adoption-inquiry] email confirmation échoué', e)
    })

    return jsonWithCors(
      {
        data: {
          inquiry_id: (inquiry as { id: string }).id,
          appointment: {
            date: body.date,
            start_time: body.start_time,
            end_time: endTime,
          },
          message: 'Demande enregistrée. Notre équipe la valide sous 48h ouvrées.',
        },
      },
      origin,
      { status: 201 },
    )
  } catch (e) {
    console.error('[adoption-inquiry] erreur', e)
    return jsonWithCors({ error: (e as Error).message }, origin, { status: 500 })
  }
}

function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
function addMinutes(t: string, m: number): string {
  const total = timeToMin(t) + m
  const h = Math.floor(total / 60)
  const mn = total % 60
  return `${String(h).padStart(2, '0')}:${String(mn).padStart(2, '0')}`
}
