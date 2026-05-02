// Templates HTML pour les 3 certificats vétérinaires :
// - Fiche de suivi médical (consultations)
// - Certificat de stérilisation
// - Certificat avant cession (Code rural L.214-8)
//
// Tous reproduisent fidèlement le layout des PDFs sources fournis par la SDA.

import type { Animal, AnimalHealthRecord, Establishment, Veterinarian, VeterinaryClinic } from '@/lib/types/database'

interface CertificateBaseArgs {
  animal: Animal
  establishment: Pick<Establishment, 'name' | 'siret' | 'address' | 'phone' | 'legal_name'>
  vet?: Veterinarian | null
  clinic?: VeterinaryClinic | null
  logoBase64?: string
  generatedAt: Date
}

function fmtDateFr(date: string | null | undefined): string {
  if (!date) return '____ / ____ / _______'
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return '____ / ____ / _______'
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtDateTimeFr(date: Date): string {
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' - ' + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h')
}

function speciesLabel(s: string) {
  if (s === 'cat') return 'Chat'
  if (s === 'dog') return 'Chien'
  return s
}

function sexLabel(s: string) {
  if (s === 'male') return 'Mâle'
  if (s === 'female') return 'Femelle'
  return 'Inconnu'
}

function vetName(vet?: Veterinarian | null): string {
  if (!vet) return 'Vétérinaire désigné'
  if (vet.first_name) return `Dr ${vet.first_name} ${vet.last_name}`
  return `Dr ${vet.last_name}`
}

// Header commun (cabinet véto + propriétaire/cédant)
function buildHeader(args: CertificateBaseArgs): string {
  const { establishment, vet, clinic } = args
  const clinicAddress = [clinic?.address, clinic?.postal_code, clinic?.city].filter(Boolean).join(' ')

  return `<table class="hdr">
    <tr>
      <td class="hdr-cell">
        <div class="hdr-title">Vétérinaire</div>
        <table class="kv">
          <tr><td>Nom / Prénom</td><td><strong>${vetName(vet)}</strong></td></tr>
          ${clinic ? `<tr><td></td><td><strong>${clinic.name}</strong></td></tr>` : ''}
          ${clinicAddress ? `<tr><td>Adresse</td><td>${clinicAddress}</td></tr>` : ''}
          ${clinic?.phone ? `<tr><td>Téléphone</td><td>${clinic.phone}</td></tr>` : ''}
        </table>
      </td>
      <td class="hdr-cell">
        <div class="hdr-title">Propriétaire (cédant)</div>
        <div class="hdr-content">
          <strong>${establishment.legal_name || establishment.name}</strong><br/>
          ${establishment.siret ? `N° SIRET ${establishment.siret}<br/>` : ''}
          ${establishment.address ? `Adresse ${establishment.address}<br/>` : ''}
          ${establishment.phone ? `Téléphone ${establishment.phone}` : ''}
        </div>
      </td>
    </tr>
  </table>`
}

function animalIdentityBlock(animal: Animal): string {
  return `<div class="identity">
    <div><strong>Nom</strong> : ${animal.name}</div>
    <div><strong>Espèce</strong> : ${speciesLabel(animal.species)}</div>
    <div><strong>Race</strong> : ${(animal.breed || '—').toUpperCase()}</div>
    <div><strong>Robe</strong> : ${(animal.color || '—').toUpperCase()}</div>
    <div><strong>Sexe</strong> : ${sexLabel(animal.sex)}</div>
    <div><strong>Stérilisé</strong> : ${animal.sterilized ? 'Oui' : 'Non'}</div>
    <div><strong>Date de naissance</strong> : ${fmtDateFr(animal.birth_date)}</div>
    <div><strong>Numéro de puce</strong> : ${animal.chip_number || '—'}</div>
    <div><strong>Numéro LOOF</strong> : ${animal.loof_number || ''}</div>
    <div><strong>Numéro de tatouage</strong> : ${animal.tattoo_number || ''}</div>
    <div><strong>Médaille</strong> : ${animal.medal_number || ''}</div>
    <div><strong>Signes particuliers</strong> : ${animal.description || ''}</div>
  </div>`
}

function commonStyles(): string {
  return `
    @page { size: A4; margin: 14mm 14mm; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#111; font-size:10pt; margin:0; }
    .hdr { width:100%; border-collapse:separate; border-spacing:8px; margin-bottom:18px; }
    .hdr-cell { width:50%; padding:10px; border:1px solid #999; border-radius:4px; vertical-align:top; }
    .hdr-title { font-weight:700; background:#e5e7eb; padding:4px 8px; margin:-10px -10px 8px -10px; border-radius:4px 4px 0 0; font-size:10pt; }
    .hdr-content { line-height:1.55; }
    .kv { width:100%; }
    .kv td { padding:2px 0; vertical-align:top; }
    .kv td:first-child { width:90px; color:#444; }
    h1 { font-size:22pt; font-weight:600; margin:18px 0 14px 0; }
    h2 { font-size:16pt; font-weight:600; margin:18px 0 10px 0; }
    .identity { display:grid; grid-template-columns: 1fr 1fr; gap:4px 24px; padding:10px; border:1px solid #999; border-radius:4px; margin-bottom:16px; line-height:1.6; }
    .identity div { font-size:10pt; }
    .photo-row { display:flex; gap:14px; align-items:flex-start; margin-bottom:14px; }
    .photo { width:160px; height:160px; object-fit:cover; border:1px solid #ddd; border-radius:4px; flex-shrink:0; }
    .table { width:100%; border-collapse:collapse; margin-top:6px; }
    .table th, .table td { border:1px solid #999; padding:8px; vertical-align:top; font-size:9.5pt; }
    .table th { background:#d4f0d4; text-align:left; font-weight:600; }
    .signature-box { margin-top:32px; padding:14px; border:1px solid #999; border-radius:4px; min-height:120px; }
    .signature-box .label { font-weight:600; margin-bottom:6px; }
    .footer { position:fixed; bottom:5mm; left:14mm; right:14mm; font-size:8pt; color:#9ca3af; }
    .small { font-size:9pt; }
    .legal { font-style:italic; font-size:9pt; color:#444; text-align:center; margin-bottom:12px; }
  `
}

// =====================================================================
// 1) FICHE DE SUIVI MEDICAL
// =====================================================================

export function buildMedicalFollowupHtml(args: CertificateBaseArgs & {
  healthRecords: AnimalHealthRecord[]
  primaryPhoto?: string | null
}): string {
  const { animal, healthRecords, primaryPhoto, generatedAt } = args
  const photo = primaryPhoto || animal.photo_url

  const rows = healthRecords.length === 0
    ? `<tr><td colspan="4" style="text-align:center;color:#888;">Aucune consultation enregistrée</td></tr>`
    : healthRecords.map((r) => `<tr>
        <td style="white-space:nowrap;">${fmtDateFr(r.date)}</td>
        <td>${labelHealthType(r.type)}</td>
        <td>${r.description || ''}${r.notes ? `<br/><span class="small" style="color:#666;">${r.notes}</span>` : ''}</td>
        <td>${r.veterinarian || '—'}</td>
      </tr>`).join('')

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"/>
<title>Fiche de suivi médical — ${animal.name}</title>
<style>${commonStyles()}</style>
</head><body>
${buildHeader(args)}
<h2 style="text-align:center;">Fiche de suivi médical de ${animal.name}</h2>
<div class="photo-row">
  ${photo ? `<img class="photo" src="${photo}" alt="${animal.name}" />` : ''}
  <div style="flex:1;">
    ${animalIdentityBlock(animal)}
  </div>
</div>
<h1 style="font-size:18pt;">CONSULTATIONS</h1>
<table class="table">
  <thead><tr><th style="width:90px;">Date</th><th style="width:150px;">Type</th><th>Description</th><th style="width:140px;">Vétérinaire</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="footer">${fmtDateTimeFr(generatedAt)}</div>
</body></html>`
}

// =====================================================================
// 2) CERTIFICAT DE STERILISATION
// =====================================================================

export function buildSterilizationCertificateHtml(args: CertificateBaseArgs & {
  sterilizationDate: string | null
}): string {
  const { animal, sterilizationDate, logoBase64, vet, clinic, generatedAt } = args
  const vetSig = vet
    ? `<div class="small">${vetName(vet)}${clinic ? `<br/>${clinic.name}` : ''}${clinic?.city ? `<br/>${clinic.city}` : ''}</div>`
    : `<div class="small" style="color:#888;">Cachet et signature du vétérinaire</div>`

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"/>
<title>Certificat de stérilisation — ${animal.name}</title>
<style>${commonStyles()}
  .center { text-align:center; }
  .row { margin: 10px 0; font-size:11pt; line-height:1.7; }
</style>
</head><body>
<div class="center">
  ${logoBase64 ? `<img src="${logoBase64}" alt="Logo SDA" style="height:90px;margin-bottom:10px;" />` : ''}
</div>

<h1 class="center">Certificat de stérilisation</h1>

<div class="row"><strong>Animal</strong> : ${animal.name}</div>
<div class="row"><strong>Race / Croisement</strong> :<br/>${(animal.breed || '').toUpperCase()}${animal.breed_cross ? ` × ${animal.breed_cross.toUpperCase()}` : ''}</div>
<div class="row"><strong>Sexe</strong> : ${sexLabel(animal.sex)}<span style="margin-left:50px;"><strong>Né le</strong> ${fmtDateFr(animal.birth_date)}</span></div>
<div class="row"><strong>Puce électronique</strong> :<br/>${animal.chip_number || '—'}</div>
<div class="row"><strong>Date de l'acte chirurgical</strong> :</div>
<div class="row" style="margin-left:20px;">Le ${fmtDateFr(sterilizationDate)}</div>

<div class="signature-box">
  <div class="label">Cachet + Signature du vétérinaire :</div>
  ${vetSig}
</div>

<div class="footer">${fmtDateTimeFr(generatedAt)}</div>
</body></html>`
}

// =====================================================================
// 3) CERTIFICAT VETERINAIRE AVANT CESSION
// =====================================================================

interface AuscultationFinding { label: string; normal: boolean; observations: string }

export function buildCessionCertificateHtml(args: CertificateBaseArgs & {
  primaryPhoto?: string | null
  findings: AuscultationFinding[]
  weight: number | null
}): string {
  const { animal, findings, weight, generatedAt } = args
  const speciesIsCat = animal.species === 'cat'

  const findingsRows = findings.map((f) => `<tr>
    <td>${f.label}</td>
    <td style="text-align:center;">${f.normal ? '✓' : ''}</td>
    <td>${f.observations || ''}</td>
  </tr>`).join('')

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"/>
<title>Certificat vétérinaire avant cession — ${animal.name}</title>
<style>${commonStyles()}</style>
</head><body>
<h1 style="text-align:center;">Certificat vétérinaire avant cession</h1>
<div class="legal">
  Code rural L. 214-8 et D. 214-32-2<br/>
  (Rappels : identification obligatoire avant cession, à la charge du cédant — article L.212-10 / Interdiction de vendre un chien âgé de moins de 8 semaines — R.215-5-1)
</div>

${buildHeader(args)}

<div style="background:#e5e7eb;padding:5px 10px;font-weight:700;font-size:10pt;border:1px solid #999;border-bottom:0;">Animal</div>
${animalIdentityBlock(animal)}

<table class="table">
  <thead><tr><th></th><th style="width:90px;background:#d4f0d4;text-align:center;">Normal</th><th style="background:#d4f0d4;">Observations</th></tr></thead>
  <tbody>
    ${findingsRows}
    <tr><td><strong>Poids (kg)</strong></td><td style="text-align:center;">${weight !== null ? weight : ''}</td><td></td></tr>
  </tbody>
</table>

<div class="small" style="margin-top:14px;">
  <strong>Attention :</strong> Pour les chiens — Vaccin Lepto non fait<br/>
  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Pour les chats — Vaccin leucose non fait
  ${speciesIsCat ? '' : ''}
</div>

<div style="margin-top:30px;text-align:right;">
  <div>le …………………………………</div>
  <div style="margin-top:4px;">Signature / Cachet</div>
  <div class="signature-box" style="margin-top:8px;height:90px;"></div>
</div>

<div class="footer">${fmtDateTimeFr(generatedAt)}</div>
</body></html>`
}

function labelHealthType(t: string): string {
  const labels: Record<string, string> = {
    vaccination: 'Vaccination', sterilization: 'Stérilisation',
    antiparasitic: 'Antiparasitaire', consultation: 'Consultation',
    surgery: 'Chirurgie', medication: 'Médicament',
    behavioral_assessment: 'Bilan comportemental',
    identification: 'Identification', radio: 'Radio',
    blood_test: 'Prise de sang', cession: 'Cession véto',
  }
  return labels[t] || t
}

export const DEFAULT_AUSCULTATION_LABELS = [
  'Yeux', 'Oreilles', 'Dents', 'Cœur', 'Appareil respiratoire',
  'Appareil digestif', 'Appareil génital et urinaire',
  'Appareil locomoteur', 'Peau / Pelage',
] as const
