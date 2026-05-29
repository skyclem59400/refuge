import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { buildCraSaisiePdf } from '@/lib/pdf/cra-saisie-pdf'
import { sendEmail } from '@/lib/email/client'

// Endpoint admin one-shot pour renvoyer les CRA déjà `sent` au comptable
// avec des destinataires en copie. Utile quand le comptable n'a pas reçu
// le mail initial (spam, bounce, demande de copie pour suivi interne).
//
// Auth : Bearer CRON_SECRET (même secret que les jobs planifiés).
//
// Body JSON :
//   {
//     establishment_id: string,
//     year: number,
//     month: number,
//     cc?: string[]   // destinataires en copie (optionnel)
//   }
//
// Comportement :
//   - Sélectionne tous les CRA salarié (`contract_type='salarie'`) en statut `sent`
//     pour le couple (établissement, année, mois)
//   - Régénère le PDF à la volée et renvoie au comptable de l'établissement
//   - Met à jour `sent_at` (timestamp courant)
//   - Inscrit une trace dans activity_logs (acteur = clement.scailteux@gmail.com)

const MONTH_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

// Acteur utilisé pour la trace activity_logs (le endpoint étant CRON-auth,
// il n'y a pas de session). Clément est l'admin de référence sur SDA.
const ACTOR_USER_ID = '76bbfc56-0d9f-4ca2-ae2c-b8c1e0b11aad'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // Puppeteer + 5 PDFs ≈ ~30s, marge confortable

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const expected = process.env.CRON_SECRET
  if (!expected || auth !== `Bearer ${expected}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { establishment_id?: string; year?: number; month?: number; cc?: string[] }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Body JSON invalide' }, { status: 400 })
  }

  const { establishment_id, year, month } = body
  const ccList = Array.isArray(body.cc) ? body.cc.filter((e) => typeof e === 'string' && e.includes('@')) : []
  if (!establishment_id || !year || !month) {
    return Response.json({ error: 'establishment_id, year et month requis' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: est } = await admin
    .from('establishments')
    .select('name, accountant_email, accountant_name')
    .eq('id', establishment_id)
    .single()
  if (!est?.accountant_email) {
    return Response.json({ error: 'Établissement sans accountant_email' }, { status: 400 })
  }

  // CRA `sent` du mois pour ce établissement, salariés uniquement
  const { data: statuses, error: stErr } = await admin
    .from('cra_monthly_status')
    .select('id, member_id, status')
    .eq('establishment_id', establishment_id)
    .eq('year', year)
    .eq('month', month)
    .eq('status', 'sent')
  if (stErr) {
    return Response.json({ error: 'Lecture statuses échouée: ' + stErr.message }, { status: 500 })
  }

  const memberIds = (statuses || []).map((s) => s.member_id)
  if (memberIds.length === 0) {
    return Response.json({ message: 'Aucun CRA `sent` trouvé', count: 0, results: [] })
  }

  const { data: members } = await admin
    .from('establishment_members')
    .select('id, user_id, pseudo, contract_type')
    .in('id', memberIds)

  const salaryMembers = (members || []).filter((m) => m.contract_type === 'salarie')
  const memberMap = new Map(salaryMembers.map((m) => [m.id, m]))

  // Noms réels depuis auth.users
  const userIds = salaryMembers.map((m) => m.user_id).filter(Boolean) as string[]
  const userNameMap = new Map<string, string>()
  if (userIds.length > 0) {
    const { data: usersInfo } = await admin.rpc('get_users_info', { user_ids: userIds })
    if (usersInfo && Array.isArray(usersInfo)) {
      for (const u of usersInfo) if (u?.full_name) userNameMap.set(u.id, u.full_name)
    }
  }

  const monthLabel = `${MONTH_FR[month - 1]} ${year}`
  const results: Array<{ member: string; status: 'ok' | 'error'; messageId?: string; error?: string }> = []

  for (const status of statuses || []) {
    const m = memberMap.get(status.member_id)
    if (!m) {
      results.push({ member: '(non-salarié, skip)', status: 'error', error: 'Pas un salarié' })
      continue
    }
    const memberName = (m.user_id && userNameMap.get(m.user_id)) || m.pseudo || 'Collaborateur'

    try {
      const { buffer, filename } = await buildCraSaisiePdf(m.id, year, month, establishment_id)

      const subject = `CRA ${memberName} — ${monthLabel}`
      const html = `<p>Bonjour${est.accountant_name ? ' ' + est.accountant_name : ''},</p>
         <p>Vous trouverez ci-joint le compte-rendu d'activité de <strong>${memberName}</strong> pour <strong>${monthLabel}</strong>.</p>
         <p>Ce CRA a été validé par le collaborateur puis contrôlé par un administrateur de l'association.</p>
         <p>Pour toute question, n'hésitez pas à nous contacter.</p>
         <p>Cordialement,<br/>L'équipe ${est.name || 'SDA'}</p>`

      const { messageId } = await sendEmail({
        to: est.accountant_email,
        toName: est.accountant_name || undefined,
        cc: ccList.length > 0 ? ccList : undefined,
        subject,
        html,
        attachments: [{ filename, content: buffer, contentType: 'application/pdf' }],
      })

      await admin
        .from('cra_monthly_status')
        .update({ sent_at: new Date().toISOString(), sent_to: est.accountant_email })
        .eq('id', status.id)

      await admin.from('activity_logs').insert({
        establishment_id,
        user_id: ACTOR_USER_ID,
        action: 'update',
        entity_type: 'cra_status',
        entity_id: status.id,
        entity_name: `CRA ${memberName} — ${monthLabel} (renvoi avec CC)`,
        parent_type: 'establishment_member',
        parent_id: m.id,
        details: {
          resend: true,
          sent_to: est.accountant_email,
          cc: ccList,
          message_id: messageId,
        },
      })

      results.push({ member: memberName, status: 'ok', messageId })
    } catch (e) {
      results.push({ member: memberName, status: 'error', error: (e as Error).message })
    }
  }

  return Response.json({
    establishment_id,
    year,
    month,
    accountant_email: est.accountant_email,
    cc: ccList,
    count: results.length,
    results,
  })
}
