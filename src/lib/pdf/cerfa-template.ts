import type { Donation, CompanyInfo } from '@/lib/types/database'

function amountToWords(amount: number): string {
  const units = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
    'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf']
  const tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt']

  if (amount === 0) return 'zero'

  const euros = Math.floor(amount)
  const cents = Math.round((amount - euros) * 100)

  function convertNumber(n: number): string {
    if (n === 0) return ''
    if (n < 20) return units[n]
    if (n < 100) {
      const t = Math.floor(n / 10)
      const u = n % 10
      if (t === 7 || t === 9) {
        return tens[t] + (u === 1 && t === 7 ? ' et ' : '-') + units[10 + u]
      }
      if (t === 8 && u === 0) return 'quatre-vingts'
      return tens[t] + (u === 1 && t <= 6 ? ' et ' : u > 0 ? '-' : '') + units[u]
    }
    if (n < 1000) {
      const h = Math.floor(n / 100)
      const rest = n % 100
      const prefix = h === 1 ? 'cent' : units[h] + ' cent' + (rest === 0 ? 's' : '')
      return prefix + (rest > 0 ? ' ' + convertNumber(rest) : '')
    }
    if (n < 1000000) {
      const th = Math.floor(n / 1000)
      const rest = n % 1000
      const prefix = th === 1 ? 'mille' : convertNumber(th) + ' mille'
      return prefix + (rest > 0 ? ' ' + convertNumber(rest) : '')
    }
    return n.toString()
  }

  let result = convertNumber(euros) + ' euro' + (euros > 1 ? 's' : '')
  if (cents > 0) {
    result += ' et ' + convertNumber(cents) + ' centime' + (cents > 1 ? 's' : '')
  }
  return result
}

function getPaymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    cheque: 'Ch\u00e8que',
    virement: 'Virement bancaire',
    especes: 'Esp\u00e8ces',
    cb: 'Carte bancaire',
    prelevement: 'Pr\u00e9l\u00e8vement',
    autre: 'Autre',
  }
  return labels[method] || method
}

function getNatureLabel(nature: string): string {
  return nature === 'numeraire' ? 'Num\u00e9raire' : 'Nature (don en nature)'
}

export function buildCerfaHtml(donation: Donation, companyInfo?: CompanyInfo, logoBase64?: string): string {
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

  const dateFormatted = new Date(donation.date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const generatedDate = donation.cerfa_generated_at
    ? new Date(donation.cerfa_generated_at).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : new Date().toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })

  const amountWords = amountToWords(Number(donation.amount))

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Re&ccedil;u fiscal - ${donation.cerfa_number || 'CERFA'}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      color: #1e293b;
      font-size: 12px;
      line-height: 1.5;
    }

    .page {
      border: 2px solid #1e40af;
      padding: 28px;
      min-height: calc(297mm - 30mm);
      display: flex;
      flex-direction: column;
    }

    /* Header */
    .header {
      text-align: center;
      border-bottom: 2px solid #1e40af;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .header-title {
      font-size: 18px;
      font-weight: 700;
      color: #1e40af;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 4px;
    }
    .header-subtitle {
      font-size: 11px;
      color: #64748b;
    }
    .header-ref {
      font-size: 10px;
      color: #94a3b8;
      margin-top: 4px;
    }
    .cerfa-number {
      font-size: 14px;
      font-weight: 700;
      color: #1e40af;
      margin-top: 6px;
    }

    /* Sections */
    .section {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 16px;
      margin-bottom: 16px;
    }
    .section-title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #1e40af;
      margin-bottom: 10px;
      padding-bottom: 6px;
      border-bottom: 1px solid #e2e8f0;
    }
    .section-row {
      display: flex;
      justify-content: space-between;
      gap: 20px;
    }
    .section-col {
      flex: 1;
    }

    .field {
      margin-bottom: 6px;
    }
    .field-label {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #94a3b8;
      font-weight: 600;
    }
    .field-value {
      font-size: 12px;
      color: #1e293b;
      font-weight: 500;
    }
    .field-value.name {
      font-size: 14px;
      font-weight: 600;
    }

    /* Amount highlight */
    .amount-box {
      background: #eff6ff;
      border: 2px solid #1e40af;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
      text-align: center;
    }
    .amount-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #64748b;
      margin-bottom: 4px;
    }
    .amount-value {
      font-size: 28px;
      font-weight: 700;
      color: #1e40af;
    }
    .amount-words {
      font-size: 11px;
      color: #475569;
      font-style: italic;
      margin-top: 4px;
    }

    /* Checkboxes */
    .checkbox-group {
      margin-bottom: 8px;
    }
    .checkbox-item {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 4px;
      font-size: 11px;
    }
    .checkbox {
      width: 12px;
      height: 12px;
      border: 1.5px solid #94a3b8;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .checkbox.checked {
      border-color: #1e40af;
      background: #1e40af;
      color: white;
      font-size: 9px;
      font-weight: 700;
    }

    /* Legal */
    .legal {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 14px;
      margin-bottom: 16px;
      font-size: 10px;
      color: #475569;
      line-height: 1.6;
    }
    .legal-title {
      font-weight: 700;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #1e40af;
      margin-bottom: 6px;
    }

    /* Signature */
    .signature-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: auto;
      padding-top: 20px;
    }
    .signature-block {
      text-align: center;
    }
    .signature-line {
      width: 200px;
      border-bottom: 1px solid #94a3b8;
      margin-top: 50px;
      margin-bottom: 4px;
    }
    .signature-label {
      font-size: 9px;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* Footer */
    .footer {
      margin-top: 16px;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 9px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="page">
    <!-- Header -->
    <div class="header">
      <div class="header-title">Re&ccedil;u au titre des dons</div>
      <div class="header-subtitle">
        Articles 200, 238 bis et 978 du Code G&eacute;n&eacute;ral des Imp&ocirc;ts (CGI)
      </div>
      <div class="header-ref">Cerfa n&deg; 11580*04</div>
      ${donation.cerfa_number ? `<div class="cerfa-number">N&deg; ${donation.cerfa_number}</div>` : ''}
    </div>

    <!-- Organisation section -->
    <div class="section">
      <div class="section-title">1. Organisme b&eacute;n&eacute;ficiaire du don</div>
      <div class="section-row">
        <div class="section-col">
          ${logoBase64 ? `<img src="${logoBase64}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; float: left; margin-right: 10px;" />` : ''}
          <div class="field">
            <div class="field-label">Nom ou d&eacute;nomination</div>
            <div class="field-value name">${company.name}</div>
          </div>
          ${company.legal_name ? `
          <div class="field">
            <div class="field-label">D&eacute;nomination l&eacute;gale</div>
            <div class="field-value">${company.legal_name}</div>
          </div>` : ''}
          <div class="field">
            <div class="field-label">Adresse</div>
            <div class="field-value">${company.address || 'Non renseign&eacute;e'}</div>
          </div>
        </div>
        <div class="section-col">
          <div class="field">
            <div class="field-label">Objet / Activit&eacute;</div>
            <div class="field-value">${company.description || 'Protection animale'}</div>
          </div>
          ${company.email ? `
          <div class="field">
            <div class="field-label">Email</div>
            <div class="field-value">${company.email}</div>
          </div>` : ''}
          ${company.phone ? `
          <div class="field">
            <div class="field-label">T&eacute;l&eacute;phone</div>
            <div class="field-value">${company.phone}</div>
          </div>` : ''}
        </div>
      </div>
    </div>

    <!-- Donor section -->
    <div class="section">
      <div class="section-title">2. Donateur</div>
      <div class="section-row">
        <div class="section-col">
          <div class="field">
            <div class="field-label">Nom et pr&eacute;nom / Raison sociale</div>
            <div class="field-value name">${donation.donor_name}</div>
          </div>
          <div class="field">
            <div class="field-label">Adresse</div>
            <div class="field-value">
              ${donation.donor_address || ''}
              ${donation.donor_postal_code || donation.donor_city
                ? `<br>${donation.donor_postal_code || ''} ${donation.donor_city || ''}`
                : ''}
            </div>
          </div>
        </div>
        <div class="section-col">
          ${donation.donor_email ? `
          <div class="field">
            <div class="field-label">Email</div>
            <div class="field-value">${donation.donor_email}</div>
          </div>` : ''}
          ${donation.donor_phone ? `
          <div class="field">
            <div class="field-label">T&eacute;l&eacute;phone</div>
            <div class="field-value">${donation.donor_phone}</div>
          </div>` : ''}
        </div>
      </div>
    </div>

    <!-- Amount box -->
    <div class="amount-box">
      <div class="amount-label">Montant du don</div>
      <div class="amount-value">${Number(donation.amount).toFixed(2)} &euro;</div>
      <div class="amount-words">${amountWords}</div>
    </div>

    <!-- Donation details -->
    <div class="section">
      <div class="section-title">3. Caract&eacute;ristiques du don</div>
      <div class="section-row">
        <div class="section-col">
          <div class="field">
            <div class="field-label">Date du versement</div>
            <div class="field-value">${dateFormatted}</div>
          </div>
          <div class="field" style="margin-top: 8px;">
            <div class="field-label">Nature du don</div>
            <div class="checkbox-group">
              <div class="checkbox-item">
                <span class="checkbox ${donation.nature === 'numeraire' ? 'checked' : ''}">${donation.nature === 'numeraire' ? '&check;' : ''}</span>
                Num&eacute;raire
              </div>
              <div class="checkbox-item">
                <span class="checkbox ${donation.nature === 'nature' ? 'checked' : ''}">${donation.nature === 'nature' ? '&check;' : ''}</span>
                Autres (don en nature)
              </div>
            </div>
          </div>
        </div>
        <div class="section-col">
          <div class="field">
            <div class="field-label">Mode de versement</div>
            <div class="field-value">${getPaymentMethodLabel(donation.payment_method)}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Legal attestation -->
    <div class="legal">
      <div class="legal-title">Attestation de l'organisme</div>
      <p>
        L'organisme b&eacute;n&eacute;ficiaire certifie sur l'honneur que les dons et versements qu'il
        re&ccedil;oit ouvrent droit &agrave; la r&eacute;duction d'imp&ocirc;t pr&eacute;vue &agrave;
        l'article <strong>200 du CGI</strong> (pour les particuliers) ou &agrave; l'article
        <strong>238 bis du CGI</strong> (pour les entreprises).
      </p>
      <p style="margin-top: 6px;">
        Le donateur peut b&eacute;n&eacute;ficier d'une r&eacute;duction d'imp&ocirc;t sur le revenu
        &eacute;gale &agrave; <strong>66%</strong> du montant du don, dans la limite de
        <strong>20%</strong> du revenu imposable. Pour les entreprises, la r&eacute;duction est de
        <strong>60%</strong> dans la limite de 20 000 &euro; ou 0,5% du chiffre d'affaires HT.
      </p>
    </div>

    <!-- Signature section -->
    <div class="signature-section">
      <div class="signature-block">
        <div class="field">
          <div class="field-label">Date d'&eacute;tablissement du re&ccedil;u</div>
          <div class="field-value">${generatedDate}</div>
        </div>
      </div>
      <div class="signature-block">
        <div class="signature-line"></div>
        <div class="signature-label">Signature et cachet de l'organisme</div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p>${company.name}${company.legal_name ? ` &ndash; ${company.legal_name}` : ''}</p>
      <p>${company.address || ''} | ${company.email || ''} | ${company.phone || ''}</p>
    </div>
  </div>
</body>
</html>`
}
