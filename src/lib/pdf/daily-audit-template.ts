import type { DailyAuditSection } from '@/lib/actions/daily-audit'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatDateFr(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function scoreColor(score: number): string {
  if (score >= 80) return '#10b981'
  if (score >= 60) return '#f59e0b'
  if (score >= 40) return '#f97316'
  return '#ef4444'
}

function scoreEmoji(score: number): string {
  if (score >= 80) return '✅'
  if (score >= 60) return '🟡'
  if (score >= 40) return '🟠'
  return '🔴'
}

function buildCriticalSection(section: DailyAuditSection): string {
  if (section.critical.length === 0) {
    return `<div class="empty-good">✓ Aucune alerte critique aujourd'hui.</div>`
  }
  const items = section.critical
    .map((c) => {
      const color = c.level === 'critical' ? '#dc2626' : '#f59e0b'
      const label = c.level === 'critical' ? '🚨 CRITIQUE' : '⚠️ ATTENTION'
      return `<tr>
        <td style="color:${color};font-weight:700;white-space:nowrap;">${label}</td>
        <td>${escapeHtml(c.category)}</td>
        <td><strong>${escapeHtml(c.label)}</strong>${c.detail ? `<br/><span class="muted">${escapeHtml(c.detail)}</span>` : ''}</td>
      </tr>`
    })
    .join('')
  return `<table class="data critical-table"><tbody>${items}</tbody></table>`
}

function buildEngagementSection(section: DailyAuditSection): string {
  const contributors = section.topContributors.length > 0
    ? section.topContributors
        .map((c) => `<tr><td>${escapeHtml(c.name)}</td><td class="num">${c.actions}</td></tr>`)
        .join('')
    : '<tr><td colspan="2" class="muted">Aucune action enregistrée hier.</td></tr>'

  const inactive = section.inactiveMembers.length > 0
    ? section.inactiveMembers.map((m) => `<li>${escapeHtml(m.name)}</li>`).join('')
    : '<li class="muted">Tout le monde actif ✓</li>'

  return `
    <div class="two-col">
      <div>
        <h3>Top 5 contributeurs (hier)</h3>
        <table class="data">
          <thead><tr><th>Membre</th><th class="num">Actions</th></tr></thead>
          <tbody>${contributors}</tbody>
        </table>
        <p class="muted-small">Total actions tracées hier : <strong>${section.totalActionsYesterday}</strong></p>
      </div>
      <div>
        <h3>Salariés sans aucune action</h3>
        <ul class="bullet">${inactive}</ul>
      </div>
    </div>
  `
}

function buildHealthSection(section: DailyAuditSection): string {
  const saved = section.healthSaved.length > 0
    ? section.healthSaved
        .map((h) => `<tr>
          <td>${escapeHtml(h.animalName)}</td>
          <td>${escapeHtml(h.type)}</td>
          <td>${escapeHtml(h.description)}</td>
          <td>${h.cost != null ? h.cost.toFixed(2) + ' €' : '—'}</td>
        </tr>`)
        .join('')
    : '<tr><td colspan="4" class="muted">Aucun acte de santé saisi hier.</td></tr>'

  const overdue = section.overdueReminders.length > 0
    ? section.overdueReminders.slice(0, 12)
        .map((r) => `<tr>
          <td>${escapeHtml(r.animalName)}</td>
          <td>${escapeHtml(r.type)}</td>
          <td>${escapeHtml(r.dueDate)}</td>
          <td class="num danger">+${r.daysLate}j</td>
        </tr>`)
        .join('')
    : '<tr><td colspan="4" class="muted">Aucun rappel en retard ✓</td></tr>'

  return `
    <h3>Soins saisis hier</h3>
    <table class="data">
      <thead><tr><th>Animal</th><th>Type</th><th>Description</th><th>Coût</th></tr></thead>
      <tbody>${saved}</tbody>
    </table>

    <h3>Rappels en retard (animaux encore en charge)</h3>
    <table class="data">
      <thead><tr><th>Animal</th><th>Type</th><th>Échéance</th><th>Retard</th></tr></thead>
      <tbody>${overdue}</tbody>
    </table>
  `
}

function buildOutingsSection(section: DailyAuditSection): string {
  const saved = section.outingsSaved.length > 0
    ? section.outingsSaved
        .map((o) => `<tr>
          <td>${escapeHtml(o.animalName)}</td>
          <td>${escapeHtml(o.walkedBy)}</td>
          <td>${o.durationMinutes != null ? o.durationMinutes + ' min' : '—'}</td>
          <td>${o.rating != null ? '★ ' + o.rating + '/5' : '—'}</td>
        </tr>`)
        .join('')
    : '<tr><td colspan="4" class="muted">Aucune sortie enregistrée hier.</td></tr>'

  const noRating = section.outingsWithoutRating.length > 0
    ? section.outingsWithoutRating.slice(0, 10)
        .map((o) => `<tr>
          <td>${escapeHtml(o.animalName)}</td>
          <td>${escapeHtml(o.walkedBy)}</td>
          <td>${o.durationMinutes != null ? o.durationMinutes + ' min' : '—'}</td>
        </tr>`)
        .join('')
    : '<tr><td colspan="3" class="muted">Toutes les sorties ont un retour ✓</td></tr>'

  return `
    <h3>Sorties saisies hier</h3>
    <table class="data">
      <thead><tr><th>Animal</th><th>Sortie par</th><th>Durée</th><th>Évaluation</th></tr></thead>
      <tbody>${saved}</tbody>
    </table>

    <h3>Sorties terminées (7j) sans évaluation</h3>
    <table class="data">
      <thead><tr><th>Animal</th><th>Sortie par</th><th>Durée</th></tr></thead>
      <tbody>${noRating}</tbody>
    </table>
  `
}

function buildCraSection(section: DailyAuditSection): string {
  if (section.craGaps.length === 0) {
    return `<h3>CRA mois précédent</h3>
      <div class="empty-good">✓ Tous les CRA du mois précédent ont été envoyés.</div>`
  }
  const rows = section.craGaps
    .map((c) => `<tr>
      <td>${escapeHtml(c.memberName)}</td>
      <td>${escapeHtml(c.monthLabel)}</td>
      <td class="warn">${escapeHtml(c.status)}</td>
    </tr>`)
    .join('')
  return `
    <h3>CRA mois précédent — non envoyé</h3>
    <table class="data">
      <thead><tr><th>Collaborateur</th><th>Période</th><th>Statut</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `
}

function buildAnimalsSection(section: DailyAuditSection): string {
  if (section.animalsToReview.length === 0) {
    return `<h3>Dossiers animaux à compléter</h3>
      <div class="empty-good">✓ Toutes les fiches sont complètes.</div>`
  }
  const rows = section.animalsToReview
    .map((a) => `<tr>
      <td>${escapeHtml(a.animalName)}</td>
      <td>${escapeHtml(a.status)}</td>
      <td class="warn">${escapeHtml(a.missing.join(', '))}</td>
    </tr>`)
    .join('')
  return `
    <h3>Top fiches animaux à compléter</h3>
    <table class="data">
      <thead><tr><th>Animal</th><th>Statut</th><th>Manquant</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `
}

function buildJudicialSection(section: DailyAuditSection): string {
  if (section.judicialIncomplete.length === 0) {
    return `<h3>Procédures judiciaires</h3>
      <div class="empty-good">✓ Tous les dossiers judiciaires en cours sont complets.</div>`
  }
  const rows = section.judicialIncomplete
    .map((j) => {
      const hearing = j.hearingDate
        ? `${j.hearingDate}${j.daysToHearing !== null && j.daysToHearing <= 7 ? ` <span class="danger">(${j.daysToHearing}j)</span>` : ''}`
        : '<span class="muted">—</span>'
      return `<tr>
        <td>${escapeHtml(j.animalName)}</td>
        <td>${hearing}</td>
        <td class="warn">${escapeHtml(j.missing.join(', ') || '—')}</td>
      </tr>`
    })
    .join('')
  return `
    <h3>Procédures judiciaires — dossiers à compléter</h3>
    <table class="data">
      <thead><tr><th>Animal</th><th>Audience</th><th>Manquant</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `
}

function buildEstablishmentReport(section: DailyAuditSection): string {
  return `
    <section class="estab">
      <div class="estab-header">
        <h2>${escapeHtml(section.establishmentName)}</h2>
        <div class="score" style="border-color:${scoreColor(section.scoreOutOf100)};color:${scoreColor(section.scoreOutOf100)};">
          ${scoreEmoji(section.scoreOutOf100)} ${section.scoreOutOf100}/100
        </div>
      </div>

      <h3>${section.critical.length > 0 ? '🚨 À traiter en priorité' : '✓ Pas d\'alerte critique'}</h3>
      ${buildCriticalSection(section)}

      ${buildEngagementSection(section)}

      ${buildHealthSection(section)}

      ${buildOutingsSection(section)}

      ${buildCraSection(section)}

      ${buildAnimalsSection(section)}

      ${buildJudicialSection(section)}
    </section>
  `
}

function renderMarkdown(text: string): string {
  // Minimaliste : titres ##, listes -, gras **, italique *
  return text
    .split('\n')
    .map((line) => {
      const trimmed = line.trimEnd()
      if (trimmed.startsWith('## ')) return `<h3 class="ai-h">${escapeHtml(trimmed.slice(3))}</h3>`
      if (trimmed.startsWith('# ')) return `<h2 class="ai-h">${escapeHtml(trimmed.slice(2))}</h2>`
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        return `<li>${formatInline(trimmed.slice(2))}</li>`
      }
      if (trimmed === '') return ''
      return `<p>${formatInline(trimmed)}</p>`
    })
    .join('\n')
    .replace(/(<li>.+?<\/li>\s*)+/g, (m) => `<ul class="ai-list">${m}</ul>`)
}

function formatInline(text: string): string {
  // Gras **...** puis italique *...* (ordre important)
  let out = escapeHtml(text)
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  return out
}

function buildAiSection(aiAnalysis: string | null, aiError: string | null): string {
  if (aiAnalysis && aiAnalysis.trim().length > 0) {
    return `
      <section class="ai-section">
        <div class="ai-header">
          <span class="ai-badge">🤖 Analyse IA</span>
          <span class="ai-model">Claude Haiku 4.5</span>
        </div>
        <div class="ai-content">${renderMarkdown(aiAnalysis)}</div>
      </section>
      <div class="page-break"></div>
    `
  }
  if (aiError) {
    return `
      <section class="ai-section ai-error">
        <div class="ai-header">
          <span class="ai-badge">⚠️ Analyse IA indisponible</span>
        </div>
        <p class="muted">${escapeHtml(aiError)}</p>
      </section>
    `
  }
  return ''
}

export function buildDailyAuditHtml(
  sections: DailyAuditSection[],
  aiAnalysis?: string | null,
  aiError?: string | null,
): string {
  const dateLabel = sections[0]?.auditDate
    ? formatDateFr(sections[0].auditDate)
    : '—'

  const aiBlock = buildAiSection(aiAnalysis ?? null, aiError ?? null)
  const reports = sections.map(buildEstablishmentReport).join('<div class="page-break"></div>')

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<title>Audit quotidien — ${dateLabel}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Segoe UI", Roboto, sans-serif;
    color: #1f2937;
    margin: 0;
    padding: 20px;
    font-size: 11px;
    line-height: 1.4;
  }
  header {
    border-bottom: 3px solid #0d9488;
    padding-bottom: 12px;
    margin-bottom: 20px;
  }
  header h1 {
    margin: 0;
    font-size: 22px;
    color: #0f172a;
  }
  header .subtitle {
    color: #64748b;
    font-size: 12px;
    margin-top: 4px;
  }
  .estab {
    margin-bottom: 24px;
  }
  .estab-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: #f1f5f9;
    border-radius: 6px;
    margin-bottom: 12px;
  }
  .estab-header h2 {
    margin: 0;
    font-size: 16px;
    color: #0f172a;
  }
  .score {
    border: 2px solid;
    padding: 4px 12px;
    border-radius: 999px;
    font-weight: 700;
    font-size: 13px;
  }
  h3 {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #475569;
    margin: 18px 0 6px;
    padding-bottom: 4px;
    border-bottom: 1px solid #e2e8f0;
  }
  table.data {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 8px;
  }
  table.data th {
    text-align: left;
    background: #f8fafc;
    padding: 5px 8px;
    font-size: 10px;
    text-transform: uppercase;
    color: #475569;
    border-bottom: 1px solid #cbd5e1;
  }
  table.data td {
    padding: 5px 8px;
    border-bottom: 1px solid #f1f5f9;
    vertical-align: top;
  }
  table.data tr:last-child td {
    border-bottom: none;
  }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .muted { color: #94a3b8; font-style: italic; }
  .muted-small { color: #94a3b8; font-size: 10px; margin: 4px 0 0; }
  .warn { color: #b45309; font-weight: 600; }
  .danger { color: #dc2626; font-weight: 700; }
  .empty-good {
    padding: 8px 12px;
    background: #ecfdf5;
    border-left: 3px solid #10b981;
    color: #065f46;
    font-size: 11px;
    border-radius: 4px;
  }
  .two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  ul.bullet {
    margin: 4px 0;
    padding-left: 18px;
  }
  ul.bullet li {
    margin: 2px 0;
  }
  .critical-table td {
    background: #fef2f2;
    border-bottom: 1px solid #fecaca;
  }
  .page-break {
    page-break-after: always;
  }
  footer {
    margin-top: 24px;
    padding-top: 12px;
    border-top: 1px solid #e2e8f0;
    color: #94a3b8;
    font-size: 9px;
    text-align: center;
  }
  .ai-section {
    background: linear-gradient(135deg, #f0f9ff 0%, #ecfeff 100%);
    border-left: 4px solid #0891b2;
    border-radius: 8px;
    padding: 16px 20px;
    margin-bottom: 24px;
  }
  .ai-section.ai-error {
    background: #fffbeb;
    border-left-color: #f59e0b;
  }
  .ai-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }
  .ai-badge {
    font-size: 13px;
    font-weight: 700;
    color: #0e7490;
  }
  .ai-model {
    font-size: 10px;
    color: #64748b;
    background: rgba(255,255,255,0.6);
    padding: 2px 8px;
    border-radius: 999px;
  }
  .ai-content { font-size: 11px; line-height: 1.5; color: #1f2937; }
  .ai-content p { margin: 6px 0; }
  .ai-content .ai-h { font-size: 12px; color: #0e7490; margin: 12px 0 4px; padding: 0; border: none; text-transform: none; letter-spacing: 0; }
  .ai-content .ai-list { margin: 4px 0 8px; padding-left: 18px; }
  .ai-content li { margin: 2px 0; }
</style>
</head>
<body>
  <header>
    <h1>Audit quotidien Optimus</h1>
    <div class="subtitle">
      Activité du <strong>${dateLabel}</strong> — Généré automatiquement
    </div>
  </header>

  ${aiBlock}

  ${reports}

  <footer>
    Rapport généré automatiquement par Optimus le ${new Date().toLocaleString('fr-FR')}.<br/>
    Confidentiel — Destinataire : direction SDA.
  </footer>
</body>
</html>`
}
