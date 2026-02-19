import type { Document, CompanyInfo, LineItem } from '@/lib/types/database'

function getLineItems(doc: Document): LineItem[] {
  if (doc.line_items && doc.line_items.length > 0) {
    return doc.line_items
  }
  // Legacy fallback: construct from old fields
  const items: LineItem[] = []
  if (doc.nb_adultes > 0) {
    items.push({
      description: 'Visite - Adultes',
      quantity: doc.nb_adultes,
      unit_price: doc.prix_adulte,
      total: doc.nb_adultes * doc.prix_adulte,
    })
  }
  if (doc.nb_enfants > 0) {
    items.push({
      description: 'Visite - Enfants',
      quantity: doc.nb_enfants,
      unit_price: doc.prix_enfant,
      total: doc.nb_enfants * doc.prix_enfant,
    })
  }
  return items
}

export function buildPdfHtml(doc: Document, companyInfo?: CompanyInfo, logoBase64?: string): string {
  const company = companyInfo || {
    name: 'Mon Etablissement',
    description: '',
    email: '',
    phone: '',
    website: '',
    iban: '',
    bic: '',
    address: '',
    legal_name: '',
  }

  const docTypeLabel = doc.type === 'facture' ? 'FACTURE' : doc.type === 'avoir' ? 'AVOIR' : 'DEVIS'
  const docTypeColor = doc.type === 'avoir' ? '#ef4444' : '#4f46e5'
  const dateFormatted = new Date(doc.date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const lineItems = getLineItems(doc)

  const itemsHtml = lineItems.map((item, i) => `
    <tr style="background: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
      <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px;">${item.description}</td>
      <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px; text-align: center;">${item.quantity}</td>
      <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px; text-align: right;">${item.unit_price.toFixed(2)} &euro;</td>
      <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px; text-align: right; font-weight: 600;">${item.total.toFixed(2)} &euro;</td>
    </tr>`
  ).join('')

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${docTypeLabel} - ${doc.numero}</title>
  <style>
    @page { size: A4; margin: 20mm 18mm 18mm 18mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      color: #1e293b;
      font-size: 13px;
      line-height: 1.5;
    }

    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-bottom: 14px;
      border-bottom: 3px solid ${docTypeColor};
      margin-bottom: 24px;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .logo {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      object-fit: cover;
    }
    .company-name {
      font-size: 22px;
      font-weight: 700;
      color: #4f46e5;
      letter-spacing: -0.5px;
    }
    .company-desc {
      font-size: 11px;
      color: #64748b;
      margin-top: 2px;
    }
    .doc-badge {
      font-size: 22px;
      font-weight: 700;
      color: ${docTypeColor};
      text-transform: uppercase;
      letter-spacing: 1.5px;
    }

    /* Info grid */
    .info-grid {
      display: flex;
      justify-content: space-between;
      margin-bottom: 28px;
    }
    .info-block h4 {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #94a3b8;
      margin-bottom: 6px;
      font-weight: 700;
    }
    .info-block p {
      font-size: 12px;
      margin: 2px 0;
      color: #334155;
    }
    .info-block .name {
      font-size: 14px;
      font-weight: 600;
      color: #1e293b;
    }

    /* Table */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 4px;
    }
    thead th {
      background: #4f46e5;
      color: white;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      padding: 10px 14px;
      font-weight: 600;
    }
    th:first-child { text-align: left; }
    th:nth-child(2) { text-align: center; }
    th:nth-child(3), th:nth-child(4) { text-align: right; }
    tbody tr:last-child td { border-bottom: 2px solid #e2e8f0; }

    /* Total */
    .total-section {
      display: flex;
      justify-content: flex-end;
      margin-top: 12px;
      margin-bottom: 8px;
    }
    .total-box {
      text-align: right;
      padding: 14px 20px;
      background: #f1f5f9;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      min-width: 220px;
    }
    .total-label {
      font-size: 11px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }
    .total-amount {
      font-size: 24px;
      font-weight: 700;
      color: #4f46e5;
    }
    .legal {
      text-align: right;
      font-size: 10px;
      color: #94a3b8;
      font-style: italic;
      margin-bottom: 20px;
    }

    /* Notes */
    .notes {
      padding: 12px 16px;
      background: #fffbeb;
      border-left: 3px solid #f59e0b;
      border-radius: 4px;
      font-size: 12px;
      color: #92400e;
      margin-bottom: 16px;
    }
    .notes-title {
      font-weight: 600;
      margin-bottom: 4px;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* Payment */
    .payment {
      padding: 12px 16px;
      background: #f0fdf4;
      border-left: 3px solid #10b981;
      border-radius: 4px;
      font-size: 12px;
      margin-bottom: 16px;
    }
    .payment-title {
      font-weight: 600;
      margin-bottom: 4px;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #065f46;
    }
    .payment p { color: #065f46; margin: 1px 0; }

    /* Footer */
    .footer {
      margin-top: auto;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 10px;
      color: #94a3b8;
    }
    .footer p { margin: 2px 0; }
    .footer strong { color: #64748b; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      ${logoBase64 ? `<img src="${logoBase64}" class="logo" alt="Logo" />` : ''}
      <div>
        <div class="company-name">${company.name}</div>
        <div class="company-desc">${company.description}</div>
        ${company.address ? `<div class="company-desc">${company.address}</div>` : ''}
      </div>
    </div>
    <div class="doc-badge">${docTypeLabel}</div>
  </div>

  <div class="info-grid">
    <div class="info-block">
      <h4>Document</h4>
      <p class="name">N&deg; ${doc.numero}</p>
      <p>Date d'&eacute;mission : ${dateFormatted}</p>
    </div>
    <div class="info-block" style="text-align: right;">
      <h4>Client</h4>
      <p class="name">${doc.client_name}</p>
      ${doc.client_address ? `<p>${doc.client_address}</p>` : ''}
      ${doc.client_postal_code || doc.client_city ? `<p>${doc.client_postal_code || ''} ${doc.client_city || ''}</p>` : ''}
      ${doc.client_email ? `<p>${doc.client_email}</p>` : ''}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 50%;">Description</th>
        <th style="width: 12%;">Quantit&eacute;</th>
        <th style="width: 19%;">Prix unitaire</th>
        <th style="width: 19%;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <div class="total-section">
    <div class="total-box">
      <div class="total-label">Total TTC</div>
      <div class="total-amount">${doc.total.toFixed(2)} &euro;</div>
    </div>
  </div>
  <div class="legal">TVA non applicable &ndash; Article 293 B du CGI</div>

  ${doc.notes ? `
  <div class="notes">
    <div class="notes-title">Notes et conditions</div>
    <p>${doc.notes.replace(/\n/g, '<br>')}</p>
  </div>` : ''}

  ${doc.type === 'facture' ? `
  <div class="payment">
    <div class="payment-title">Informations de paiement</div>
    <p>IBAN : ${company.iban}</p>
    ${'bic' in company && company.bic ? `<p>BIC : ${company.bic}</p>` : ''}
  </div>` : ''}

  <div class="footer">
    <p><strong>${company.name}</strong> &ndash; ${company.description}</p>
    ${'legal_name' in company && company.legal_name ? `<p>${company.legal_name}</p>` : ''}
    <p>${company.email} | ${company.phone}${company.website ? ` | ${company.website}` : ''}</p>
  </div>
</body>
</html>`
}
