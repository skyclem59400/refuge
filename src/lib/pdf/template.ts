import type { Document, CompanyInfo } from '@/lib/types/database'

export function buildPdfHtml(doc: Document, companyInfo?: CompanyInfo): string {
  const company = companyInfo || {
    name: 'La Ferme O 4 Vents',
    description: 'Refuge pour animaux',
    email: 'contact@ferme4vents.fr',
    phone: '01 23 45 67 89',
    website: 'www.ferme4vents.fr',
    iban: 'FR76 XXXX XXXX XXXX XXXX XXXX XXX',
    address: '',
  }

  const docTypeLabel = doc.type === 'facture' ? 'FACTURE' : 'DEVIS'
  const dateFormatted = new Date(doc.date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  // Build line items
  let itemsHtml = ''
  if (doc.nb_adultes > 0) {
    const total = doc.nb_adultes * doc.prix_adulte
    itemsHtml += `
      <tr>
        <td>Visite - Adultes</td>
        <td style="text-align: right;">${doc.nb_adultes}</td>
        <td style="text-align: right;">${doc.prix_adulte.toFixed(2)} &euro;</td>
        <td style="text-align: right;"><strong>${total.toFixed(2)} &euro;</strong></td>
      </tr>`
  }
  if (doc.nb_enfants > 0) {
    const total = doc.nb_enfants * doc.prix_enfant
    itemsHtml += `
      <tr>
        <td>Visite - Enfants</td>
        <td style="text-align: right;">${doc.nb_enfants}</td>
        <td style="text-align: right;">${doc.prix_enfant.toFixed(2)} &euro;</td>
        <td style="text-align: right;"><strong>${total.toFixed(2)} &euro;</strong></td>
      </tr>`
  }

  const now = new Date()
  const generatedDate = now.toLocaleDateString('fr-FR')
  const generatedTime = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${docTypeLabel} - ${doc.numero}</title>
  <style>
    @page { size: A4; margin: 0; }
    @media print { body { margin: 0; padding: 0; } }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      padding: 40px;
      background: white;
      color: #333;
      line-height: 1.6;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px;
      margin: -40px -40px 40px -40px;
      text-align: center;
      border-radius: 0 0 20px 20px;
    }
    .header h1 {
      font-size: 36px;
      margin-bottom: 10px;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
    }
    .header .emoji { font-size: 48px; margin-bottom: 10px; }
    .header .doc-type {
      font-size: 28px;
      font-weight: 600;
      background: rgba(255,255,255,0.2);
      padding: 10px 30px;
      border-radius: 30px;
      display: inline-block;
      margin-top: 10px;
    }
    .info-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-bottom: 40px;
    }
    .info-box {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 12px;
      border-left: 4px solid #667eea;
    }
    .info-box h3 {
      color: #667eea;
      margin-bottom: 15px;
      font-size: 18px;
      border-bottom: 2px solid #667eea;
      padding-bottom: 8px;
    }
    .info-box p { margin: 8px 0; font-size: 14px; }
    .info-box strong { color: #333; font-weight: 600; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 30px 0;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      border-radius: 8px;
      overflow: hidden;
    }
    thead {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    th {
      padding: 18px 15px;
      text-align: left;
      font-weight: 600;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    th:nth-child(2), th:nth-child(3), th:nth-child(4) { text-align: right; }
    td {
      padding: 15px;
      border-bottom: 1px solid #e0e0e0;
      font-size: 14px;
    }
    td:nth-child(2), td:nth-child(3), td:nth-child(4) { text-align: right; }
    tbody tr:last-child td { border-bottom: none; }
    .total-section {
      text-align: right;
      margin-top: 40px;
      padding: 25px;
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      border-radius: 12px;
      border: 2px solid #667eea;
    }
    .total-section .subtotal { font-size: 16px; margin-bottom: 10px; color: #666; }
    .total-section h2 { color: #667eea; font-size: 32px; margin-top: 10px; }
    .notes {
      margin-top: 40px;
      padding: 20px;
      background: #fff3cd;
      border-left: 5px solid #ffc107;
      border-radius: 8px;
    }
    .notes h4 { color: #856404; margin-bottom: 12px; font-size: 16px; }
    .notes p { color: #856404; font-size: 14px; line-height: 1.8; }
    .footer {
      margin-top: 60px;
      text-align: center;
      color: #999;
      font-size: 12px;
      padding-top: 30px;
      border-top: 2px solid #e0e0e0;
    }
    .footer p { margin: 5px 0; }
    .footer .contact { margin-top: 15px; color: #667eea; font-weight: 600; }
    .badge {
      display: inline-block;
      padding: 6px 15px;
      background: ${doc.type === 'facture' ? '#28a745' : '#ffc107'};
      color: white;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="emoji">🏡</div>
    <h1>${company.name}</h1>
    <p style="font-size: 16px; opacity: 0.9;">${company.description}</p>
    <div class="doc-type">${docTypeLabel}</div>
  </div>

  <div class="info-section">
    <div class="info-box">
      <h3>📄 Informations du document</h3>
      <p><strong>Numero:</strong> ${doc.numero}</p>
      <p><strong>Date d'emission:</strong> ${dateFormatted}</p>
      <p><span class="badge">${doc.type === 'facture' ? 'Facture' : 'Devis'}</span></p>
    </div>
    <div class="info-box">
      <h3>👤 Informations client</h3>
      <p><strong>${doc.client_name}</strong></p>
      ${doc.client_email ? `<p>📧 ${doc.client_email}</p>` : ''}
      ${doc.client_address ? `<p>📍 ${doc.client_address}<br>${doc.client_postal_code || ''} ${doc.client_city || ''}</p>` : ''}
    </div>
  </div>

  <h3 style="color: #667eea; margin-bottom: 15px; font-size: 20px;">📋 Detail des prestations</h3>

  <table>
    <thead>
      <tr>
        <th style="width: 50%;">Description</th>
        <th style="width: 15%;">Quantite</th>
        <th style="width: 17.5%;">Prix unitaire</th>
        <th style="width: 17.5%;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <div class="total-section">
    <div class="subtotal" style="color: #28a745;">
      <strong>TVA non applicable</strong> - Article 293 B du CGI
    </div>
    <h2>TOTAL TTC: ${doc.total.toFixed(2)} &euro;</h2>
  </div>

  ${doc.notes ? `
  <div class="notes">
    <h4>📝 Notes et conditions</h4>
    <p>${doc.notes.replace(/\n/g, '<br>')}</p>
  </div>` : ''}

  <div class="footer">
    <p><strong>${company.name}</strong></p>
    <p>${company.description}</p>
    <p class="contact">
      📧 ${company.email} | 📞 ${company.phone} | 🌐 ${company.website}
    </p>
    <p style="margin-top: 15px; font-size: 10px;">
      Document genere automatiquement le ${generatedDate} a ${generatedTime}
    </p>
  </div>
</body>
</html>`
}
