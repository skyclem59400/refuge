/**
 * Envoi unitaire de l'invitation Fête des Animaux à Alexandre Dufosset (député).
 * Variante : tu+prénom + texte personnalisé (venue à la ferme, fibre animale).
 *
 * Formulation finale validée par Clément (avec la closing line raccourcie
 * "te tiennent à cœur").
 */

import nodemailer from 'nodemailer'
import { promises as fs } from 'node:fs'

const BREVO_USER = process.env.BREVO_SMTP_USER
const BREVO_KEY = process.env.BREVO_SMTP_KEY
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

const greeting = 'Bonjour Alexandre,'
const intro = `J'aurais grand plaisir à t'accueillir au refuge à l'occasion de la <strong>Fête des Animaux</strong> que nous organisons le <strong>dimanche 14 juin prochain, de 11h à 17h</strong>, à Estourmel.`
const customThanks = `Au-delà du caractère convivial de cette journée, je tenais à t'adresser un mot plus personnel. Ta venue à la ferme, ton écoute attentive et ta mobilisation pour la cause animale au sens large comptent énormément pour la SDA. Tu portes ces sujets avec une fibre sincère, et c'est précieux dans le paysage politique actuel.</p>
          <p style="margin:16px 0 0 0;font-size:15px;line-height:1.6;color:${TEXT};">Ce serait un vrai plaisir de t'accueillir le 14 juin, de te montrer ce qu'on fait sur le terrain et de prendre le temps d'échanger sur les sujets qui te tiennent à cœur`

const html = `<!DOCTYPE html>
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
          <p style="margin:0;font-size:15px;line-height:1.6;color:${TEXT};">${customThanks}.</p>
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

const flyerBuffer = await fs.readFile(FLYER_PATH)
console.log(`Flyer chargé : ${(flyerBuffer.length / 1024).toFixed(1)} ko`)

const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
  auth: { user: BREVO_USER, pass: BREVO_KEY },
})

const result = await transporter.sendMail({
  from: `"SDA d'Estourmel" <contact@sda-nord.com>`,
  to: `"Alexandre Dufosset" <alexandre.dufosset@assemblee-nationale.fr>`,
  subject: 'Invitation à la Fête des Animaux du dimanche 14 juin au refuge SDA',
  html,
  replyTo: 'accueil@sda-nord.com',
  attachments: [
    {
      filename: 'Affiche_Fete_des_Animaux_14_juin_2026.jpeg',
      content: flyerBuffer,
      contentType: 'image/jpeg',
      cid: 'flyer-fete-animaux',
    },
  ],
})

console.log(`OK envoyé à alexandre.dufosset@assemblee-nationale.fr`)
console.log(`messageId : ${result.messageId}`)
