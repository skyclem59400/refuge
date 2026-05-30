import type { VetVisitWithLines, VetVisitActKey, VetVisitActs } from '@/lib/types/database'

const ACT_LABELS: Record<VetVisitActKey, string> = {
  puce: 'Identification (puce)',
  cession: 'Cession véto',
  vaccin_chien: 'Vaccin chien',
  vaccin_chat: 'Vaccin chat',
  vaccin_chien_primo: 'Vaccin chien primo (CHPPI + Lepto + toux chenil)',
  vaccin_chien_rappel_mois: 'Vaccin chien rappel mois (CHPPI)',
  vaccin_chien_rappel_annuel: 'Vaccin chien rappel annuel (CHPPI + Lepto + toux chenil)',
  vaccin_chat_primo: 'Vaccin chat primo (RCP)',
  vaccin_chat_rappel_mois: 'Vaccin chat rappel mois (RCP)',
  vaccin_chat_rappel_annuel: 'Vaccin chat rappel annuel (RCP)',
  visite_divers: 'Visite divers',
  importation: 'Importation',
  test_leucose: 'Test leucose / FIV',
  consultation: 'Consultation',
  sterilization: 'Stérilisation',
  antiparasitic: 'Antiparasitaire',
  radio: 'Radio',
}

function escape(s: string | null | undefined): string {
  if (!s) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function fmtEur(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(n))
}

interface BuildArgs {
  visit: VetVisitWithLines
  establishment: {
    name: string
    address?: string | null
    phone?: string | null
  }
  logoBase64?: string
}

export function buildVetVisitRecapHtml({ visit, establishment, logoBase64 }: BuildArgs): string {
  const lines = visit.lines || []

  // Total des actes agrégés (compte global)
  const actCounts = new Map<VetVisitActKey, number>()
  let totalCost = 0
  for (const line of lines) {
    const acts = (line.acts || {}) as VetVisitActs
    for (const key of Object.keys(acts) as VetVisitActKey[]) {
      if (acts[key]) actCounts.set(key, (actCounts.get(key) || 0) + 1)
    }
    if (line.cost) totalCost += Number(line.cost)
  }

  const actTotalRows = Array.from(actCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => `
      <tr>
        <td>${ACT_LABELS[key]}</td>
        <td class="r">${count}</td>
      </tr>
    `).join('')

  const lineRows = lines.length === 0
    ? `<tr><td colspan="5" class="empty">Aucune ligne validée</td></tr>`
    : lines.map((line) => {
      const animal = line.animal
      const acts = (line.acts || {}) as VetVisitActs
      const actsLabels = (Object.keys(acts) as VetVisitActKey[])
        .filter((k) => acts[k])
        .map((k) => `<span class="act-chip">${ACT_LABELS[k]}</span>`)
        .join('')
      return `
        <tr>
          <td class="animal-cell">
            <div class="animal-name">${escape(animal?.name || '—')}</div>
            ${animal?.medal_number ? `<div class="animal-meta">M. ${escape(animal.medal_number)}</div>` : ''}
            ${animal?.species ? `<div class="animal-meta">${escape(animal.species)}${animal.breed ? ' · ' + escape(animal.breed) : ''}</div>` : ''}
          </td>
          <td class="acts-cell">${actsLabels || '<em>—</em>'}</td>
          <td class="chip-cell">${line.chip_number ? escape(line.chip_number) : '—'}</td>
          <td class="obs-cell">
            ${line.observations ? `<div class="obs">${escape(line.observations)}</div>` : ''}
            ${line.complement ? `<div class="complement">${escape(line.complement)}</div>` : ''}
            ${!line.observations && !line.complement ? '—' : ''}
          </td>
          <td class="cost-cell">${fmtEur(line.cost)}</td>
        </tr>
      `
    }).join('')

  const vetLine = visit.vet_label
    ? `<div class="meta-item"><strong>Vétérinaire :</strong> ${escape(visit.vet_label)}</div>`
    : ''
  const locationLine = visit.location_label
    ? `<div class="meta-item"><strong>Lieu :</strong> ${escape(visit.location_label)}</div>`
    : ''
  const visitNotes = visit.notes
    ? `<div class="visit-notes"><strong>Notes du passage :</strong><br/>${escape(visit.notes)}</div>`
    : ''

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Récap passage vétérinaire — ${fmtDate(visit.visit_date)}</title>
  <style>
    /* Charte SDA officielle : navy #1e3a5f, teal #5ba8a0, orange terracotta #c96b3c */
    @page { size: A4 portrait; margin: 14mm 12mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1f2937; font-size: 10pt; line-height: 1.45; }

    .header {
      display: flex; align-items: center; justify-content: space-between;
      padding-bottom: 12px; border-bottom: 3px solid #1e3a5f; margin-bottom: 18px;
    }
    .header-left { display: flex; align-items: center; gap: 12px; }
    .logo { width: 56px; height: 56px; border-radius: 16px; object-fit: cover; }
    .establishment-name { font-size: 14pt; font-weight: 700; color: #1e3a5f; }
    .establishment-meta { font-size: 9pt; color: #64748b; line-height: 1.35; margin-top: 2px; }
    .doc-title { font-size: 20pt; font-weight: 700; color: #1e3a5f; text-transform: uppercase; letter-spacing: 1px; text-align: right; }
    .doc-sub { font-size: 9pt; color: #64748b; text-align: right; margin-top: 4px; }

    .summary-card {
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      border: 1px solid #e2e8f0; border-left: 4px solid #5ba8a0;
      padding: 14px 18px; border-radius: 10px; margin-bottom: 18px;
    }
    .summary-date { font-size: 13pt; font-weight: 700; color: #1e3a5f; text-transform: capitalize; margin-bottom: 6px; }
    .meta-item { font-size: 10pt; color: #475569; margin-top: 2px; }
    .meta-item strong { color: #1e3a5f; }

    .visit-notes {
      margin-top: 10px; padding: 10px 12px; background: #fffbeb;
      border-left: 3px solid #c96b3c; border-radius: 6px;
      font-size: 9.5pt; color: #92400e;
    }

    h2.section-title {
      font-size: 12pt; font-weight: 700; color: #1e3a5f;
      margin: 22px 0 8px 0;
      padding-bottom: 4px; border-bottom: 2px solid #5ba8a0;
      display: flex; align-items: center; gap: 8px;
    }
    h2.section-title::before { content: '▸'; color: #5ba8a0; }

    table { width: 100%; border-collapse: collapse; }
    table thead { background: #1e3a5f; color: white; }
    table th {
      padding: 8px 9px; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.5px;
      font-weight: 600; text-align: left;
    }
    table th.r, table td.r { text-align: right; }
    table td { padding: 8px 9px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    table tr:nth-child(even) td { background: #f8fafc; }

    .lines-table td.animal-cell { width: 22%; }
    .animal-name { font-weight: 700; color: #1e3a5f; }
    .animal-meta { font-size: 8.5pt; color: #64748b; margin-top: 1px; }
    .acts-cell { width: 28%; }
    .act-chip {
      display: inline-block; margin: 2px 3px 2px 0; padding: 2px 7px;
      background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0;
      border-radius: 999px; font-size: 8pt; font-weight: 600;
    }
    .chip-cell { width: 14%; font-family: 'Courier New', monospace; font-size: 9pt; }
    .obs-cell { width: 24%; font-size: 9pt; }
    .obs { color: #374151; margin-bottom: 4px; }
    .complement { color: #6b7280; font-style: italic; font-size: 8.5pt; }
    .cost-cell { width: 12%; text-align: right; font-weight: 600; color: #1e3a5f; }
    .empty { text-align: center; padding: 24px; color: #9ca3af; font-style: italic; }

    .totals-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 18px;
    }
    .totals-card {
      background: white; border: 1px solid #e2e8f0; border-radius: 10px;
      padding: 12px 14px;
    }
    .totals-card h3 {
      font-size: 9pt; text-transform: uppercase; color: #64748b;
      letter-spacing: 0.5px; margin-bottom: 8px;
    }
    .totals-card.cost { background: linear-gradient(135deg, #1e3a5f 0%, #1e3a5f 100%); color: white; border: none; }
    .totals-card.cost h3 { color: #94a3b8; }
    .totals-value { font-size: 26pt; font-weight: 800; color: #1e3a5f; }
    .totals-card.cost .totals-value { color: white; }
    .totals-sub { font-size: 9pt; color: #64748b; margin-top: 2px; }
    .totals-card.cost .totals-sub { color: #cbd5e1; }

    .acts-table td { padding: 6px 9px; }
    .acts-table th.r, .acts-table td.r { text-align: right; font-weight: 600; }

    .signature-strip {
      height: 6px; margin-top: 24px; border-radius: 3px;
      background: linear-gradient(90deg, #c96b3c 0%, #5ba8a0 50%, #1e3a5f 100%);
    }

    footer {
      margin-top: 14px; padding-top: 10px; border-top: 1px solid #e2e8f0;
      font-size: 8pt; color: #94a3b8; display: flex; justify-content: space-between;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      ${logoBase64 ? `<img class="logo" src="${logoBase64}" alt="${escape(establishment.name)}" />` : ''}
      <div>
        <div class="establishment-name">${escape(establishment.name)}</div>
        ${establishment.address ? `<div class="establishment-meta">${escape(establishment.address)}</div>` : ''}
        ${establishment.phone ? `<div class="establishment-meta">${escape(establishment.phone)}</div>` : ''}
      </div>
    </div>
    <div>
      <div class="doc-title">Récap véto</div>
      <div class="doc-sub">Édité le ${new Date().toLocaleDateString('fr-FR')}</div>
    </div>
  </div>

  <div class="summary-card">
    <div class="summary-date">${fmtDate(visit.visit_date)}</div>
    ${vetLine}
    ${locationLine}
    <div class="meta-item"><strong>Nombre d'animaux pris en charge :</strong> ${lines.length}</div>
    ${visitNotes}
  </div>

  <h2 class="section-title">Détail par animal</h2>
  <table class="lines-table">
    <thead>
      <tr>
        <th>Animal</th>
        <th>Actes réalisés</th>
        <th>N° puce</th>
        <th>Observations</th>
        <th class="r">Coût</th>
      </tr>
    </thead>
    <tbody>${lineRows}</tbody>
  </table>

  <h2 class="section-title">Synthèse des actes</h2>
  <div class="totals-grid">
    <div class="totals-card">
      <h3>Actes effectués (par type)</h3>
      <table class="acts-table">
        <tbody>
          ${actTotalRows || '<tr><td colspan="2" class="empty">Aucun acte</td></tr>'}
        </tbody>
      </table>
      <div class="totals-sub" style="margin-top: 8px;">
        Total : <strong>${Array.from(actCounts.values()).reduce((a, b) => a + b, 0)} acte(s)</strong> sur ${lines.length} animal(aux)
      </div>
    </div>
    <div class="totals-card cost">
      <h3>Coût total</h3>
      <div class="totals-value">${fmtEur(totalCost)}</div>
      <div class="totals-sub">Sur ${lines.length} animal(aux)</div>
    </div>
  </div>

  <div class="signature-strip"></div>

  <footer>
    <span>${escape(establishment.name)} — Récap automatique du passage du ${new Date(visit.visit_date).toLocaleDateString('fr-FR')}</span>
    <span>Édité le ${new Date().toLocaleString('fr-FR')}</span>
  </footer>
</body>
</html>`
}
