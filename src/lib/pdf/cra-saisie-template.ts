import type { CraMonthlyView } from '@/lib/types/database'

const MONTH_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

function dayCellHtml(day: CraMonthlyView['days'][number]): string {
  const num = parseInt(day.date.slice(-2), 10)
  const isWE = day.weekday === 0 || day.weekday === 6
  const dim = isWE ? 'opacity:0.6;' : ''

  if (day.source === 'holiday') {
    return `<td class="cell holiday" style="${dim}">
      <div class="num">${num}</div>
      <div class="label">${(day.holiday_name || 'Férié').slice(0, 14)}</div>
    </td>`
  }
  if (day.source === 'extended_leave') {
    return `<td class="cell ext-leave" style="${dim}">
      <div class="num">${num}</div>
      <div class="label">Arrêt long</div>
    </td>`
  }
  if (day.source === 'leave') {
    return `<td class="cell leave" style="${dim}">
      <div class="num">${num}</div>
      <div class="label">${(day.leave_label || 'Congé').slice(0, 14)}</div>
    </td>`
  }
  if (day.is_rest_day) {
    return `<td class="cell rest" style="${dim}">
      <div class="num">${num}</div>
      <div class="label">Repos</div>
    </td>`
  }
  const am = day.start_am && day.end_am ? `${day.start_am.slice(0, 5)}-${day.end_am.slice(0, 5)}` : ''
  const pm = day.start_pm && day.end_pm ? `${day.start_pm.slice(0, 5)}-${day.end_pm.slice(0, 5)}` : ''
  const bgClass = day.source === 'override' ? 'override' : 'worked'
  return `<td class="cell ${bgClass}" style="${dim}">
    <div class="num">${num}</div>
    <div class="hours">${day.hours_total}h</div>
    <div class="times">${am}</div>
    <div class="times">${pm}</div>
  </td>`
}

function buildCalendarTable(view: CraMonthlyView): string {
  const first = new Date(view.year, view.month - 1, 1)
  const leadingEmpty = (first.getDay() + 6) % 7

  const cells: string[] = []
  for (let i = 0; i < leadingEmpty; i++) cells.push('<td class="cell empty"></td>')
  for (const d of view.days) cells.push(dayCellHtml(d))
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

export function buildCraSaisieHtml(view: CraMonthlyView, establishmentName: string, logoBase64?: string): string {
  const monthLabel = `${MONTH_FR[view.month - 1]} ${view.year}`
  const logo = logoBase64 ? `<img class="logo" src="${logoBase64}" alt="logo" />` : ''
  const validatedAt = view.validated_at
    ? new Date(view.validated_at).toLocaleDateString('fr-FR')
    : '—'
  const adminValidatedAt = view.admin_validated_at
    ? new Date(view.admin_validated_at).toLocaleDateString('fr-FR')
    : '—'

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>CRA ${view.member_name} - ${monthLabel}</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; font-size: 11px; line-height: 1.4; }

    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #1e3a5f; padding-bottom: 12px; margin-bottom: 16px; }
    .header-left { display: flex; gap: 12px; align-items: center; }
    .logo { width: 52px; height: 52px; border-radius: 16px; object-fit: cover; }
    .establishment-name { font-size: 16px; font-weight: 700; color: #1e3a5f; }
    .doc-title { font-size: 22px; font-weight: 700; color: #1e3a5f; letter-spacing: 1px; text-transform: uppercase; }
    .doc-sub { font-size: 11px; color: #64748b; text-align: right; margin-top: 2px; }

    .identity { display: flex; gap: 28px; margin-bottom: 14px; padding: 12px 14px; background: #f1f5f9; border-radius: 8px; }
    .identity .label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; font-weight: 700; }
    .identity .value { font-size: 13px; font-weight: 600; color: #1e293b; margin-top: 2px; }

    table.calendar { width: 100%; border-collapse: separate; border-spacing: 3px; table-layout: fixed; }
    table.calendar th { background: #1e3a5f; color: white; padding: 6px; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; border-radius: 4px; }
    table.calendar td.cell { height: 68px; padding: 4px 5px; border-radius: 6px; vertical-align: top; border: 1px solid #e2e8f0; }
    .cell .num { font-size: 11px; font-weight: 700; color: #0f172a; }
    .cell .hours { font-size: 14px; font-weight: 800; color: #1e3a5f; margin-top: 2px; }
    .cell .label { font-size: 9px; color: #475569; margin-top: 2px; line-height: 1.2; }
    .cell .times { font-size: 8px; color: #64748b; margin-top: 1px; line-height: 1.2; }
    .cell.empty { background: transparent; border-color: transparent; }
    .cell.rest { background: #f8fafc; }
    .cell.holiday { background: #fef3c7; }
    .cell.leave { background: #ede9fe; }
    .cell.ext-leave { background: #e9d5ff; }
    .cell.worked { background: #ecfdf5; }
    .cell.override { background: #dbeafe; border-color: #93c5fd; }

    .summary { margin-top: 18px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
    .kpi { padding: 10px 12px; background: #f8fafc; border-left: 3px solid #5ba8a0; border-radius: 6px; }
    .kpi.astreinte { border-left-color: #c96b3c; background: #fff7ed; }
    .kpi-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; font-weight: 700; }
    .kpi-value { font-size: 18px; font-weight: 800; color: #1e3a5f; margin-top: 2px; }
    .kpi.astreinte .kpi-value { color: #c96b3c; }
    .astreinte-detail { margin-top: 10px; padding: 10px 12px; background: #fff7ed; border-left: 3px solid #c96b3c; border-radius: 6px; font-size: 10px; color: #92400e; }
    .astreinte-detail strong { color: #c96b3c; }

    .signature { margin-top: 18px; padding: 12px; background: #f8fafc; border-radius: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 10px; }
    .signature .block strong { color: #1e3a5f; }

    footer { margin-top: 12px; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
    .signature-strip { height: 4px; background: linear-gradient(90deg, #c96b3c, #5ba8a0, #1e3a5f); border-radius: 2px; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      ${logo}
      <div>
        <div class="establishment-name">${establishmentName}</div>
        <div style="font-size:10px;color:#64748b;">Compte-rendu d'activité mensuel</div>
      </div>
    </div>
    <div>
      <div class="doc-title">CRA ${monthLabel}</div>
      <div class="doc-sub">Édité le ${new Date().toLocaleDateString('fr-FR')}</div>
    </div>
  </div>

  <div class="identity">
    <div>
      <div class="label">Collaborateur</div>
      <div class="value">${view.member_name}</div>
    </div>
    <div>
      <div class="label">Période</div>
      <div class="value">${monthLabel}</div>
    </div>
    <div>
      <div class="label">Validation collaborateur</div>
      <div class="value">${validatedAt}</div>
    </div>
    <div>
      <div class="label">Validation administrateur</div>
      <div class="value">${adminValidatedAt}</div>
    </div>
  </div>

  ${buildCalendarTable(view)}

  <div class="summary">
    <div class="kpi">
      <div class="kpi-label">Heures travaillées</div>
      <div class="kpi-value">${view.total_worked_hours} h</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Heures de congé</div>
      <div class="kpi-value">${view.total_leave_hours} h</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Jours de repos</div>
      <div class="kpi-value">${view.total_rest_days}</div>
    </div>
    <div class="kpi astreinte">
      <div class="kpi-label">Semaines d'astreinte</div>
      <div class="kpi-value">${view.astreinte_weeks.length}</div>
    </div>
  </div>

  ${view.astreinte_weeks.length > 0 ? `
  <div class="astreinte-detail">
    <strong>Détail des astreintes (forfait hebdomadaire lundi → lundi) :</strong><br/>
    ${view.astreinte_weeks.map((w) => {
      const d = new Date(w + 'T00:00:00Z')
      return `Semaine du <strong>${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}</strong>`
    }).join(' &nbsp;•&nbsp; ')}
  </div>` : ''}

  <div class="signature">
    <div class="block">
      <div class="label" style="font-size:9px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Validation collaborateur</div>
      <p style="margin-top:6px;">
        <strong>${view.member_name}</strong> a validé ce CRA le <strong>${validatedAt}</strong> via son espace collaborateur.
      </p>
    </div>
    <div class="block">
      <div class="label" style="font-size:9px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Validation administrateur</div>
      <p style="margin-top:6px;">
        Validation administrative le <strong>${adminValidatedAt}</strong> par un administrateur de l'association.
      </p>
    </div>
  </div>

  <div class="signature-strip"></div>
  <footer>
    ${establishmentName} — CRA généré le ${new Date().toLocaleString('fr-FR')}
  </footer>
</body>
</html>`
}
