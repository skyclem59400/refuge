/**
 * Envoi groupé du mail "Invitation Fête des Animaux du 14 juin" :
 *   - 49 mairies indépendantes (status != cancelled, signatory_email NOT NULL)
 *     → variante D institutionnel ("Madame, Monsieur")
 *   - 7 VIP avec leurs variantes personnalisées :
 *       Marjorie Gosselet     (CAC Pdte)       → A · tu+prénom engagé
 *       Grégory Pourrier      (CAC VP)         → A · tu+prénom engagé
 *       Émeric François       (Maire Cambrai)  → B · vous+prénom engagé
 *       Frédéric Bricout      (Maire Caudry)   → F · perso (fourgon + portage CA2C)
 *       Serge Siméon          (Pdt CA2C)       → C · vous+nom light (+ CC dgs)
 *       Olivier Leveaux       (DGS CA2C)       → C · vous+nom light
 *       Rémi Coupé            (DGA Sud Artois) → G · perso (venue + engagement 1,25 €)
 *
 * Sécurités :
 *   - Mode DRY_RUN=1 : imprime la liste sans envoyer (vérification finale)
 *   - Envoi séquentiel avec 800ms entre chaque (pour ne pas saturer Brevo SMTP)
 *   - Rapport final dans /tmp/rapport-fete-animaux-bulk.txt
 *
 * Usage :
 *   DRY_RUN=1 BREVO_SMTP_USER=… BREVO_SMTP_KEY=… SUPABASE_SERVICE_ROLE_KEY=… \
 *     node scripts/send-fete-animaux-bulk.mjs   # vérification
 *
 *   BREVO_SMTP_USER=… BREVO_SMTP_KEY=… SUPABASE_SERVICE_ROLE_KEY=… \
 *     node scripts/send-fete-animaux-bulk.mjs   # envoi réel
 */

import nodemailer from 'nodemailer'
import { promises as fs } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BREVO_USER = process.env.BREVO_SMTP_USER
const BREVO_KEY = process.env.BREVO_SMTP_KEY
const DRY_RUN = process.env.DRY_RUN === '1'

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Manque NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!BREVO_USER || !BREVO_KEY) {
  console.error('Manque BREVO_SMTP_USER ou BREVO_SMTP_KEY')
  process.exit(1)
}

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

// === Textes personnalisés (Frédéric Bricout, Rémi Coupé) ===
const THANKS_FREDERIC = `Au-delà du caractère convivial de cette journée, je tenais à te remercier personnellement. Ton soutien sur de nombreux sujets, notamment ton aide précieuse pour l'obtention de la subvention du fourgon, ta disponibilité et ton suivi régulier comptent énormément pour la SDA. Je sais aussi que tu portes activement le sujet du passage à <strong>1,25 €/habitant</strong> au sein de la CA2C, et c'est un combat que nous apprécions sincèrement.</p>
          <p style="margin:16px 0 0 0;font-size:15px;line-height:1.6;color:${TEXT};">Ce serait pour moi un vrai plaisir de te recevoir au refuge le 14 juin pour échanger, te montrer concrètement le travail réalisé et te présenter les équipes`

const THANKS_REMI = `Au-delà du caractère convivial de cette journée, je tenais à vous adresser un mot plus personnel. Votre venue au refuge avant les élections, votre écoute et l'engagement que vous avez pris de porter la cotisation à <strong>1,25 €/habitant</strong>, sur le modèle de ce qu'a déjà mis en place la CAC, sont précieux pour la SDA.</p>
          <p style="margin:16px 0 0 0;font-size:15px;line-height:1.6;color:${TEXT};">Ce serait pour moi un véritable plaisir et un honneur de pouvoir vous accueillir le 14 juin pour vous présenter concrètement le travail réalisé et échanger plus avant sur les perspectives d'évolution`

// === Builder HTML ===
function buildHtml({ variant, firstName, lastName, civility, engaged = true, customThanks = null }) {
  const isVip = variant === 'tu-prenom' || variant === 'vous-prenom' || variant === 'vous-nom'
  const isTu = variant === 'tu-prenom'

  const greeting = (() => {
    if (variant === 'tu-prenom') return `Bonjour ${escapeHtml(firstName)},`
    if (variant === 'vous-prenom') return `Bonjour ${escapeHtml(firstName)},`
    if (variant === 'vous-nom') return `${escapeHtml(civility || 'Monsieur')} ${escapeHtml(lastName)},`
    return 'Madame, Monsieur,'
  })()

  const intro = (() => {
    if (isTu) {
      return `J'aurais grand plaisir à t'accueillir au refuge à l'occasion de la <strong>Fête des Animaux</strong> que nous organisons le <strong>dimanche 14 juin prochain, de 11h à 17h</strong>, à Estourmel.`
    }
    if (isVip) {
      return `J'aurais le plaisir de vous accueillir au refuge à l'occasion de la <strong>Fête des Animaux</strong> que nous organisons le <strong>dimanche 14 juin prochain, de 11h à 17h</strong>, à Estourmel.`
    }
    return `La Société de Défense des Animaux du Nord (SDA) a l'honneur de vous convier à la <strong>Fête des Animaux</strong> qu'elle organise le <strong>dimanche 14 juin prochain, de 11h à 17h</strong>, au refuge d'Estourmel.`
  })()

  const vipBody = (() => {
    if (!isVip) return ''
    if (customThanks) return customThanks
    const youObj = isTu ? `t'` : `vous `
    const youPron = isTu ? `te` : `vous`
    const yourPos = isTu ? `ton` : `votre`
    const youVerb = isTu ? `portes` : `portez`
    const accueillir = isTu ? `t'accueillir` : `vous accueillir`
    const honor = (variant === 'vous-prenom' || variant === 'vous-nom') ? ` et un honneur` : ``
    if (engaged) {
      return `Au-delà du caractère convivial de cette journée, je tenais à ${youObj}adresser un mot plus personnel. Les dernières élections municipales et intercommunales ont marqué un véritable tournant pour la cause animale sur notre territoire. Pour la première fois depuis longtemps, le bien-être des animaux est réellement pris en compte par les élus. L'évolution du tarif de la fourrière conventionnée à <strong>1,25 €/habitant</strong> en est le signal le plus visible, mais c'est plus largement une nouvelle dynamique qui s'installe, et la SDA y est extrêmement sensible.</p>
          <p style="margin:16px 0 0 0;font-size:15px;line-height:1.6;color:${TEXT};">Merci pour ${yourPos} engagement et l'attention que ${youVerb} à ces sujets. Ce serait pour moi un véritable plaisir${honor} de pouvoir ${accueillir} le 14 juin pour ${youPron} montrer concrètement le travail réalisé, ${youPron} présenter les équipes et échanger sur les perspectives d'évolution`
    }
    return `Ce serait pour moi un véritable plaisir${honor} de pouvoir ${accueillir} le 14 juin pour ${youPron} faire découvrir le refuge, ${youPron} présenter les équipes et échanger plus avant sur notre travail au quotidien`
  })()

  const closing = isVip ? '' : `Votre présence serait un signe fort de soutien à l'action que mène la SDA sur votre territoire, et l'occasion d'échanger directement avec les équipes et les bénévoles.`

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
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="container" style="max-width:600px;background:${SURFACE};border:1px solid ${BORDER};border-radius:8px;overflow:hidden;">
        <tr><td style="padding:0;line-height:0;height:4px;background:${FOOTER_GRADIENT};">&nbsp;</td></tr>
        <tr><td style="padding:0;line-height:0;background:${BG};" align="center">
          <img src="cid:flyer-fete-animaux" alt="Affiche Fête des Animaux, Dimanche 14 juin de 11h à 17h" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;" />
        </td></tr>
        <tr><td class="px-mobile" style="padding:24px 40px 0 40px;">
          <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:1px;color:${ORANGE};text-transform:uppercase;">Invitation officielle</p>
          <h1 style="margin:8px 0 4px 0;font-size:26px;line-height:1.2;font-weight:700;color:${TEXT};">Fête des Animaux</h1>
          <p style="margin:0;font-size:15px;color:${TEXT_MUTED};">Dimanche 14 juin 2026 &nbsp;·&nbsp; de 11h à 17h &nbsp;·&nbsp; Refuge d'Estourmel</p>
        </td></tr>
        <tr><td class="px-mobile" style="padding:24px 40px 8px 40px;">
          <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:${TEXT};">${greeting}</p>
          <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:${TEXT};">${intro}</p>
          ${isVip
            ? `<p style="margin:0;font-size:15px;line-height:1.6;color:${TEXT};">${vipBody}.</p>`
            : `<p style="margin:0;font-size:15px;line-height:1.6;color:${TEXT};">Cette journée est l'occasion pour les habitants de votre commune et des alentours de découvrir le refuge, les animaux pris en charge et le travail accompli au quotidien par notre association. ${closing}</p>`
          }
        </td></tr>
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
        <tr><td class="px-mobile" style="padding:24px 40px 32px 40px;">
          <p style="margin:0;font-size:14px;line-height:1.6;color:${TEXT};">
            <strong style="color:${PRIMARY_DARK};">Clément Scailteux</strong><br/>
            <span style="color:${TEXT_MUTED};">Président de la SDA d'Estourmel</span>
          </p>
        </td></tr>
      </table>
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
</body></html>`
}

// === Construction de la liste cible ===
async function buildRecipientList() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 49 mairies (status != cancelled, email présent)
  const { data: mairies, error } = await supabase
    .from('convention_contracts')
    .select('contract_number, scope_name, signatory_email, signatory_name')
    .not('signatory_email', 'is', null)
    .neq('status', 'cancelled')
    .not('municipality_code_insee', 'is', null)
    .order('scope_name')

  if (error) throw new Error(`Supabase: ${error.message}`)

  const mairieList = (mairies || []).map((m) => ({
    label: m.scope_name,
    to: m.signatory_email,
    toName: m.signatory_name || m.scope_name,
    params: { variant: 'institutionnel' },
  }))

  // 7 VIP avec leurs variantes personnalisées
  const vipList = [
    {
      label: 'Marjorie Gosselet (Présidente CAC)',
      to: 'm.gosselet@niergnies.fr',
      toName: 'Marjorie Gosselet',
      params: { variant: 'tu-prenom', firstName: 'Marjorie', engaged: true },
    },
    {
      label: 'Grégory Pourrier (VP CAC)',
      to: 'gpourrier@mairie-cambrai.fr',
      toName: 'Grégory Pourrier',
      params: { variant: 'tu-prenom', firstName: 'Grégory', engaged: true },
    },
    {
      label: 'Émeric François (Maire Cambrai)',
      to: 'efrancois@mairie-cambrai.fr',
      toName: 'Émeric François',
      params: { variant: 'vous-prenom', firstName: 'Émeric', engaged: true },
    },
    {
      label: 'Frédéric Bricout (Maire Caudry)',
      to: 'fredbricout59540@gmail.com',
      toName: 'Frédéric Bricout',
      params: { variant: 'tu-prenom', firstName: 'Frédéric', customThanks: THANKS_FREDERIC },
    },
    {
      label: 'Serge Siméon (Président CA2C)',
      to: 'ssimeon@caudresis-catesis.fr',
      toName: 'Serge Siméon',
      cc: 'dgs@caudresis-catesis.fr',
      params: { variant: 'vous-nom', civility: 'Monsieur', lastName: 'Siméon', engaged: false },
    },
    {
      label: 'Olivier Leveaux (DGS CA2C)',
      to: 'dgs@caudresis-catesis.fr',
      toName: 'Olivier Leveaux',
      params: { variant: 'vous-nom', civility: 'Monsieur', lastName: 'Leveaux', engaged: false },
    },
    {
      label: 'Rémi Coupé (DGA Sud Artois)',
      to: 'rcoupe@cc-sudartois.fr',
      toName: 'Rémi Coupé',
      params: { variant: 'vous-nom', civility: 'Monsieur', lastName: 'Coupé', customThanks: THANKS_REMI },
    },
  ]

  return [...vipList, ...mairieList] // VIP en premier (envoi prioritaire)
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  console.log(`Mode : ${DRY_RUN ? 'DRY RUN (pas d\'envoi)' : 'ENVOI RÉEL'}`)
  console.log('Chargement de la liste...')
  const list = await buildRecipientList()
  console.log(`Total destinataires : ${list.length}`)

  console.log('\nListe complète :')
  for (const [i, r] of list.entries()) {
    const cc = r.cc ? ` (CC: ${r.cc})` : ''
    const variant = r.params.variant + (r.params.engaged ? ' engagé' : r.params.customThanks ? ' perso' : ' light')
    console.log(`  ${(i + 1).toString().padStart(2, ' ')}. ${r.label.padEnd(45, ' ')} → ${r.to}${cc}  [${variant}]`)
  }

  if (DRY_RUN) {
    console.log('\nDRY RUN terminé, aucun mail envoyé. Réexécute sans DRY_RUN=1 pour envoyer.')
    return
  }

  console.log('\nChargement du flyer...')
  const flyerBuffer = await fs.readFile(FLYER_PATH)
  console.log(`  ${(flyerBuffer.length / 1024).toFixed(1)} ko`)

  console.log('\nDébut de l\'envoi séquentiel...')
  const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: { user: BREVO_USER, pass: BREVO_KEY },
  })

  const flyerAttachment = {
    filename: 'Affiche_Fete_des_Animaux_14_juin_2026.jpeg',
    content: flyerBuffer,
    contentType: 'image/jpeg',
    cid: 'flyer-fete-animaux',
  }

  const results = []
  for (const [i, r] of list.entries()) {
    const prefix = `[${(i + 1).toString().padStart(2, ' ')}/${list.length}]`
    try {
      const html = buildHtml(r.params)
      const result = await transporter.sendMail({
        from: `"SDA d'Estourmel" <contact@sda-nord.com>`,
        to: r.toName ? `"${r.toName}" <${r.to}>` : r.to,
        cc: r.cc,
        subject: 'Invitation à la Fête des Animaux du dimanche 14 juin au refuge SDA',
        html,
        replyTo: 'accueil@sda-nord.com',
        attachments: [flyerAttachment],
      })
      console.log(`${prefix} OK ${r.label}`)
      results.push({ label: r.label, to: r.to, cc: r.cc, ok: true, messageId: result.messageId })
    } catch (e) {
      console.error(`${prefix} ÉCHEC ${r.label} : ${e.message}`)
      results.push({ label: r.label, to: r.to, cc: r.cc, ok: false, error: e.message })
    }
    // Délai entre envois pour ne pas saturer Brevo (limite ~20/s côté Brevo, on prend marge)
    await sleep(800)
  }

  // === Rapport final ===
  const ok = results.filter((r) => r.ok).length
  const ko = results.length - ok
  console.log(`\nRésultat global : ${ok} OK · ${ko} échec(s)`)

  if (ko > 0) {
    console.log('\nÉchecs :')
    for (const r of results.filter((r) => !r.ok)) {
      console.log(`  ${r.label} (${r.to}) : ${r.error}`)
    }
  }

  // Sauvegarde du rapport
  const reportPath = '/tmp/rapport-fete-animaux-bulk.txt'
  const lines = [
    `Rapport envoi Fête des Animaux ${new Date().toISOString()}`,
    `Total ${results.length} · OK ${ok} · Échec ${ko}`,
    '',
    ...results.map((r) =>
      r.ok
        ? `OK    ${r.label.padEnd(50, ' ')} → ${r.to}${r.cc ? ' (CC: ' + r.cc + ')' : ''}  [${r.messageId}]`
        : `KO    ${r.label.padEnd(50, ' ')} → ${r.to}  ERREUR: ${r.error}`,
    ),
  ]
  await fs.writeFile(reportPath, lines.join('\n'), 'utf-8')
  console.log(`\nRapport sauvegardé dans ${reportPath}`)
}

main().catch((e) => {
  console.error('\nErreur fatale :', e.message)
  process.exit(1)
})
