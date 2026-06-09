/**
 * Génère un fichier HTML local du mail tel que verrait une mairie (variante D),
 * pour prévisualisation dans le navigateur.
 *
 * Note : l'image du flyer en pièce jointe ne s'affichera pas en HTML local
 * (cid:flyer-fete-animaux ne fonctionne que dans un client mail). On la
 * remplace ici par un lien file:// vers le flyer original sur le disque
 * pour que le rendu reste représentatif.
 */

import { promises as fs } from 'node:fs'

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

const PRIMARY = '#5ba8a0'
const PRIMARY_DARK = '#1e3a5f'
const ORANGE = '#c96b3c'
const TEXT = '#1e3a5f'
const TEXT_MUTED = '#6b7f96'
const BORDER = '#d9e6ed'
const BG = '#f0f7fa'
const SURFACE = '#ffffff'
const FOOTER_GRADIENT = 'linear-gradient(90deg, #c96b3c 0%, #5ba8a0 50%, #1e3a5f 100%)'

const FLYER_LOCAL_URL = 'file:///Users/clement/Downloads/WhatsApp%20Image%202026-06-06%20at%2011.51.22.jpeg'

const greeting = 'Madame, Monsieur,'
const intro = `La Société de Défense des Animaux du Nord (SDA) a l'honneur de vous convier à la <strong>Fête des Animaux</strong> qu'elle organise le <strong>dimanche 14 juin prochain, de 11h à 17h</strong>, au refuge d'Estourmel.`
const closing = `Votre présence serait un signe fort de soutien à l'action que mène la SDA sur votre territoire, et l'occasion d'échanger directement avec les équipes et les bénévoles.`

const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>Invitation à la Fête des Animaux du 14 juin</title>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${TEXT};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${BG};">
<tr><td align="center" style="padding:32px 16px;">

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;margin-bottom:16px;">
    <tr><td style="padding:0 8px;">
      <div style="font-size:20px;font-weight:700;color:${PRIMARY_DARK};letter-spacing:0.5px;line-height:1.1;">
        <span style="color:${PRIMARY};">SDA</span> d'Estourmel
      </div>
      <div style="font-size:9px;color:${PRIMARY};font-weight:600;text-transform:uppercase;letter-spacing:1.8px;margin-top:3px;">
        Défendons les animaux · depuis 1922
      </div>
    </td></tr>
  </table>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:${SURFACE};border:1px solid ${BORDER};border-radius:8px;overflow:hidden;">
    <tr><td style="padding:0;line-height:0;height:4px;background:${FOOTER_GRADIENT};">&nbsp;</td></tr>
    <tr><td style="padding:0;line-height:0;background:${BG};" align="center">
      <img src="${FLYER_LOCAL_URL}" alt="Affiche Fête des Animaux" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;" />
    </td></tr>
    <tr><td style="padding:24px 40px 0 40px;">
      <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:1px;color:${ORANGE};text-transform:uppercase;">Invitation officielle</p>
      <h1 style="margin:8px 0 4px 0;font-size:26px;line-height:1.2;font-weight:700;color:${TEXT};">Fête des Animaux</h1>
      <p style="margin:0;font-size:15px;color:${TEXT_MUTED};">Dimanche 14 juin 2026 &nbsp;·&nbsp; de 11h à 17h &nbsp;·&nbsp; Refuge d'Estourmel</p>
    </td></tr>
    <tr><td style="padding:24px 40px 8px 40px;">
      <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:${TEXT};">${greeting}</p>
      <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:${TEXT};">${intro}</p>
      <p style="margin:0;font-size:15px;line-height:1.6;color:${TEXT};">Cette journée est l'occasion pour les habitants de votre commune et des alentours de découvrir le refuge, les animaux pris en charge et le travail accompli au quotidien par notre association. ${closing}</p>
    </td></tr>
    <tr><td style="padding:24px 40px 8px 40px;">
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
    <tr><td style="padding:24px 40px 8px 40px;">
      <p style="margin:0 0 8px 0;font-size:14px;font-weight:600;color:${TEXT};">📍 Adresse et accès</p>
      <p style="margin:0;font-size:14px;line-height:1.6;color:${TEXT};">
        Refuge SDA, 11 RN 43<br/>
        59400 Estourmel<br/>
        <a href="https://maps.apple.com/?q=SDA+11+RN+43+Estourmel" style="color:${PRIMARY};text-decoration:none;">Itinéraire Apple Plans</a>
        &nbsp;·&nbsp;
        <a href="https://www.google.com/maps/search/?api=1&query=SDA+11+RN+43+Estourmel+59400" style="color:${PRIMARY};text-decoration:none;">Google Maps</a>
      </p>
    </td></tr>
    <tr><td style="padding:24px 40px 32px 40px;">
      <p style="margin:0;font-size:14px;line-height:1.6;color:${TEXT};">
        <strong style="color:${PRIMARY_DARK};">Clément Scailteux</strong><br/>
        <span style="color:${TEXT_MUTED};">Président de la SDA d'Estourmel</span>
      </p>
    </td></tr>
  </table>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;margin-top:24px;">
    <tr><td align="center" style="padding:0 8px;">
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

</td></tr></table>
</body></html>`

const outPath = '/tmp/preview-mail-mairie.html'
await fs.writeFile(outPath, html, 'utf-8')
console.log(`OK preview écrite dans ${outPath}`)
