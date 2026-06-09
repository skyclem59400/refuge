/**
 * Test mail invitation élus — Fête des Animaux du dimanche 14 juin 2026.
 *
 * Envoie une version GÉNÉRIQUE (vouvoiement institutionnel) à
 * clement.scailteux@gmail.com pour validation visuelle, avec le flyer
 * western en pièce jointe.
 *
 * Une fois validé, on enverra le mail en bulk (49 mairies + 5 VIP avec
 * variantes tu/vous selon proximité).
 *
 * Lance :
 *   BREVO_SMTP_USER=… BREVO_SMTP_KEY=… node /tmp/test-fete-animaux-email.mjs
 */

import nodemailer from 'nodemailer'
import { promises as fs } from 'node:fs'

const FLYER_PATH = '/Users/clement/Downloads/WhatsApp Image 2026-06-06 at 11.51.22.jpeg'

// === Charte SDA ===
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
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/**
 * Construit le mail HTML. `variant` :
 *   - 'tu-prenom'     : tutoiement + prénom        → Marjorie, Grégory, Frédéric
 *   - 'vous-prenom'   : vouvoiement + prénom       → Émeric
 *   - 'vous-nom'      : vouvoiement + civilité+nom → Serge Siméon, Olivier Leveaux, Rémi Coupé
 *   - 'institutionnel': vouvoiement anonyme        → 49 mairies
 *
 * `engaged` (booléen) :
 *   - true  : VIP qui ont contribué au tournant 1,25 € (Marjorie, Grégory, Émeric)
 *     → paragraphe "remerciement contextuel" sur l'évolution politique
 *   - false : VIP non encore engagés (Siméon, Leveaux pour la CA2C)
 *     → version light, juste "j'aurais le plaisir de vous accueillir"
 *   (Ignoré pour la variante 'institutionnel' qui n'a pas de bloc remerciement.)
 *
 * `customThanks` (string HTML, optionnel) :
 *   Si fourni, remplace entièrement le bloc remerciement (engaged ou light)
 *   par ce texte personnalisé. Utile pour les VIP dont on connaît l'histoire
 *   précise (Frédéric Bricout, Rémi Coupé). Doit être du HTML valide à
 *   l'intérieur d'un <p>. Peut contenir des </p><p> pour faire plusieurs
 *   paragraphes.
 */
function buildHtml({ variant, firstName, lastName, civility, engaged = true, customThanks = null }) {
  const greeting = (() => {
    if (variant === 'tu-prenom') return `Bonjour ${escapeHtml(firstName)},`
    if (variant === 'vous-prenom') return `Bonjour ${escapeHtml(firstName)},`
    if (variant === 'vous-nom') return `${escapeHtml(civility || 'Monsieur')} ${escapeHtml(lastName)},`
    return 'Madame, Monsieur,'
  })()

  const isVip = variant === 'tu-prenom' || variant === 'vous-prenom' || variant === 'vous-nom'
  const isTu = variant === 'tu-prenom'

  const intro = (() => {
    if (isTu) {
      return `J'aurais grand plaisir à t'accueillir au refuge à l'occasion de la <strong>Fête des Animaux</strong> que nous organisons le <strong>dimanche 14 juin prochain, de 11h à 17h</strong>, à Estourmel.`
    }
    if (isVip) {
      return `J'aurais le plaisir de vous accueillir au refuge à l'occasion de la <strong>Fête des Animaux</strong> que nous organisons le <strong>dimanche 14 juin prochain, de 11h à 17h</strong>, à Estourmel.`
    }
    return `La Société de Défense des Animaux du Nord (SDA) a l'honneur de vous convier à la <strong>Fête des Animaux</strong> qu'elle organise le <strong>dimanche 14 juin prochain, de 11h à 17h</strong>, au refuge d'Estourmel.`
  })()

  // Bloc VIP :
  //   - customThanks : si fourni, remplace tout (texte sur mesure ex Frédéric, Rémi)
  //   - engaged=true : paragraphe "remerciement contextuel" (élections, 1,25 €)
  //                    pour Marjorie, Grégory, Émeric
  //   - engaged=false: version courte (Siméon, Leveaux)
  // Les 49 mairies (variant=institutionnel) gardent leur closing classique.
  const vipBody = (() => {
    if (!isVip) return ''
    if (customThanks) return customThanks

    const youObj = isTu ? `t'` : `vous `        // collage : "t'adresser" vs "vous adresser"
    const youPron = isTu ? `te` : `vous`        // template : ${youPron} montrer → espace dans le HTML
    const yourPos = isTu ? `ton` : `votre`
    const youVerb = isTu ? `portes` : `portez`
    const accueillir = isTu ? `t'accueillir` : `vous accueillir`
    const honor = (variant === 'vous-prenom' || variant === 'vous-nom') ? ` et un honneur` : ``

    if (engaged) {
      return `Au-delà du caractère convivial de cette journée, je tenais à ${youObj}adresser un mot plus personnel. Les dernières élections municipales et intercommunales ont marqué un véritable tournant pour la cause animale sur notre territoire. Pour la première fois depuis longtemps, le bien-être des animaux est réellement pris en compte par les élus. L'évolution du tarif de la fourrière conventionnée à <strong>1,25 €/habitant</strong> en est le signal le plus visible, mais c'est plus largement une nouvelle dynamique qui s'installe, et la SDA y est extrêmement sensible.</p>
          <p style="margin:16px 0 0 0;font-size:15px;line-height:1.6;color:${TEXT};">Merci pour ${yourPos} engagement et l'attention que ${youVerb} à ces sujets. Ce serait pour moi un véritable plaisir${honor} de pouvoir ${accueillir} le 14 juin pour ${youPron} montrer concrètement le travail réalisé, ${youPron} présenter les équipes et échanger sur les perspectives d'évolution`
    }
    // Version light : sobre, sans contexte politique
    return `Ce serait pour moi un véritable plaisir${honor} de pouvoir ${accueillir} le 14 juin pour ${youPron} faire découvrir le refuge, ${youPron} présenter les équipes et échanger plus avant sur notre travail au quotidien`
  })()

  const closing = (() => {
    if (isVip) return `` // remplacé par contextThanks
    return `Votre présence serait un signe fort de soutien à l'action que mène la SDA sur votre territoire, et l'occasion d'échanger directement avec les équipes et les bénévoles.`
  })()

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>Invitation à la Fête des Animaux du 14 juin</title>
  <style>
    @media only screen and (max-width: 620px) {
      .container { width: 100% !important; padding-left: 0 !important; padding-right: 0 !important; }
      .px-mobile { padding-left: 24px !important; padding-right: 24px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;color:${TEXT};">
  <div style="display:none;font-size:0;line-height:0;color:${BG};max-height:0;max-width:0;opacity:0;overflow:hidden;">
    Invitation officielle à la Fête des Animaux du dimanche 14 juin 2026 au refuge SDA d'Estourmel, de 11h à 17h.
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${BG};">
    <tr><td align="center" style="padding:32px 16px;">

      <!-- Header logo SDA -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="container" style="max-width:600px;margin-bottom:16px;">
        <tr><td class="px-mobile" style="padding:0 8px;">
          <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:20px;font-weight:700;color:${PRIMARY_DARK};letter-spacing:0.5px;line-height:1.1;">
            <span style="color:${PRIMARY};">SDA</span> d'Estourmel
          </div>
          <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:9px;color:${PRIMARY};font-weight:600;text-transform:uppercase;letter-spacing:1.8px;margin-top:3px;">
            Défendons les animaux · depuis 1922
          </div>
        </td></tr>
      </table>

      <!-- Card principale -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="container" style="max-width:600px;background:${SURFACE};border:1px solid ${BORDER};border-radius:8px;overflow:hidden;">
        <tr><td style="padding:0;line-height:0;height:4px;background:${FOOTER_GRADIENT};">&nbsp;</td></tr>

        <!-- Visuel de l'affiche en haut -->
        <tr><td style="padding:0;line-height:0;background:${BG};" align="center">
          <img src="cid:flyer-fete-animaux" alt="Affiche Fête des Animaux, Dimanche 14 juin de 11h à 17h" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;" />
        </td></tr>

        <!-- Bandeau date -->
        <tr><td class="px-mobile" style="padding:24px 40px 0 40px;">
          <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:1px;color:${ORANGE};text-transform:uppercase;">Invitation officielle</p>
          <h1 style="margin:8px 0 4px 0;font-size:26px;line-height:1.2;font-weight:700;color:${TEXT};">Fête des Animaux</h1>
          <p style="margin:0;font-size:15px;color:${TEXT_MUTED};">Dimanche 14 juin 2026 &nbsp;·&nbsp; de 11h à 17h &nbsp;·&nbsp; Refuge d'Estourmel</p>
        </td></tr>

        <!-- Corps du message -->
        <tr><td class="px-mobile" style="padding:24px 40px 8px 40px;">
          <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:${TEXT};">${greeting}</p>
          <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:${TEXT};">${intro}</p>
          ${isVip
            ? `<p style="margin:0;font-size:15px;line-height:1.6;color:${TEXT};">${vipBody}.</p>`
            : `<p style="margin:0;font-size:15px;line-height:1.6;color:${TEXT};">Cette journée est l'occasion pour les habitants de votre commune et des alentours de découvrir le refuge, les animaux pris en charge et le travail accompli au quotidien par notre association. ${closing}</p>`
          }
        </td></tr>

        <!-- Encart Programme -->
        <tr><td class="px-mobile" style="padding:24px 40px 8px 40px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${BORDER};border-radius:8px;background:${BG};">
            <tr><td style="padding:18px 20px;">
              <p style="margin:0 0 12px 0;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${PRIMARY};">Au programme</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;line-height:1.8;color:${TEXT};">
                <tr><td>🐾 &nbsp; Concours de beauté canin et félin</td></tr>
                <tr><td>🎶 &nbsp; Concert sur scène</td></tr>
                <tr><td>🦮 &nbsp; Démonstration canine</td></tr>
                <tr><td>🍻 &nbsp; Buvette et restauration sur place</td></tr>
                <tr><td>🎪 &nbsp; Nombreux stands</td></tr>
              </table>
              <p style="margin:14px 0 0 0;padding-top:12px;border-top:1px solid ${BORDER};font-size:13px;color:${TEXT_MUTED};">
                <strong style="color:${ORANGE};">Entrée gratuite</strong> &nbsp;·&nbsp; ouvert à tous
              </p>
            </td></tr>
          </table>
        </td></tr>

        <!-- Adresse & accès -->
        <tr><td class="px-mobile" style="padding:24px 40px 8px 40px;">
          <p style="margin:0 0 8px 0;font-size:14px;font-weight:600;color:${TEXT};">📍 Adresse et accès</p>
          <p style="margin:0;font-size:14px;line-height:1.6;color:${TEXT};">
            Refuge SDA, 11 RN 43<br/>
            59400 Estourmel<br/>
            <a href="https://maps.apple.com/?q=SDA+11+RN+43+Estourmel" style="color:${PRIMARY};text-decoration:none;">Itinéraire Apple Plans</a>
            &nbsp;·&nbsp;
            <a href="https://www.google.com/maps/search/?api=1&query=SDA+11+RN+43+Estourmel+59400" style="color:${PRIMARY};text-decoration:none;">Google Maps</a>
          </p>
        </td></tr>

        <!-- Signature -->
        <tr><td class="px-mobile" style="padding:24px 40px 32px 40px;">
          <p style="margin:0;font-size:14px;line-height:1.6;color:${TEXT};">
            <strong style="color:${PRIMARY_DARK};">Clément Scailteux</strong><br/>
            <span style="color:${TEXT_MUTED};">Président de la SDA d'Estourmel</span>
          </p>
        </td></tr>
      </table>

      <!-- Footer -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="container" style="max-width:600px;margin-top:24px;">
        <tr><td class="px-mobile" align="center" style="padding:0 8px;">
          <p style="margin:0;font-size:13px;color:${TEXT_MUTED};line-height:1.6;">
            <strong style="color:${TEXT};">Société de Défense des Animaux du Nord (SDA)</strong><br />
            11 RN 43, 59400 Estourmel &nbsp;·&nbsp;
            <a href="https://sda-nord.com" style="color:${TEXT_MUTED};text-decoration:none;">sda-nord.com</a>
          </p>
          <p style="margin:12px 0 0 0;font-size:11px;color:${TEXT_MUTED};line-height:1.5;">
            Association loi 1901 reconnue d'utilité publique
          </p>
        </td></tr>
      </table>

    </td></tr>
  </table>
</body>
</html>`
}

async function main() {
  const user = process.env.BREVO_SMTP_USER
  const pass = process.env.BREVO_SMTP_KEY
  if (!user || !pass) {
    console.error('❌ BREVO_SMTP_USER et BREVO_SMTP_KEY requis')
    process.exit(1)
  }

  console.log('📥 Lecture du flyer...')
  const flyerBuffer = await fs.readFile(FLYER_PATH)
  console.log(`   ${(flyerBuffer.length / 1024).toFixed(1)} ko`)

  console.log('📧 Envoi du test à clement.scailteux@gmail.com...')
  const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: { user, pass },
  })

  const flyerAttachment = {
    filename: 'Affiche_Fete_des_Animaux_14_juin_2026.jpeg',
    content: flyerBuffer,
    contentType: 'image/jpeg',
    cid: 'flyer-fete-animaux',
  }

  // Texte personnalisé pour Alexandre Dufosset (député, venu à la ferme, tutoiement).
  const thanksAlexandre = `Au-delà du caractère convivial de cette journée, je tenais à t'adresser un mot plus personnel. Ta venue à la ferme, ton écoute attentive et ta mobilisation pour la cause animale au sens large comptent énormément pour la SDA. Tu portes ces sujets avec une fibre sincère, et c'est précieux dans le paysage politique actuel.</p>
          <p style="margin:16px 0 0 0;font-size:15px;line-height:1.6;color:${TEXT};">Ce serait pour moi un vrai plaisir de pouvoir t'accueillir le 14 juin pour te présenter concrètement le travail des équipes et échanger plus avant sur les perspectives d'évolution pour la cause animale, à laquelle tu es attaché`

  // Variantes envoyées sur ce test : Alexandre Dufosset (député, tutoiement)
  const variants = [
    {
      label: 'H · perso Alexandre Dufosset (tu+prénom, mention venue ferme + fibre animale)',
      tag: 'TEST H · Alexandre Dufosset (perso, tu)',
      params: { variant: 'tu-prenom', firstName: 'Alexandre', customThanks: thanksAlexandre },
    },
  ]

  for (const v of variants) {
    const html = buildHtml(v.params)
    const result = await transporter.sendMail({
      from: `"SDA d'Estourmel" <contact@sda-nord.com>`,
      to: 'clement.scailteux@gmail.com',
      subject: `Bonjour Alexandre, invitation pour le dimanche 14 juin (test tu)`,
      html,
      replyTo: 'accueil@sda-nord.com',
      attachments: [flyerAttachment],
    })
    console.log(`OK ${v.label}  messageId ${result.messageId}`)
  }

  console.log('\n✅ 4 mails de test envoyés. Ouvre ta boîte clement.scailteux@gmail.com.')
  console.log('   → Regarde les 4 et dis-moi GO ou ajustements.')
}

main().catch((e) => {
  console.error('\n❌ Erreur :', e.message)
  process.exit(1)
})
