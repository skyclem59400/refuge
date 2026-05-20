import {
  SDA_NAVY,
  SDA_TEAL,
  SDA_ORANGE,
  SDA_NAVY_LIGHT,
  SDA_MUTED,
  SDA_BORDER,
  SDA_SURFACE_NEUTRAL,
  SDA_FONT_FAMILY,
  SDA_FOOTER_ACCENT_GRADIENT,
} from './sda-brand'

export interface MedicalCostRecap {
  establishment: {
    name: string
    legal_name: string | null
    address: string | null
    siret: string | null
    iban: string | null
    bic: string | null
  }
  animal: {
    name: string
    species: string
    breed: string | null
    identification: string | null
    chip_number: string | null
  }
  judicial: {
    case_number: string | null
    jurisdiction: string | null
    seizure_date: string | null // YYYY-MM-DD
    owner_name: string | null
    billing_recipient: string | null
    pickup_location: string | null
  }
  records: Array<{
    date: string
    type: string // already French label
    description: string
    veterinarian: string | null
    cost: number
    invoice_reference: string | null
    has_invoice: boolean
  }>
  totals: {
    total_eur: number
    with_invoice_count: number
    without_invoice_count: number
  }
  generated_at: string // ISO
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtDateLong(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtEur(n: number): string {
  return (
    n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' EUR'
  )
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1).trimEnd() + '…'
}

export function buildMedicalCostRecapHtml(
  data: MedicalCostRecap,
  logoBase64?: string
): string {
  const isJudicial = Boolean(
    data.judicial.case_number ||
      data.judicial.jurisdiction ||
      data.judicial.seizure_date ||
      data.judicial.owner_name
  )

  const logoHtml = logoBase64
    ? `<img src="${logoBase64}" alt="logo" class="logo" />`
    : ''

  const judicialBanner = isJudicial
    ? `<div class="judicial-banner">
        <div class="judicial-banner-title">PROCEDURE JUDICIAIRE</div>
        <div class="judicial-banner-sub">Animal place sous procedure — frais a recouvrer aupres du proprietaire</div>
      </div>`
    : ''

  const animalLine = `<strong>${escapeHtml(data.animal.name)}</strong> — ${escapeHtml(
    data.animal.species
  )}${data.animal.breed ? ` (${escapeHtml(data.animal.breed)})` : ''}`

  const judicialBlock = isJudicial
    ? `
      <div class="info-card">
        <h3>Dossier judiciaire</h3>
        <div class="info-grid">
          <div class="info-row"><span>N° de dossier</span><strong>${escapeHtml(
            data.judicial.case_number ?? '—'
          )}</strong></div>
          <div class="info-row"><span>Juridiction</span><strong>${escapeHtml(
            data.judicial.jurisdiction ?? '—'
          )}</strong></div>
          <div class="info-row"><span>Date de saisie</span><strong>${fmtDate(
            data.judicial.seizure_date
          )}</strong></div>
          <div class="info-row"><span>Proprietaire</span><strong>${escapeHtml(
            data.judicial.owner_name ?? '—'
          )}</strong></div>
          <div class="info-row"><span>Destinataire facturation</span><strong>${escapeHtml(
            data.judicial.billing_recipient ?? '—'
          )}</strong></div>
          ${
            data.judicial.pickup_location
              ? `<div class="info-row"><span>Lieu de recuperation</span><strong>${escapeHtml(
                  data.judicial.pickup_location
                )}</strong></div>`
              : ''
          }
        </div>
      </div>`
    : ''

  const recordsRows =
    data.records.length === 0
      ? `<tr class="empty"><td colspan="6">Aucun acte medical enregistre.</td></tr>`
      : data.records
          .map((r) => {
            return `<tr>
              <td class="nowrap">${fmtDate(r.date)}</td>
              <td>${escapeHtml(r.type)}</td>
              <td>${escapeHtml(truncate(r.description, 60))}</td>
              <td>${escapeHtml(r.veterinarian ?? '—')}</td>
              <td>${
                r.invoice_reference
                  ? escapeHtml(r.invoice_reference)
                  : '<span class="muted">—</span>'
              }${
                r.has_invoice
                  ? '<span class="pill-invoice" title="Justificatif joint">PJ</span>'
                  : ''
              }</td>
              <td class="r nowrap">${fmtEur(r.cost)}</td>
            </tr>`
          })
          .join('')

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<title>Recapitulatif des frais medicaux — ${escapeHtml(data.animal.name)}</title>
<style>
  @page { size: A4 portrait; margin: 18mm 16mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: ${SDA_FONT_FAMILY}; color: ${SDA_NAVY}; font-size: 11px; line-height: 1.5; }

  .header { display: flex; align-items: center; gap: 14px; border-bottom: 2.5px solid ${SDA_NAVY}; padding-bottom: 10px; margin-bottom: 16px; }
  .logo { width: 64px; height: 64px; object-fit: contain; flex-shrink: 0; }
  .establishment-name { font-size: 18px; font-weight: 700; color: ${SDA_NAVY}; letter-spacing: 0.5px; }
  .establishment-name .accent { color: ${SDA_TEAL}; }
  .establishment-meta { font-size: 9.5px; color: ${SDA_MUTED}; margin-top: 2px; }

  .doc-title { font-size: 19px; font-weight: 700; color: ${SDA_NAVY}; letter-spacing: 1px; text-transform: uppercase; text-align: center; margin-bottom: 2px; }
  .doc-sub { text-align: center; font-size: 10.5px; color: ${SDA_TEAL}; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 14px; }

  .judicial-banner { background: #fee2e2; border: 1px solid #fca5a5; border-left: 4px solid #dc2626; border-radius: 4px; padding: 10px 14px; margin-bottom: 16px; }
  .judicial-banner-title { font-size: 13px; font-weight: 800; color: #991b1b; letter-spacing: 2px; }
  .judicial-banner-sub { font-size: 10px; color: #991b1b; margin-top: 2px; }

  .info-grid-wrap { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
  .info-card { background: ${SDA_SURFACE_NEUTRAL}; border: 1px solid ${SDA_BORDER}; border-radius: 4px; padding: 10px 12px; }
  .info-card h3 { font-size: 9.5px; text-transform: uppercase; letter-spacing: 1.2px; color: ${SDA_ORANGE}; margin-bottom: 6px; font-weight: 700; }
  .info-grid { display: flex; flex-direction: column; gap: 4px; }
  .info-row { display: flex; justify-content: space-between; gap: 8px; font-size: 10.5px; }
  .info-row span { color: ${SDA_MUTED}; }
  .info-row strong { color: ${SDA_NAVY}; font-weight: 600; text-align: right; }

  table.records { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  table.records thead th { background: ${SDA_NAVY}; color: #fff; text-transform: uppercase; font-size: 9px; letter-spacing: 0.8px; padding: 7px 8px; text-align: left; font-weight: 700; }
  table.records thead th.r { text-align: right; }
  table.records tbody td { padding: 6px 8px; border-bottom: 1px solid ${SDA_BORDER}; font-size: 10.5px; vertical-align: top; }
  table.records tbody tr:nth-child(even) td { background: ${SDA_SURFACE_NEUTRAL}; }
  table.records td.r { text-align: right; font-weight: 600; }
  table.records td.nowrap { white-space: nowrap; }
  table.records .empty td { text-align: center; color: ${SDA_MUTED}; padding: 14px 8px; font-style: italic; }
  .pill-invoice { display: inline-block; margin-left: 6px; padding: 1px 5px; background: ${SDA_TEAL}; color: #fff; font-size: 8px; font-weight: 700; border-radius: 3px; letter-spacing: 0.5px; }
  .muted { color: ${SDA_MUTED}; }

  .totals { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: #fdf4ee; border: 1px solid ${SDA_ORANGE}; border-radius: 4px; margin-bottom: 16px; }
  .totals-meta { font-size: 10px; color: ${SDA_NAVY_LIGHT}; }
  .totals-meta strong { color: ${SDA_NAVY}; }
  .totals-amount { text-align: right; }
  .totals-amount .label { font-size: 9.5px; text-transform: uppercase; letter-spacing: 1px; color: ${SDA_ORANGE}; font-weight: 700; }
  .totals-amount .value { font-size: 22px; font-weight: 800; color: ${SDA_NAVY}; line-height: 1.1; }

  .note { background: ${SDA_SURFACE_NEUTRAL}; border-left: 3px solid ${SDA_TEAL}; padding: 8px 12px; margin-bottom: 18px; font-size: 10px; color: ${SDA_NAVY_LIGHT}; line-height: 1.5; }

  .signature-section { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 12px; }
  .signature-block .label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: ${SDA_MUTED}; font-weight: 700; }
  .signature-block .place-date { font-size: 9.5px; color: ${SDA_MUTED}; margin: 3px 0; }
  .signature-block .line { border-bottom: 1px solid ${SDA_NAVY_LIGHT}; height: 44px; margin-top: 6px; }
  .signature-block .name { font-size: 9.5px; color: ${SDA_MUTED}; margin-top: 3px; font-style: italic; }

  .footer { margin-top: 10px; padding-top: 8px; border-top: 1px solid ${SDA_BORDER}; font-size: 8.5px; color: ${SDA_MUTED}; text-align: center; }
  .footer-accent { height: 3px; background: ${SDA_FOOTER_ACCENT_GRADIENT}; margin-top: 4px; border-radius: 2px; }
</style>
</head>
<body>
  <div class="header">
    ${logoHtml}
    <div>
      <div class="establishment-name"><span class="accent">${escapeHtml(
        data.establishment.name.split(' ')[0] || data.establishment.name
      )}</span> ${escapeHtml(
    data.establishment.name.split(' ').slice(1).join(' ')
  )}</div>
      ${
        data.establishment.legal_name
          ? `<div class="establishment-meta">${escapeHtml(data.establishment.legal_name)}</div>`
          : ''
      }
      ${
        data.establishment.address
          ? `<div class="establishment-meta">${escapeHtml(data.establishment.address)}</div>`
          : ''
      }
      ${
        data.establishment.siret
          ? `<div class="establishment-meta">SIRET : ${escapeHtml(data.establishment.siret)}</div>`
          : ''
      }
    </div>
  </div>

  <div class="doc-title">Recapitulatif des frais medicaux</div>
  <div class="doc-sub">Edition du ${fmtDateLong(data.generated_at)}</div>

  ${judicialBanner}

  <div class="info-grid-wrap">
    <div class="info-card">
      <h3>Animal concerne</h3>
      <div class="info-grid">
        <div class="info-row"><span>Identite</span><strong>${animalLine}</strong></div>
        ${
          data.animal.identification
            ? `<div class="info-row"><span>Identification</span><strong>${escapeHtml(
                data.animal.identification
              )}</strong></div>`
            : ''
        }
        ${
          data.animal.chip_number
            ? `<div class="info-row"><span>Puce</span><strong>${escapeHtml(
                data.animal.chip_number
              )}</strong></div>`
            : ''
        }
      </div>
    </div>
    ${
      judicialBlock ||
      `<div class="info-card">
        <h3>Refuge</h3>
        <div class="info-grid">
          <div class="info-row"><span>Nom</span><strong>${escapeHtml(
            data.establishment.name
          )}</strong></div>
          ${
            data.establishment.iban
              ? `<div class="info-row"><span>IBAN</span><strong>${escapeHtml(
                  data.establishment.iban
                )}</strong></div>`
              : ''
          }
          ${
            data.establishment.bic
              ? `<div class="info-row"><span>BIC</span><strong>${escapeHtml(
                  data.establishment.bic
                )}</strong></div>`
              : ''
          }
        </div>
      </div>`
    }
  </div>

  <table class="records">
    <thead>
      <tr>
        <th style="width:11%;">Date</th>
        <th style="width:16%;">Type</th>
        <th style="width:30%;">Description</th>
        <th style="width:17%;">Veterinaire</th>
        <th style="width:14%;">Ref. facture</th>
        <th class="r" style="width:12%;">Cout HT</th>
      </tr>
    </thead>
    <tbody>
      ${recordsRows}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-meta">
      <div><strong>${data.records.length}</strong> acte${data.records.length > 1 ? 's' : ''} enregistre${
    data.records.length > 1 ? 's' : ''
  }</div>
      <div><strong>${data.totals.with_invoice_count}</strong> avec justificatif joint &middot; <strong>${
    data.totals.without_invoice_count
  }</strong> sans justificatif</div>
    </div>
    <div class="totals-amount">
      <div class="label">Total des frais engages</div>
      <div class="value">${fmtEur(data.totals.total_eur)}</div>
    </div>
  </div>

  <div class="note">
    Document a remettre au tribunal pour recouvrement des frais engages par le refuge dans le cadre de la procedure judiciaire.
    Les justificatifs (factures veterinaires) sont annexes au present recapitulatif.
  </div>

  <div class="signature-section">
    <div class="signature-block">
      <div class="label">Document etabli par</div>
      <div class="place-date">Fait le ${fmtDateLong(data.generated_at)}</div>
      <div class="line"></div>
      <div class="name">Nom et signature du representant du refuge</div>
    </div>
    <div class="signature-block">
      <div class="label">Cachet du refuge</div>
      <div class="place-date">&nbsp;</div>
      <div class="line"></div>
      <div class="name">${escapeHtml(data.establishment.name)}</div>
    </div>
  </div>

  <div class="footer">
    ${escapeHtml(data.establishment.name)} — Recapitulatif des frais medicaux genere automatiquement
  </div>
  <div class="footer-accent"></div>
</body>
</html>`
}
