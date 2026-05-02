import type { Animal, AnimalHealthRecord, Establishment } from '@/lib/types/database'

interface Args {
  animal: Animal
  establishment: Pick<Establishment, 'name' | 'siret' | 'address' | 'phone' | 'legal_name' | 'email'>
  healthRecords: AnimalHealthRecord[]
  logoBase64?: string
  generatedAt: Date
}

const TYPE_LABELS: Record<string, string> = {
  vaccination: 'Vaccination', sterilization: 'Stérilisation',
  antiparasitic: 'Antiparasitaire', consultation: 'Consultation',
  surgery: 'Chirurgie', medication: 'Médicament',
  behavioral_assessment: 'Bilan comportemental',
  identification: 'Identification', radio: 'Radio', blood_test: 'Prise de sang', cession: 'Cession véto',
}

function fmt(d: string | null) {
  if (!d) return '—'
  const date = new Date(d)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function eur(n: number | null) {
  if (n === null) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(n))
}

function escape(s: string | null | undefined) {
  return s ? String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : ''
}

export function buildJudicialDossierHtml(args: Args): string {
  const { animal, establishment, healthRecords, logoBase64, generatedAt } = args
  const today = generatedAt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const judicialRecords = healthRecords.filter((r) => r.judicial_procedure)
  const totalCost = judicialRecords.reduce((s, r) => s + (Number(r.cost) || 0), 0)

  const recordRows = judicialRecords.length === 0
    ? `<tr><td colspan="5" style="text-align:center;color:#888;padding:20px;font-style:italic;">Aucun acte vétérinaire enregistré dans le cadre de cette procédure.</td></tr>`
    : judicialRecords.map((r) => `
      <tr>
        <td>${fmt(r.date)}</td>
        <td>${escape(TYPE_LABELS[r.type] || r.type)}</td>
        <td>${escape(r.description)}${r.notes ? `<br/><span style="font-size:8.5pt;color:#666;">${escape(r.notes)}</span>` : ''}</td>
        <td>${escape(r.veterinarian || '—')}${r.invoice_reference ? `<br/><span style="font-size:8.5pt;color:#666;">Facture : ${escape(r.invoice_reference)}</span>` : ''}</td>
        <td style="text-align:right;font-weight:600;">${eur(r.cost)}</td>
      </tr>
    `).join('')

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"/>
<title>Dossier procédure - ${escape(animal.name)}</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#111; font-size:10.5pt; margin:0; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:14px; border-bottom:2px solid #111; margin-bottom:18px; }
  .logo { width:80px; }
  .establishment { font-size:9pt; color:#444; line-height:1.5; text-align:right; }
  h1 { font-size:18pt; margin:0; }
  h2 { font-size:13pt; margin:20px 0 10px 0; padding-bottom:6px; border-bottom:1px solid #ddd; }
  .info-box { padding:12px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; margin-bottom:14px; }
  .info-grid { display:grid; grid-template-columns: 1fr 1fr; gap:6px 16px; font-size:10pt; }
  .info-grid div strong { color:#444; }
  .alert { padding:14px; background:#fef2f2; border:2px solid #fca5a5; border-radius:8px; margin-bottom:18px; }
  .alert-title { font-weight:700; color:#991b1b; margin-bottom:4px; }
  .alert-text { font-size:10pt; color:#7f1d1d; }
  table { width:100%; border-collapse:collapse; }
  th { background:#f3f4f6; text-align:left; padding:8px; font-size:8.5pt; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; border-bottom:1px solid #ddd; }
  td { padding:9px 8px; border-bottom:1px solid #e5e7eb; vertical-align:top; font-size:10pt; }
  .total-row { background:#f9fafb; font-weight:700; }
  .signature-box { margin-top:32px; padding:14px; border:1px solid #999; border-radius:4px; min-height:100px; }
  .footer { position:fixed; bottom:6mm; left:14mm; right:14mm; display:flex; justify-content:space-between; font-size:8pt; color:#9ca3af; border-top:1px solid #e5e7eb; padding-top:6px; }
</style>
</head><body>

<div class="header">
  <div>
    ${logoBase64 ? `<img class="logo" src="${logoBase64}" alt="Logo" />` : `<div style="font-weight:700;font-size:13pt;">${escape(establishment.name)}</div>`}
  </div>
  <div class="establishment">
    <strong>${escape(establishment.legal_name || establishment.name)}</strong><br/>
    ${escape(establishment.address)}<br/>
    ${escape(establishment.phone)}<br/>
    ${escape(establishment.email)}<br/>
    ${establishment.siret ? `SIRET ${escape(establishment.siret)}` : ''}
  </div>
</div>

<h1>Dossier de procédure judiciaire</h1>
<p style="font-size:11pt;color:#666;margin-top:4px;">État des frais engagés pour ${escape(animal.name)}</p>

<div class="alert">
  <div class="alert-title">⚖️ Demande de remboursement des frais engagés</div>
  <div class="alert-text">
    Le présent document constitue le récapitulatif des frais vétérinaires et de prise en charge engagés par
    <strong>${escape(establishment.legal_name || establishment.name)}</strong> dans le cadre de la procédure
    ${animal.judicial_case_number ? `n° <strong>${escape(animal.judicial_case_number)}</strong>` : ''}
    ${animal.judicial_jurisdiction ? `auprès du <strong>${escape(animal.judicial_jurisdiction)}</strong>` : ''}.
  </div>
</div>

<h2>Identité de l'animal</h2>
<div class="info-box">
  <div class="info-grid">
    <div><strong>Nom :</strong> ${escape(animal.name)}</div>
    <div><strong>Espèce :</strong> ${animal.species === 'cat' ? 'Chat' : 'Chien'}</div>
    <div><strong>Race :</strong> ${escape(animal.breed)}${animal.breed_cross ? ` × ${escape(animal.breed_cross)}` : ''}</div>
    <div><strong>Sexe :</strong> ${animal.sex === 'male' ? 'Mâle' : (animal.sex === 'female' ? 'Femelle' : 'Inconnu')}</div>
    <div><strong>Date de naissance :</strong> ${fmt(animal.birth_date)}</div>
    <div><strong>Couleur :</strong> ${escape(animal.color) || '—'}</div>
    <div><strong>N° de puce :</strong> ${escape(animal.chip_number) || '—'}</div>
    <div><strong>N° de médaille :</strong> ${escape(animal.medal_number) || '—'}</div>
    ${animal.identification_date ? `<div><strong>Identifié le :</strong> ${fmt(animal.identification_date)}</div>` : ''}
  </div>
</div>

<h2>Informations procédure</h2>
<div class="info-box">
  <div class="info-grid">
    <div><strong>N° de dossier :</strong> ${escape(animal.judicial_case_number) || '—'}</div>
    <div><strong>Juridiction :</strong> ${escape(animal.judicial_jurisdiction) || '—'}</div>
    <div><strong>Date de saisine :</strong> ${fmt(animal.judicial_seizure_date)}</div>
    <div><strong>Propriétaire mis en cause :</strong> ${escape(animal.judicial_owner_name) || '—'}</div>
    <div style="grid-column:1/-1;"><strong>Destinataire facturation :</strong> ${escape(animal.judicial_billing_recipient) || escape(establishment.legal_name || establishment.name)}</div>
    ${animal.judicial_notes ? `<div style="grid-column:1/-1;margin-top:6px;"><strong>Notes :</strong> ${escape(animal.judicial_notes)}</div>` : ''}
  </div>
</div>

<h2>Frais engagés (actes vétérinaires)</h2>
<table>
  <thead>
    <tr>
      <th style="width:80px;">Date</th>
      <th style="width:120px;">Type d'acte</th>
      <th>Description</th>
      <th style="width:140px;">Vétérinaire / Facture</th>
      <th style="width:80px;text-align:right;">Coût TTC</th>
    </tr>
  </thead>
  <tbody>
    ${recordRows}
    ${judicialRecords.length > 0 ? `
    <tr class="total-row">
      <td colspan="4" style="text-align:right;">TOTAL DES FRAIS ENGAGÉS</td>
      <td style="text-align:right;">${eur(totalCost)}</td>
    </tr>` : ''}
  </tbody>
</table>

<div class="signature-box">
  <div style="font-weight:600;font-size:10pt;margin-bottom:4px;">Fait à _____________________________ le ${today}</div>
  <div style="font-size:9.5pt;color:#666;margin-top:8px;">Signature et cachet du représentant légal :</div>
</div>

<div class="footer">
  <span>Imprimé le ${today}</span>
  <span>${escape(establishment.legal_name || establishment.name)}</span>
</div>
</body></html>`
}
