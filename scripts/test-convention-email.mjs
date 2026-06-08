/**
 * Script de test : envoi d'un mail "convention fourrière" à une commune.
 *
 * Simule ce qu'une mairie recevrait quand on lui transmet sa convention
 * triennale signée par la SDA, à retourner signée. Utilisé pour caler le
 * design avant industrialisation dans un futur module
 * `src/lib/email/convention-commune.ts`.
 *
 * Lance via :
 *   BREVO_SMTP_USER=… BREVO_SMTP_KEY=… node /tmp/test-convention-email.mjs
 */

import nodemailer from 'nodemailer'

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
  // Lien Documenso factice pour la maquette — le vrai sera généré au moment
  // de la création du document Documenso (upload PDF + placement du champ
  // signature pour le signataire).
  signingUrl: 'https://signature.optimus-services.fr/sign/preview-CV-2026-0029',
}

// === Charte SDA officielle ===
const PRIMARY = '#5ba8a0'
const PRIMARY_DARK = '#1e3a5f'
const ORANGE = '#c96b3c'
const TEXT = '#1e3a5f'
const TEXT_MUTED = '#6b7f96'
const BORDER = '#d9e6ed'
const BG = '#f0f7fa'
const SURFACE = '#ffffff'
const FOOTER_GRADIENT = 'linear-gradient(90deg, #c96b3c 0%, #5ba8a0 50%, #1e3a5f 100%)'

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function fmtEuros(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

function buildHtml(c) {
  const orgName = "SDA d'Estourmel"
  const subject = `Convention de fourrière animale ${c.contractNumber} — ${c.scopeName}`
  const intro = `Madame, Monsieur,<br><br>
Suite à votre accord et conformément aux articles L211-24 et L211-25 du Code rural et de la pêche maritime, la <strong>Société de Défense des Animaux du Nord (SDA)</strong> vous adresse ci-joint la convention de fourrière animale entre votre commune et notre établissement.`

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
  <style>
    @media only screen and (max-width: 620px) {
      .container { width: 100% !important; padding-left: 0 !important; padding-right: 0 !important; }
      .px-mobile { padding-left: 24px !important; padding-right: 24px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;color:${TEXT};">
  <div style="display:none;font-size:0;line-height:0;color:${BG};max-height:0;max-width:0;opacity:0;overflow:hidden;">
    Convention de fourrière animale ${c.contractNumber} à signer et à retourner.
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${BG};">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <!-- Header logo SDA -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="container" style="max-width:600px;margin-bottom:16px;">
          <tr>
            <td class="px-mobile" style="padding:0 8px;">
              <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:20px;font-weight:700;color:${PRIMARY_DARK};letter-spacing:0.5px;line-height:1.1;">
                <span style="color:${PRIMARY};">SDA</span> d'Estourmel
              </div>
              <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:9px;color:${PRIMARY};font-weight:600;text-transform:uppercase;letter-spacing:1.8px;margin-top:3px;">
                Défendons les animaux · Fourrière conventionnée
              </div>
            </td>
          </tr>
        </table>

        <!-- Card principale -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="container" style="max-width:600px;background:${SURFACE};border:1px solid ${BORDER};border-radius:8px;overflow:hidden;">
          <tr>
            <td style="padding:0;line-height:0;height:4px;background:${FOOTER_GRADIENT};">&nbsp;</td>
          </tr>

          <!-- Titre -->
          <tr>
            <td class="px-mobile" style="padding:32px 40px 8px 40px;">
              <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:1px;color:${PRIMARY};text-transform:uppercase;">Convention de fourrière animale</p>
              <h1 style="margin:8px 0 0 0;font-size:24px;line-height:1.25;font-weight:700;color:${TEXT};">${escapeHtml(c.scopeName)}</h1>
              <p style="margin:6px 0 0 0;font-size:13px;color:${TEXT_MUTED};font-family:'SF Mono',Menlo,Consolas,monospace;">Référence : ${escapeHtml(c.contractNumber)}</p>
            </td>
          </tr>

          <!-- Corps du message -->
          <tr>
            <td class="px-mobile" style="padding:24px 40px 8px 40px;">
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:${TEXT};">À l'attention de ${escapeHtml(c.signatoryShort)},</p>
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:${TEXT};">${intro}</p>
              <p style="margin:0;font-size:15px;line-height:1.6;color:${TEXT};">Ce document a été pré-rempli avec les coordonnées et la population de référence de votre commune. Nous vous invitons à en prendre connaissance puis à le signer électroniquement via le bouton ci-dessous. Vous recevrez automatiquement une copie signée par les deux parties à l'issue.</p>
            </td>
          </tr>

          <!-- Récapitulatif des conditions -->
          <tr>
            <td class="px-mobile" style="padding:24px 40px 8px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${BORDER};border-radius:8px;background:${BG};">
                <tr>
                  <td style="padding:18px 20px;">
                    <p style="margin:0 0 12px 0;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${PRIMARY};">Récapitulatif des conditions</p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;">
                      <tr>
                        <td style="padding:6px 0;color:${TEXT_MUTED};">Population de référence</td>
                        <td align="right" style="padding:6px 0;color:${TEXT};font-weight:600;">${c.populationReference.toLocaleString('fr-FR')} habitants</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:${TEXT_MUTED};border-top:1px solid ${BORDER};">Taux par habitant</td>
                        <td align="right" style="padding:6px 0;color:${TEXT};font-weight:600;border-top:1px solid ${BORDER};">${fmtEuros(c.ratePerInhabitantEuros)} / an</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:${TEXT_MUTED};border-top:1px solid ${BORDER};font-weight:600;">Cotisation annuelle</td>
                        <td align="right" style="padding:6px 0;color:${PRIMARY_DARK};font-weight:700;font-size:16px;border-top:1px solid ${BORDER};">${fmtEuros(c.yearlyFeeEuros)}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:${TEXT_MUTED};border-top:1px solid ${BORDER};">Intervention nuit / week-end</td>
                        <td align="right" style="padding:6px 0;color:${TEXT};font-weight:600;border-top:1px solid ${BORDER};">${fmtEuros(c.nightInterventionEuros)} (+${fmtEuros(c.nightSurchargeEuros)} dim/férié)</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:${TEXT_MUTED};border-top:1px solid ${BORDER};">Durée du contrat</td>
                        <td align="right" style="padding:6px 0;color:${TEXT};font-weight:600;border-top:1px solid ${BORDER};">${c.durationYears} ans, reconductible</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Signature électronique -->
          <tr>
            <td class="px-mobile" align="center" style="padding:32px 40px 8px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:${PRIMARY_DARK};border-radius:6px;">
                    <a href="${escapeHtml(c.signingUrl)}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:${SURFACE};text-decoration:none;border-radius:6px;">
                      Signer la convention →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:14px 0 0 0;font-size:12px;color:${TEXT_MUTED};line-height:1.5;">
                Signature électronique sécurisée &nbsp;·&nbsp; conforme eIDAS<br/>
                Référence : ${escapeHtml(c.contractNumber)} &nbsp;·&nbsp; durée estimée : 2 minutes
              </p>
            </td>
          </tr>

          <!-- Lien de secours -->
          <tr>
            <td class="px-mobile" style="padding:8px 40px 8px 40px;">
              <div style="border-top:1px solid ${BORDER};padding-top:18px;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:${TEXT_MUTED};">
                  Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :<br />
                  <a href="${escapeHtml(c.signingUrl)}" style="color:${PRIMARY_DARK};word-break:break-all;">${escapeHtml(c.signingUrl)}</a>
                </p>
                <p style="margin:12px 0 0 0;font-size:12px;line-height:1.6;color:${TEXT_MUTED};">
                  Vous trouverez également la convention en pièce jointe à ce courriel pour consultation préalable.
                </p>
              </div>
            </td>
          </tr>

          <!-- Coordonnées contact -->
          <tr>
            <td class="px-mobile" style="padding:24px 40px 32px 40px;">
              <div style="border-top:1px solid ${BORDER};padding-top:18px;">
                <p style="margin:0 0 8px 0;font-size:13px;color:${TEXT_MUTED};">Pour toute question ou ajustement :</p>
                <p style="margin:0;font-size:14px;line-height:1.7;color:${TEXT};">
                  <strong style="color:${PRIMARY_DARK};">Clément Scailteux</strong> — Président<br/>
                  <a href="mailto:contact@sda-nord.com" style="color:${PRIMARY};text-decoration:none;">contact@sda-nord.com</a><br/>
                  <span style="color:${TEXT_MUTED};">03 27 78 22 91 (secrétariat)</span>
                </p>
              </div>
            </td>
          </tr>
        </table>

        <!-- Footer -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="container" style="max-width:600px;margin-top:24px;">
          <tr>
            <td class="px-mobile" align="center" style="padding:0 8px;">
              <p style="margin:0;font-size:13px;color:${TEXT_MUTED};line-height:1.6;">
                <strong style="color:${TEXT};">Société de Défense des Animaux du Nord (SDA)</strong><br />
                11 route nationale, 59400 Estourmel<br />
                <a href="mailto:contact@sda-nord.com" style="color:${PRIMARY};text-decoration:none;">contact@sda-nord.com</a> &nbsp;·&nbsp;
                <a href="https://sda-nord.com" style="color:${TEXT_MUTED};text-decoration:none;">sda-nord.com</a>
              </p>
              <p style="margin:12px 0 0 0;font-size:11px;color:${TEXT_MUTED};line-height:1.5;">
                Association loi 1901 reconnue d'utilité publique &nbsp;·&nbsp; Fourrière conventionnée par arrêté préfectoral<br/>
                Cet envoi fait suite à votre demande de convention. Conformez-vous au document PDF pour les termes exacts.
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`
}

async function main() {
  const user = process.env.BREVO_SMTP_USER
  const pass = process.env.BREVO_SMTP_KEY
  if (!user || !pass) {
    console.error('❌ BREVO_SMTP_USER et BREVO_SMTP_KEY requis en env')
    process.exit(1)
  }

  // 1. Télécharger le PDF depuis Supabase Storage
  console.log(`📥 Téléchargement du PDF : ${CONVENTION.pdfUrl}`)
  const res = await fetch(CONVENTION.pdfUrl)
  if (!res.ok) {
    console.error(`❌ Téléchargement PDF échec : ${res.status} ${res.statusText}`)
    process.exit(1)
  }
  const pdfBuffer = Buffer.from(await res.arrayBuffer())
  console.log(`   PDF récupéré : ${(pdfBuffer.length / 1024).toFixed(1)} ko`)

  // 2. Construire l'email
  const subject = `Convention de fourrière animale ${CONVENTION.contractNumber} — ${CONVENTION.scopeName}`
  const html = buildHtml(CONVENTION)

  // 3. Envoi via Brevo SMTP
  console.log('📧 Envoi via Brevo SMTP...')
  const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: { user, pass },
  })

  const result = await transporter.sendMail({
    from: `"SDA d'Estourmel" <contact@sda-nord.com>`,
    to: 'clement.scailteux@gmail.com',
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

  console.log('✅ Email envoyé')
  console.log(`   messageId : ${result.messageId}`)
  console.log(`   destinataire : clement.scailteux@gmail.com`)
  console.log(`   sujet : ${subject}`)
}

main().catch((e) => {
  console.error('❌ Erreur :', e.message)
  process.exit(1)
})
