'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { requireEstablishment } from '@/lib/establishment/permissions'
import { buildVetVisitRecapPdf } from '@/lib/pdf/vet-visit-recap-pdf'
import { sendEmail } from '@/lib/email/client'
import { revalidatePath } from 'next/cache'

/**
 * Envoie le récap PDF du passage véto à la clinique vétérinaire
 * (email configuré dans `establishments.vet_recap_email`, défaut Deltour pour SDA).
 * Archive le PDF dans le bucket `vet-visit-recaps` (privé).
 *
 * Appelée automatiquement quand toutes les lignes d'un passage sont validées,
 * ou manuellement via le bouton "Envoyer le récap" du tableau.
 */
export async function sendVetVisitRecap(
  visitId: string,
  options?: { force?: boolean }
): Promise<{ data?: { sentTo: string }; error?: string }> {
  try {
    const { establishmentId } = await requireEstablishment()
    const admin = createAdminClient()
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // 1. Vérifier que la visite appartient bien à l'établissement
    const { data: visit } = await admin
      .from('vet_visits')
      .select('id, establishment_id, visit_date, recap_sent_at, vet_label')
      .eq('id', visitId)
      .single()
    if (!visit) return { error: 'Passage véto introuvable' }
    if (visit.establishment_id !== establishmentId) return { error: 'Accès refusé' }

    // Idempotence : si déjà envoyé et pas force, on ne renvoie pas
    if (visit.recap_sent_at && !options?.force) {
      return { error: 'Le récap a déjà été envoyé pour ce passage.' }
    }

    // 2. Email destinataire — config établissement
    const { data: est } = await admin
      .from('establishments')
      .select('name, vet_recap_email')
      .eq('id', establishmentId)
      .single()
    const to = est?.vet_recap_email
    if (!to) {
      return { error: "Aucun email vétérinaire configuré sur l'établissement. À renseigner dans Paramètres → Vétérinaire." }
    }

    // 3. Vérifier qu'au moins une ligne validée existe
    const { count: validatedCount } = await admin
      .from('vet_visit_lines')
      .select('id', { count: 'exact', head: true })
      .eq('visit_id', visitId)
      .not('validated_at', 'is', null)
    if (!validatedCount || validatedCount === 0) {
      return { error: "Aucune ligne validée à inclure dans le récap." }
    }

    // 4. Générer le PDF
    const pdfResult = await buildVetVisitRecapPdf(visitId)
    if ('error' in pdfResult) return { error: pdfResult.error }
    const { buffer, filename, visit: fullVisit, establishmentName } = pdfResult

    // 5. Archiver dans le bucket vet-visit-recaps
    const dateFolder = fullVisit.visit_date // 'YYYY-MM-DD'
    const storagePath = `${establishmentId}/${dateFolder}/${filename}`
    const { error: uploadErr } = await admin.storage
      .from('vet-visit-recaps')
      .upload(storagePath, buffer, {
        contentType: 'application/pdf',
        upsert: true,
      })
    if (uploadErr) {
      console.error('[vet-visit-recap] storage upload failed:', uploadErr.message)
      // On continue l'envoi email même si le storage échoue — l'envoi est plus prioritaire
    }

    // 6. Envoyer l'email
    const visitDateLabel = new Date(fullVisit.visit_date).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })

    const subject = `Récap passage véto — ${visitDateLabel} — ${establishmentName}`
    const vetLine = fullVisit.vet_label ? `<p>Vétérinaire : <strong>${fullVisit.vet_label}</strong></p>` : ''
    const html = `<p>Bonjour,</p>
      <p>Vous trouverez ci-joint le compte-rendu du passage vétérinaire du
      <strong>${visitDateLabel}</strong> au refuge <strong>${establishmentName}</strong>.</p>
      ${vetLine}
      <p>Le récap reprend l'ensemble des animaux pris en charge, les actes réalisés,
      les observations vétérinaires et la synthèse financière.</p>
      <p>Pour toute question ou correction, n'hésitez pas à nous contacter.</p>
      <p>Cordialement,<br/>L'équipe ${establishmentName}</p>
      <hr style="margin: 18px 0; border: none; border-top: 1px solid #e2e8f0;" />
      <p style="font-size: 11px; color: #94a3b8;">
        Email envoyé automatiquement depuis Optimus — refuge SDA.
        Ce message a une copie archivée. Les coordonnées du refuge sont disponibles sur demande.
      </p>`

    let messageId: string | null = null
    try {
      const result = await sendEmail({
        to,
        subject,
        html,
        attachments: [{ filename, content: buffer, contentType: 'application/pdf' }],
      })
      messageId = result.messageId
    } catch (e) {
      return { error: "Envoi email impossible : " + (e as Error).message }
    }

    // 7. Marquer la visite comme envoyée
    await admin
      .from('vet_visits')
      .update({
        recap_sent_at: new Date().toISOString(),
        recap_sent_by: user?.id || null,
        recap_sent_to: to,
        recap_storage_path: uploadErr ? null : storagePath,
        recap_email_message_id: messageId,
      })
      .eq('id', visitId)

    revalidatePath(`/sante/planning/${visitId}`)
    revalidatePath('/sante/planning')

    return { data: { sentTo: to } }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/**
 * Auto-déclenchement : après la validation d'une ligne, vérifier si TOUTES les
 * lignes du passage sont validées. Si oui, envoyer le récap.
 * Idempotent : ne renvoie pas si déjà envoyé.
 *
 * Appelée depuis `validateVetVisitLine` après mise à jour `validated_at`.
 */
export async function maybeAutoSendRecap(visitId: string): Promise<void> {
  try {
    const admin = createAdminClient()

    // Toutes les lignes du passage
    const { data: lines } = await admin
      .from('vet_visit_lines')
      .select('id, validated_at')
      .eq('visit_id', visitId)

    if (!lines || lines.length === 0) return

    const allValidated = lines.every((l) => l.validated_at !== null)
    if (!allValidated) return

    // Visite : déjà envoyée ?
    const { data: visit } = await admin
      .from('vet_visits')
      .select('id, recap_sent_at')
      .eq('id', visitId)
      .single()
    if (!visit || visit.recap_sent_at) return

    // Tout est validé et rien d'envoyé → on tente l'envoi automatique
    const r = await sendVetVisitRecap(visitId)
    if (r.error) {
      console.warn('[vet-visit-recap] auto-send failed for visit', visitId, ':', r.error)
    } else {
      console.log('[vet-visit-recap] auto-sent recap for visit', visitId, 'to', r.data?.sentTo)
    }
  } catch (e) {
    console.error('[vet-visit-recap] maybeAutoSendRecap error:', (e as Error).message)
  }
}

/** Génère un URL signé temporaire pour télécharger un récap archivé */
export async function getVetVisitRecapDownloadUrl(visitId: string): Promise<{
  url?: string
  error?: string
}> {
  try {
    const { establishmentId } = await requireEstablishment()
    const admin = createAdminClient()

    const { data: visit } = await admin
      .from('vet_visits')
      .select('recap_storage_path, establishment_id')
      .eq('id', visitId)
      .single()
    if (!visit) return { error: 'Passage véto introuvable' }
    if (visit.establishment_id !== establishmentId) return { error: 'Accès refusé' }
    if (!visit.recap_storage_path) return { error: 'Aucun récap archivé pour ce passage.' }

    const { data, error } = await admin.storage
      .from('vet-visit-recaps')
      .createSignedUrl(visit.recap_storage_path, 60 * 60) // 1h
    if (error || !data) return { error: error?.message || 'URL inaccessible' }

    return { url: data.signedUrl }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
