/**
 * Test bout-en-bout : envoi d'une convention fourrière pour signature
 * électronique via Documenso, avec mail branded SDA via Brevo.
 *
 * Destinataire = clement.scailteux@gmail.com (simulé en "Maire").
 * Pas d'update de la BD `convention_contracts` (test off-side).
 *
 * Usage :
 *   BREVO_SMTP_USER=… BREVO_SMTP_KEY=… DOCUMENSO_API_TOKEN=… \
 *     node scripts/test-convention-documenso.mjs
 */

import nodemailer from 'nodemailer'

const DOCUMENSO_BASE_URL = process.env.DOCUMENSO_BASE_URL || 'https://signature.optimus-services.fr'
const DOCUMENSO_API_TOKEN = process.env.DOCUMENSO_API_TOKEN

// === Données de test : convention Maroilles (réelle, statut 'ready') ===
const CONVENTION = {
  contractNumber: 'CV-2026-0029',
  scopeName: 'Commune de Maroilles',
  signatoryName: 'Monsieur Dominique QUINZIN',
  signatoryRole: 'Maire',
  signatoryShort: 'Monsieur le Maire',
  populationReference: 1445,
  yearlyFeeEuros: 1806.25,
  ratePerInhabitantEuros: 1.25,
  nightInterventionEuros: 150,
  nightSurchargeEuros: 45,
  durationYears: 3,
  pdfUrl: 'https://zzevrtrgtgnlxxuwbnge.supabase.co/storage/v1/object/public/convention-contracts/CV-2026-0029.pdf',
}

// Le signataire RÉEL pour ce test = toi (Clément), pas le vrai Maire.
const TEST_RECIPIENT = {
  email: 'clement.scailteux@gmail.com',
  name: 'Clément Scailteux (test simulant le Maire)',
}

// === Charte SDA ===
const PRIMARY = '#5ba8a0'
const PRIMARY_DARK = '#1e3a5f'
const TEXT = '#1e3a5f'
const TEXT_MUTED = '#6b7f96'
const BORDER = '#d9e6ed'
const BG = '#f0f7fa'
const SURFACE = '#ffffff'
const FOOTER_GRADIENT = 'linear-gradient(90deg, #c96b3c 0%, #5ba8a0 50%, #1e3a5f 100%)'

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function fmtEuros(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

// ============================================
// Documenso API helpers
// ============================================

function dHeaders() {
  return {
    Authorization: `Bearer ${DOCUMENSO_API_TOKEN}`,
    'Content-Type': 'application/json',
  }
}

async function dPost(path, body, { v2beta = false } = {}) {
  const url = v2beta ? `${DOCUMENSO_BASE_URL}/api/v2-beta${path}` : `${DOCUMENSO_BASE_URL}${path}`
  const res = await fetch(url, {
    method: 'POST',
    headers: dHeaders(),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Documenso ${res.status} on ${path}: ${text}`)
  }
  return res.json()
}

async function dGet(path) {
  const res = await fetch(`${DOCUMENSO_BASE_URL}${path}`, { headers: dHeaders() })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Documenso GET ${res.status} on ${path}: ${text}`)
  }
  return res.json()
}

// ============================================
// Email template
// ============================================

function buildEmailHtml(c, signingUrl) {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${TEXT};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${BG};">
<tr><td align="center" style="padding:32px 16px;">

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;margin-bottom:16px;">
    <tr><td style="padding:0 8px;">
      <div style="font-size:20px;font-weight:700;color:${PRIMARY_DARK};letter-spacing:0.5px;line-height:1.1;">
        <span style="color:${PRIMARY};">SDA</span> d'Estourmel
      </div>
      <div style="font-size:9px;color:${PRIMARY};font-weight:600;text-transform:uppercase;letter-spacing:1.8px;margin-top:3px;">
        Défendons les animaux · Fourrière conventionnée
      </div>
    </td></tr>
  </table>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:${SURFACE};border:1px solid ${BORDER};border-radius:8px;overflow:hidden;">
    <tr><td style="padding:0;line-height:0;height:4px;background:${FOOTER_GRADIENT};">&nbsp;</td></tr>

    <tr><td style="padding:32px 40px 8px 40px;">
      <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:1px;color:${PRIMARY};text-transform:uppercase;">Convention de fourrière animale</p>
      <h1 style="margin:8px 0 0 0;font-size:24px;line-height:1.25;font-weight:700;color:${TEXT};">${escapeHtml(c.scopeName)}</h1>
      <p style="margin:6px 0 0 0;font-size:13px;color:${TEXT_MUTED};font-family:'SF Mono',Menlo,monospace;">Référence : ${escapeHtml(c.contractNumber)}</p>
    </td></tr>

    <tr><td style="padding:24px 40px 8px 40px;">
      <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;">À l'attention de ${escapeHtml(c.signatoryShort)},</p>
      <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;">Madame, Monsieur,<br><br>
Suite à votre accord et conformément aux articles L211-24 et L211-25 du Code rural et de la pêche maritime, la <strong>Société de Défense des Animaux du Nord (SDA)</strong> vous adresse la convention de fourrière animale entre votre commune et notre établissement.</p>
      <p style="margin:0;font-size:15px;line-height:1.6;">Ce document a été pré-rempli avec les coordonnées et la population de référence de votre commune. Nous vous invitons à en prendre connaissance puis à le signer électroniquement via le bouton ci-dessous. Vous recevrez automatiquement une copie signée à l'issue.</p>
    </td></tr>

    <tr><td style="padding:24px 40px 8px 40px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${BORDER};border-radius:8px;background:${BG};">
        <tr><td style="padding:18px 20px;">
          <p style="margin:0 0 12px 0;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${PRIMARY};">Récapitulatif des conditions</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;">
            <tr><td style="padding:6px 0;color:${TEXT_MUTED};">Population de référence</td><td align="right" style="padding:6px 0;color:${TEXT};font-weight:600;">${c.populationReference.toLocaleString('fr-FR')} habitants</td></tr>
            <tr><td style="padding:6px 0;color:${TEXT_MUTED};border-top:1px solid ${BORDER};">Taux par habitant</td><td align="right" style="padding:6px 0;color:${TEXT};font-weight:600;border-top:1px solid ${BORDER};">${fmtEuros(c.ratePerInhabitantEuros)} / an</td></tr>
            <tr><td style="padding:6px 0;color:${TEXT_MUTED};border-top:1px solid ${BORDER};font-weight:600;">Cotisation annuelle</td><td align="right" style="padding:6px 0;color:${PRIMARY_DARK};font-weight:700;font-size:16px;border-top:1px solid ${BORDER};">${fmtEuros(c.yearlyFeeEuros)}</td></tr>
            <tr><td style="padding:6px 0;color:${TEXT_MUTED};border-top:1px solid ${BORDER};">Intervention nuit / week-end</td><td align="right" style="padding:6px 0;color:${TEXT};font-weight:600;border-top:1px solid ${BORDER};">${fmtEuros(c.nightInterventionEuros)} (+${fmtEuros(c.nightSurchargeEuros)} dim/férié)</td></tr>
            <tr><td style="padding:6px 0;color:${TEXT_MUTED};border-top:1px solid ${BORDER};">Durée du contrat</td><td align="right" style="padding:6px 0;color:${TEXT};font-weight:600;border-top:1px solid ${BORDER};">${c.durationYears} ans, reconductible</td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>

    <tr><td align="center" style="padding:32px 40px 8px 40px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="background:${PRIMARY_DARK};border-radius:6px;">
          <a href="${escapeHtml(signingUrl)}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:${SURFACE};text-decoration:none;border-radius:6px;">
            Signer la convention →
          </a>
        </td></tr>
      </table>
      <p style="margin:14px 0 0 0;font-size:12px;color:${TEXT_MUTED};line-height:1.5;">
        Signature électronique sécurisée &nbsp;·&nbsp; conforme eIDAS<br/>
        Référence : ${escapeHtml(c.contractNumber)} &nbsp;·&nbsp; durée estimée : 2 minutes
      </p>
    </td></tr>

    <tr><td style="padding:8px 40px 32px 40px;">
      <div style="border-top:1px solid ${BORDER};padding-top:18px;">
        <p style="margin:0;font-size:12px;line-height:1.6;color:${TEXT_MUTED};">
          Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :<br />
          <a href="${escapeHtml(signingUrl)}" style="color:${PRIMARY_DARK};word-break:break-all;">${escapeHtml(signingUrl)}</a>
        </p>
        <p style="margin:14px 0 0 0;font-size:13px;line-height:1.6;color:${TEXT};">
          Pour toute question : <a href="mailto:contact@sda-nord.com" style="color:${PRIMARY};">contact@sda-nord.com</a><br/>
          <span style="color:${TEXT_MUTED};">Clément Scailteux, Président SDA · 03 27 78 22 91 (secrétariat)</span>
        </p>
      </div>
    </td></tr>
  </table>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;margin-top:24px;">
    <tr><td align="center" style="padding:0 8px;">
      <p style="margin:0;font-size:13px;color:${TEXT_MUTED};line-height:1.6;">
        <strong style="color:${TEXT};">Société de Défense des Animaux du Nord (SDA)</strong><br />
        11 route nationale, 59400 Estourmel &nbsp;·&nbsp;
        <a href="mailto:contact@sda-nord.com" style="color:${PRIMARY};text-decoration:none;">contact@sda-nord.com</a>
      </p>
      <p style="margin:12px 0 0 0;font-size:11px;color:${TEXT_MUTED};line-height:1.5;">
        Association loi 1901 reconnue d'utilité publique &nbsp;·&nbsp; Fourrière conventionnée par arrêté préfectoral
      </p>
    </td></tr>
  </table>

</td></tr></table>
</body></html>`
}

// ============================================
// Main
// ============================================

async function main() {
  const brevoUser = process.env.BREVO_SMTP_USER
  const brevoPass = process.env.BREVO_SMTP_KEY
  if (!brevoUser || !brevoPass) {
    console.error('❌ BREVO_SMTP_USER et BREVO_SMTP_KEY requis')
    process.exit(1)
  }
  if (!DOCUMENSO_API_TOKEN) {
    console.error('❌ DOCUMENSO_API_TOKEN requis')
    process.exit(1)
  }

  // 1. Télécharger PDF
  console.log(`📥 Téléchargement PDF : ${CONVENTION.pdfUrl}`)
  const pdfRes = await fetch(CONVENTION.pdfUrl)
  if (!pdfRes.ok) throw new Error(`PDF download failed: ${pdfRes.status}`)
  const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer())
  console.log(`   ${(pdfBuffer.length / 1024).toFixed(1)} ko`)

  // 2. Créer document Documenso (v2-beta)
  console.log('📄 Création document Documenso...')
  const docTitle = `TEST — Convention SDA · ${CONVENTION.scopeName} (${CONVENTION.contractNumber})`
  const createRes = await dPost(
    '/document/create/beta',
    {
      title: docTitle,
      externalId: `test-${CONVENTION.contractNumber}-${Date.now()}`,
      recipients: [{ email: TEST_RECIPIENT.email, name: TEST_RECIPIENT.name, role: 'SIGNER', signingOrder: 1 }],
      meta: { timezone: 'Europe/Paris', dateFormat: 'dd/MM/yyyy HH:mm', language: 'fr' },
    },
    { v2beta: true },
  )
  const documentId = createRes.document.id
  const uploadUrl = createRes.uploadUrl
  console.log(`   document id : ${documentId}`)

  // 3. Upload PDF sur l'URL S3 presigned
  console.log('☁️  Upload PDF sur S3...')
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/pdf' },
    body: new Uint8Array(pdfBuffer),
  })
  if (!uploadRes.ok) throw new Error(`S3 upload failed (${uploadRes.status}): ${await uploadRes.text()}`)
  console.log('   ✓')

  // 4. Récupérer le doc complet pour avoir le recipient.id
  const doc = await dGet(`/api/v1/documents/${documentId}`)
  const recipients = doc.recipients ?? doc.Recipient ?? []
  const recipient = recipients[0]
  if (!recipient) throw new Error('Pas de recipient retourné par Documenso')
  console.log(`   recipient id : ${recipient.id}`)

  // 5. Placer les champs signature sur la DERNIÈRE page
  //    Position cible : bas droit (zone réservée signature Maire dans le PDF).
  //    Pour cette V1 de test, on tente page 3 (cf. PDF Maroilles typique 3 pages).
  //    Si la position n'est pas bonne sur le rendu, on ajuste après visualisation.
  console.log('✍️  Placement des champs signature (page dernière, bas-droit)...')
  // On suppose 3 pages. Si le PDF en a plus/moins, faudra ajuster.
  const lastPage = 3
  const fields = [
    { type: 'NAME',      pageY: 78, pageHeight: 4 },
    { type: 'DATE',      pageY: 83, pageHeight: 4 },
    { type: 'SIGNATURE', pageY: 88, pageHeight: 8 },
  ]
  for (const f of fields) {
    await dPost(`/api/v1/documents/${documentId}/fields`, {
      recipientId: recipient.id,
      type: f.type,
      pageNumber: lastPage,
      pageX: 55,         // colonne droite (50% de la largeur)
      pageY: f.pageY,
      pageWidth: 38,
      pageHeight: f.pageHeight,
    })
    console.log(`   ${f.type} placé (p${lastPage}, x=55, y=${f.pageY})`)
  }

  // 6. "Envoyer" le doc côté Documenso (PENDING) SANS son email anglais
  console.log('📤 Activation document (sendEmail: false)...')
  await dPost(`/api/v1/documents/${documentId}/send`, { sendEmail: false })

  // 7. Récupérer signingUrl à jour
  const refreshed = await dGet(`/api/v1/documents/${documentId}`)
  const refRecipients = refreshed.recipients ?? refreshed.Recipient ?? []
  const refRecipient = refRecipients[0]
  let signingUrl = refRecipient?.signingUrl
  if (!signingUrl && refRecipient?.token) {
    signingUrl = `${DOCUMENSO_BASE_URL}/sign/${refRecipient.token}`
  }
  if (!signingUrl) throw new Error('Impossible de récupérer signingUrl')
  console.log(`   signingUrl : ${signingUrl}`)

  // 8. Envoyer mail Brevo branded SDA
  console.log('📧 Envoi mail Brevo...')
  const subject = `Convention de fourrière animale ${CONVENTION.contractNumber} — ${CONVENTION.scopeName}`
  const html = buildEmailHtml(CONVENTION, signingUrl)
  const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: { user: brevoUser, pass: brevoPass },
  })
  const result = await transporter.sendMail({
    from: `"SDA d'Estourmel" <contact@sda-nord.com>`,
    to: TEST_RECIPIENT.email,
    subject,
    html,
    replyTo: 'contact@sda-nord.com',
    attachments: [
      {
        filename: `Convention_SDA_${CONVENTION.contractNumber}_${CONVENTION.scopeName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  })
  console.log(`   ✓ messageId : ${result.messageId}`)

  console.log('\n✅ Test envoyé !')
  console.log(`   → ouvre ${TEST_RECIPIENT.email}, clique sur "Signer la convention"`)
  console.log(`   → la page Documenso doit s'ouvrir avec la convention Maroilles et les 3 champs sur la page ${lastPage}`)
  console.log(`   → document id Documenso : ${documentId} (à supprimer après test si besoin)`)
}

main().catch((e) => {
  console.error('\n❌ Erreur :', e.message)
  process.exit(1)
})
