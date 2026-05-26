'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/establishment/permissions'
import { buildCraSaisiePdf } from '@/lib/pdf/cra-saisie-pdf'
import { sendEmail } from '@/lib/email/client'

const MONTH_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

// Email du président SDA pour réception des CRA externes (auto-entrepreneurs).
// Ces collaborateurs facturent en direct, donc leur CRA ne va PAS au comptable
// (pas de paie), mais à la direction pour suivi et validation des heures.
const EXTERNAL_CONTRACTOR_RECIPIENT_EMAIL = 'clement.scailteux@gmail.com'

/**
 * Envoie le CRA validé :
 * - Salarié : email au comptable de l'établissement (paie)
 * - Auto-entrepreneur / externe : email au président SDA (suivi heures, pas de paie)
 *
 * 1. Vérifie statut = validated_by_admin
 * 2. Génère le PDF
 * 3. Route selon contract_type
 * 4. Met à jour le statut → sent
 */
export async function sendCraToAccountant(
  memberId: string,
  year: number,
  month: number
): Promise<{ data?: { sentTo: string; isExternal: boolean }; error?: string }> {
  try {
    const { establishmentId } = await requirePermission('manage_leaves')
    const admin = createAdminClient()
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // 1. Vérifier le statut
    const { data: status } = await admin
      .from('cra_monthly_status')
      .select('*')
      .eq('member_id', memberId)
      .eq('year', year)
      .eq('month', month)
      .maybeSingle()
    if (!status) return { error: 'CRA introuvable' }
    if (status.status !== 'validated_by_admin') {
      return { error: 'Le CRA doit être validé par un administrateur avant envoi.' }
    }

    // 2. Récupérer le membre (pour contract_type + identité)
    const { data: memberRow } = await admin
      .from('establishment_members')
      .select('user_id, pseudo, contract_type')
      .eq('id', memberId)
      .single()
    if (!memberRow) return { error: 'Membre introuvable' }

    const isExternal = memberRow.contract_type === 'auto_entrepreneur'

    // 3. Récupérer l'établissement + le comptable
    const { data: est } = await admin
      .from('establishments')
      .select('name, accountant_email, accountant_name')
      .eq('id', establishmentId)
      .single()

    // 4. Déterminer le destinataire
    let recipientEmail: string
    let recipientName: string | undefined
    if (isExternal) {
      recipientEmail = EXTERNAL_CONTRACTOR_RECIPIENT_EMAIL
      recipientName = 'Clément Scailteux'
    } else {
      if (!est?.accountant_email) {
        return {
          error: "Aucun email de comptable n'est configuré. Renseignez-le dans Établissement → Paramètres.",
        }
      }
      recipientEmail = est.accountant_email
      recipientName = est.accountant_name || undefined
    }

    // 5. Générer le PDF
    let pdfBuffer: Buffer
    let filename: string
    try {
      const r = await buildCraSaisiePdf(memberId, year, month)
      pdfBuffer = r.buffer
      filename = r.filename
    } catch (e) {
      return { error: 'Génération PDF impossible : ' + (e as Error).message }
    }

    // 6. Récupérer le nom du collaborateur
    let memberName = memberRow.pseudo || 'Collaborateur'
    if (memberRow.user_id) {
      const { data: usersInfo } = await admin.rpc('get_users_info', { user_ids: [memberRow.user_id] })
      if (usersInfo && Array.isArray(usersInfo) && usersInfo[0]?.full_name) {
        memberName = usersInfo[0].full_name
      }
    }

    // 7. Construire le contenu email selon le destinataire
    const monthLabel = `${MONTH_FR[month - 1]} ${year}`
    const subject = isExternal
      ? `[Externe — Suivi heures] CRA ${memberName} — ${monthLabel}`
      : `CRA ${memberName} — ${monthLabel}`
    const html = isExternal
      ? `<p>Bonjour Clément,</p>
         <p>Le CRA de <strong>${memberName}</strong> (auto-entrepreneur, externe) pour <strong>${monthLabel}</strong> a été validé.</p>
         <p>À titre de suivi des heures — <strong>ne pas transmettre au comptable</strong> (pas de paie, facturation directe).</p>
         <p>Cordialement,<br/>${est?.name || 'SDA'}</p>`
      : `<p>Bonjour${recipientName ? ' ' + recipientName : ''},</p>
         <p>Vous trouverez ci-joint le compte-rendu d'activité de <strong>${memberName}</strong> pour <strong>${monthLabel}</strong>.</p>
         <p>Ce CRA a été validé par le collaborateur puis contrôlé par un administrateur de l'association.</p>
         <p>Pour toute question, n'hésitez pas à nous contacter.</p>
         <p>Cordialement,<br/>L'équipe ${est?.name || 'SDA'}</p>`

    try {
      await sendEmail({
        to: recipientEmail,
        toName: recipientName,
        subject,
        html,
        attachments: [{ filename, content: pdfBuffer, contentType: 'application/pdf' }],
      })
    } catch (e) {
      return { error: 'Envoi email impossible : ' + (e as Error).message }
    }

    // 8. Mettre à jour le statut
    await admin
      .from('cra_monthly_status')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        sent_by: user?.id || null,
        sent_to: recipientEmail,
      })
      .eq('id', status.id)

    return { data: { sentTo: recipientEmail, isExternal } }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
