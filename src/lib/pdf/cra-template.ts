import type { DayStatus, MonthlyCra } from '@/lib/actions/cra'

const MONTH_FR = [
  'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre',
]

function memberName(cra: MonthlyCra): string {
  return cra.member.full_name || cra.member.pseudo || 'Collaborateur'
}

function dayCellHtml(d: DayStatus): string {
  const dayNum = parseInt(d.date.slice(-2), 10)
  const isWE = d.weekday === 0 || d.weekday === 6
  const dim = isWE ? 'opacity:0.55;' : ''

  if (d.kind === 'worked') {
    return `<td class="cell worked" style="${dim}">
      <div class="num">${dayNum}</div>
      <div class="label">${d.hours_worked.toFixed(1)} h</div>
    </td>`
  }
  if (d.kind === 'weekend') {
    return `<td class="cell off" style="${dim}">
      <div class="num">${dayNum}</div>
      <div class="label">WE</div>
    </td>`
  }
  if (d.kind === 'holiday') {
    return `<td class="cell holiday">
      <div class="num">${dayNum}</div>
      <div class="label">Ferie</div>
    </td>`
  }
  if (d.kind === 'absent_full') {
    return `<td class="cell absent" title="${d.leave_type_label}">
      <div class="num">${dayNum}</div>
      <div class="label">${d.leave_type_label.slice(0, 12)}${d.leave_status === 'pending' ? ' *' : ''}</div>
    </td>`
  }
  if (d.kind === 'absent_half') {
    return `<td class="cell half" title="${d.leave_type_label}">
      <div class="num">${dayNum}</div>
      <div class="label">1/2 ${d.leave_type_label.slice(0, 8)}</div>
    </td>`
  }
  if (d.kind === 'absent_hours') {
    return `<td class="cell hourly" title="${d.leave_type_label}">
      <div class="num">${dayNum}</div>
      <div class="label">${d.start_time}-${d.end_time}</div>
      <div class="sub">${d.hours.toFixed(1)} h ${d.leave_type_label.slice(0, 8)}</div>
    </td>`
  }
  // Unreachable: tous les kind sont gérés au-dessus. Fallback de sécurité.
  return `<td class="cell empty"><div class="num">${dayNum}</div></td>`
}

function buildCalendarTable(cra: MonthlyCra): string {
  const firstDay = new Date(cra.year, cra.month - 1, 1)
  const leadingEmpty = (firstDay.getDay() + 6) % 7

  const cells: string[] = []
  for (let i = 0; i < leadingEmpty; i++) cells.push('<td class="cell empty"></td>')
  for (const d of cra.days) cells.push(dayCellHtml(d))
  while (cells.length % 7 !== 0) cells.push('<td class="cell empty"></td>')

  const rows: string[] = []
  for (let i = 0; i < cells.length; i += 7) {
    rows.push('<tr>' + cells.slice(i, i + 7).join('') + '</tr>')
  }

  return `
  <table class="calendar">
    <thead>
      <tr>
        <th>Lundi</th><th>Mardi</th><th>Mercredi</th><th>Jeudi</th>
        <th>Vendredi</th><th>Samedi</th><th>Dimanche</th>
      </tr>
    </thead>
    <tbody>${rows.join('')}</tbody>
  </table>`
}

function buildSummary(cra: MonthlyCra): string {
  const rows = cra.summary.by_type
    .map(
      (b) => `
      <tr>
        <td><span class="dot" style="background:${b.color}"></span>${b.leave_type_label}</td>
        <td class="r">${b.days.toFixed(1).replace('.0', '')}</td>
        <td class="r">${b.hours.toFixed(1).replace('.0', '')} h</td>
      </tr>`
    )
    .join('')

  return `
  <div class="summary-grid">
    <div class="kpi">
      <div class="kpi-label">Jours travailles</div>
      <div class="kpi-value">${cra.summary.worked_days}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Heures travaillees</div>
      <div class="kpi-value">${cra.summary.worked_hours} h</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Jours absents (complets)</div>
      <div class="kpi-value">${cra.summary.absence_days_full}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Demi-journees</div>
      <div class="kpi-value">${cra.summary.absence_days_half}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Heures absent</div>
      <div class="kpi-value">${cra.summary.absence_hours} h</div>
    </div>
  </div>

  ${
    rows
      ? `<h3 class="section-title">Ventilation par type d'absence</h3>
         <table class="breakdown">
           <thead><tr><th>Type</th><th class="r">Jours</th><th class="r">Heures</th></tr></thead>
           <tbody>${rows}</tbody>
         </table>`
      : ''
  }`
}

export function buildCraHtml(cra: MonthlyCra, logoBase64?: string): string {
  const monthLabel = `${MONTH_FR[cra.month - 1]} ${cra.year}`
  const generatedAt = new Date(cra.generated_at).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  const logo = logoBase64
    ? `<img class="logo" src="${logoBase64}" alt="logo" />`
    : ''
  const contractLabel: Record<string, string> = {
    salarie: 'Salarie',
    auto_entrepreneur: 'Auto-entrepreneur',
    benevole: 'Benevole',
    autre: 'Autre',
  }

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>CRA ${memberName(cra)} - ${monthLabel}</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; font-size: 11px; line-height: 1.4; }

    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #4f46e5; padding-bottom: 10px; margin-bottom: 14px; }
    .header-left { display: flex; gap: 12px; align-items: center; }
    .logo { width: 48px; height: 48px; border-radius: 50%; object-fit: cover; }
    .establishment-name { font-size: 15px; font-weight: 700; color: #4f46e5; }
    .doc-title { font-size: 20px; font-weight: 700; color: #4f46e5; letter-spacing: 1px; text-transform: uppercase; }
    .doc-sub { font-size: 11px; color: #64748b; text-align: right; }

    .identity { display: flex; gap: 24px; margin-bottom: 14px; padding: 10px 12px; background: #f1f5f9; border-radius: 6px; }
    .identity-block .label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; font-weight: 700; }
    .identity-block .value { font-size: 13px; font-weight: 600; color: #1e293b; margin-top: 2px; }

    table.calendar { width: 100%; border-collapse: separate; border-spacing: 3px; table-layout: fixed; }
    table.calendar th { background: #475569; color: white; padding: 5px; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; border-radius: 4px; }
    table.calendar td.cell { height: 64px; padding: 4px 5px; border-radius: 6px; vertical-align: top; }
    .cell .num { font-size: 11px; font-weight: 700; color: #0f172a; }
    .cell .label { font-size: 9px; margin-top: 3px; color: #475569; line-height: 1.2; }
    .cell .sub { font-size: 8px; color: #64748b; margin-top: 1px; }
    .cell.worked { background: #ecfdf5; border: 1px solid #d1fae5; }
    .cell.off { background: #f8fafc; border: 1px solid #e2e8f0; color: #94a3b8; }
    .cell.holiday { background: #fef3c7; border: 1px solid #fde68a; }
    .cell.holiday .label { color: #92400e; }
    .cell.absent { background: #fee2e2; border: 1px solid #fecaca; }
    .cell.absent .label { color: #991b1b; font-weight: 600; }
    .cell.half { background: #fef9c3; border: 1px solid #fde68a; }
    .cell.half .label { color: #854d0e; font-weight: 600; }
    .cell.hourly { background: #ede9fe; border: 1px solid #ddd6fe; }
    .cell.hourly .label { color: #5b21b6; font-weight: 600; }
    .cell.empty { background: transparent; }

    .summary-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-top: 14px; }
    .kpi { padding: 8px 10px; background: white; border: 1px solid #e2e8f0; border-radius: 6px; }
    .kpi-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 600; }
    .kpi-value { font-size: 16px; font-weight: 700; color: #4f46e5; margin-top: 2px; }

    .section-title { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #475569; margin-top: 14px; margin-bottom: 6px; font-weight: 700; }
    table.breakdown { width: 100%; border-collapse: collapse; }
    table.breakdown th { background: #f1f5f9; padding: 6px 10px; text-align: left; font-size: 10px; color: #475569; text-transform: uppercase; letter-spacing: 0.3px; }
    table.breakdown td { padding: 5px 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px; }
    table.breakdown td.r { text-align: right; font-weight: 600; }
    .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }

    .legend { display: flex; gap: 12px; margin-top: 10px; flex-wrap: wrap; font-size: 9px; color: #475569; }
    .legend span { display: inline-flex; align-items: center; gap: 4px; }
    .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; }

    .signature { display: flex; gap: 30px; margin-top: 20px; }
    .signature-block { flex: 1; }
    .signature-block .label { font-size: 9px; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.5px; }
    .signature-block .line { border-bottom: 1px solid #94a3b8; height: 40px; margin-top: 4px; }

    .footer { margin-top: 18px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 9px; color: #94a3b8; text-align: center; }

    .note { font-size: 9px; color: #94a3b8; font-style: italic; margin-top: 4px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      ${logo}
      <div class="establishment-name">${cra.establishment.name}</div>
    </div>
    <div>
      <div class="doc-title">CRA - ${monthLabel}</div>
      <div class="doc-sub">Compte-rendu d'activite mensuel</div>
    </div>
  </div>

  <div class="identity">
    <div class="identity-block">
      <div class="label">Collaborateur</div>
      <div class="value">${memberName(cra)}</div>
    </div>
    <div class="identity-block">
      <div class="label">Statut</div>
      <div class="value">${contractLabel[cra.member.contract_type] || cra.member.contract_type}</div>
    </div>
    <div class="identity-block">
      <div class="label">Periode</div>
      <div class="value">${monthLabel}</div>
    </div>
    <div class="identity-block" style="margin-left:auto; text-align:right;">
      <div class="label">Genere le</div>
      <div class="value" style="font-size:11px;">${generatedAt}</div>
    </div>
  </div>

  ${buildCalendarTable(cra)}

  <div class="legend">
    <span><i style="background:#ecfdf5;border:1px solid #d1fae5"></i> Travaille</span>
    <span><i style="background:#f8fafc;border:1px solid #e2e8f0"></i> Weekend</span>
    <span><i style="background:#fef3c7;border:1px solid #fde68a"></i> Ferie</span>
    <span><i style="background:#fee2e2;border:1px solid #fecaca"></i> Conge jour</span>
    <span><i style="background:#fef9c3;border:1px solid #fde68a"></i> Demi-journee</span>
    <span><i style="background:#ede9fe;border:1px solid #ddd6fe"></i> Conge horaire</span>
    <span class="note">* = demande en attente de validation</span>
  </div>

  ${buildSummary(cra)}

  <div class="signature">
    <div class="signature-block">
      <div class="label">Signature collaborateur</div>
      <div class="line"></div>
    </div>
    <div class="signature-block">
      <div class="label">Signature responsable</div>
      <div class="line"></div>
    </div>
  </div>

  <div class="footer">
    ${cra.establishment.name} - Document genere automatiquement le ${generatedAt}
  </div>
</body>
</html>`
}
