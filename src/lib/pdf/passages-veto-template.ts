import type { PassageVeto } from '@/lib/actions/passages-veto'

interface Args {
  passages: PassageVeto[]
  stats: { count: number; totalCost: number }
  filters: { startDate?: string; endDate?: string; clinicName?: string; vetName?: string; typeLabel?: string; judicialOnly?: boolean }
  establishmentName: string
  establishmentAddress: string
  establishmentPhone: string
  logoBase64?: string
  generatedAt: Date
}

const TYPE_LABELS: Record<string, string> = {
  vaccination: 'Vaccination', sterilization: 'Stérilisation',
  antiparasitic: 'Antiparasitaire', consultation: 'Consultation',
  surgery: 'Chirurgie', medication: 'Médicament',
  behavioral_assessment: 'Bilan comportemental',
  identification: 'Identification', radio: 'Radio', blood_test: 'Prise de sang',
}

function fmt(d: string | null | undefined) {
  if (!d) return ''
  const date = new Date(d)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('fr-FR')
}

function eur(n: number | null) {
  if (n === null) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(n))
}

export function buildPassagesVetoHtml(args: Args): string {
  const { passages, stats, filters, establishmentName, establishmentAddress, establishmentPhone, logoBase64, generatedAt } = args
  const today = generatedAt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const filterParts: string[] = []
  if (filters.startDate || filters.endDate) {
    filterParts.push(`Période : ${fmt(filters.startDate) || '—'} au ${fmt(filters.endDate) || '—'}`)
  }
  if (filters.clinicName) filterParts.push(`Cabinet : ${filters.clinicName}`)
  if (filters.vetName) filterParts.push(`Vétérinaire : ${filters.vetName}`)
  if (filters.typeLabel) filterParts.push(`Type : ${filters.typeLabel}`)
  if (filters.judicialOnly) filterParts.push('⚖️ Uniquement procédure')

  const rows = passages.length === 0
    ? `<tr><td colspan="6" style="text-align:center;color:#888;padding:24px;">Aucun passage</td></tr>`
    : passages.map((p) => `
      <tr${p.judicial_procedure ? ' style="background:#fef2f2;"' : ''}>
        <td style="white-space:nowrap;">${fmt(p.date)}</td>
        <td>
          <div style="font-weight:600;">${escape(p.animal_name)}</div>
          ${p.animal_medal ? `<div style="font-size:8.5pt;color:#666;">M. ${escape(p.animal_medal)}</div>` : ''}
          ${p.judicial_procedure ? `<div style="font-size:8pt;color:#dc2626;font-weight:600;">⚖️ EN PROCÉDURE</div>` : ''}
        </td>
        <td>${TYPE_LABELS[p.type] || p.type}</td>
        <td>${escape(p.description || '')}${p.invoice_reference ? `<div style="font-size:8.5pt;color:#666;">Réf : ${escape(p.invoice_reference)}</div>` : ''}</td>
        <td>${vetName(p)}${p.clinic_name ? `<div style="font-size:8.5pt;color:#666;">${escape(p.clinic_name)}</div>` : ''}</td>
        <td style="text-align:right;font-weight:600;">${eur(p.cost)}</td>
      </tr>
    `).join('')

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"/>
<title>Passages vétérinaires</title>
<style>
  @page { size: A4 landscape; margin: 12mm 12mm 14mm 12mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#111; font-size:9.5pt; margin:0; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:10px; border-bottom:2px solid #111; margin-bottom:14px; }
  .logo { width:80px; height:auto; }
  .establishment { font-size:9pt; color:#444; line-height:1.4; text-align:right; }
  h1 { font-size:18pt; margin:0 0 6px 0; }
  .filters { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:10px; }
  .filter-pill { font-size:8.5pt; padding:3px 8px; background:#f3f4f6; border:1px solid #e5e7eb; border-radius:999px; color:#444; }
  .stats { display:flex; gap:16px; margin-bottom:14px; padding:10px 14px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; }
  .stat .lbl { font-size:8pt; text-transform:uppercase; color:#6b7280; }
  .stat .val { font-size:13pt; font-weight:700; }
  table { width:100%; border-collapse:collapse; }
  th { background:#f3f4f6; text-align:left; padding:7px; font-size:8.5pt; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; }
  td { padding:7px; border-top:1px solid #e5e7eb; vertical-align:top; }
  .footer { position:fixed; bottom:5mm; left:12mm; right:12mm; display:flex; justify-content:space-between; font-size:8pt; color:#9ca3af; }
</style></head><body>
<div class="header">
  <div>
    ${logoBase64 ? `<img class="logo" src="${logoBase64}" alt="Logo" />` : `<div style="font-weight:700;font-size:13pt;">${escape(establishmentName)}</div>`}
  </div>
  <div class="establishment">
    <strong>${escape(establishmentName)}</strong><br/>
    ${escape(establishmentAddress)}<br/>
    ${escape(establishmentPhone)}
  </div>
</div>
<h1>Passages vétérinaires</h1>
${filterParts.length > 0 ? `<div class="filters">${filterParts.map((f) => `<span class="filter-pill">${escape(f)}</span>`).join('')}</div>` : ''}
<div class="stats">
  <div class="stat"><div class="lbl">Total passages</div><div class="val">${stats.count}</div></div>
  <div class="stat"><div class="lbl">Coût total</div><div class="val">${eur(stats.totalCost)}</div></div>
</div>
<table>
  <thead><tr><th style="width:80px;">Date</th><th style="width:140px;">Animal</th><th style="width:110px;">Type</th><th>Description</th><th style="width:160px;">Vétérinaire</th><th style="width:80px;text-align:right;">Coût</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="footer">
  <span>Imprimé le ${today}</span>
  <span>${escape(establishmentName)}</span>
</div>
</body></html>`
}

function escape(s: string) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function vetName(p: PassageVeto) {
  if (!p.vet_last_name) return '—'
  return `Dr ${p.vet_first_name ? `${p.vet_first_name} ` : ''}${p.vet_last_name}`
}
