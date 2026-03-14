import type { Donation, CompanyInfo } from '@/lib/types/database'
import { SIGNATURE_BASE64 } from './cerfa-assets'

function buildCachetSvg(company: CompanyInfo): string {
  const name = (company.name || '').toUpperCase()
  const legalName = (company.legal_name || '').toUpperCase()
  const address = company.address || ''
  const email = company.email || ''

  const topText = legalName || name
  const centerName = name
  const bottomText = email || address

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240">
    <defs>
      <path id="topArc" d="M 16,120 a 104,104 0 0,1 208,0" fill="none" />
      <path id="bottomArc" d="M 224,120 a 104,104 0 0,1 -208,0" fill="none" />
    </defs>

    <!-- Double cercle -->
    <circle cx="120" cy="120" r="112" fill="none" stroke="#1e3a6e" stroke-width="3" />
    <circle cx="120" cy="120" r="102" fill="none" stroke="#1e3a6e" stroke-width="1.5" />

    <!-- Etoiles decoratives -->
    <text x="22" y="124" font-size="10" fill="#1e3a6e" text-anchor="middle">\u2605</text>
    <text x="218" y="124" font-size="10" fill="#1e3a6e" text-anchor="middle">\u2605</text>

    <!-- Texte arc haut : denomination legale -->
    <text font-family="Helvetica, Arial, sans-serif" font-size="10" font-weight="700" fill="#1e3a6e" letter-spacing="1">
      <textPath href="#topArc" startOffset="50%" text-anchor="middle">${topText}</textPath>
    </text>

    <!-- Texte arc bas : email -->
    <text font-family="Helvetica, Arial, sans-serif" font-size="9" fill="#1e3a6e" letter-spacing="0.5">
      <textPath href="#bottomArc" startOffset="50%" text-anchor="middle">${bottomText}</textPath>
    </text>

    <!-- Lignes separatrices -->
    <line x1="48" y1="100" x2="192" y2="100" stroke="#1e3a6e" stroke-width="0.7" />
    <line x1="48" y1="142" x2="192" y2="142" stroke="#1e3a6e" stroke-width="0.7" />

    <!-- Centre : nom court -->
    <text x="120" y="118" font-family="Helvetica, Arial, sans-serif" font-size="22" font-weight="800" fill="#1e3a6e" text-anchor="middle">${centerName}</text>

    <!-- Adresse -->
    <text x="120" y="134" font-family="Helvetica, Arial, sans-serif" font-size="7" fill="#1e3a6e" opacity="0.8" text-anchor="middle">${address}</text>
  </svg>`
}

const FRENCH_UNITS = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf']
const FRENCH_TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt']

function convertTens(n: number): string {
  const t = Math.floor(n / 10)
  const u = n % 10

  // Special French rules for 70s and 90s (soixante-dix, quatre-vingt-dix)
  if (t === 7 || t === 9) {
    const separator = (u === 1 && t === 7) ? ' et ' : '-'
    return FRENCH_TENS[t] + separator + FRENCH_UNITS[10 + u]
  }

  // quatre-vingts (with trailing 's' only when exact)
  if (t === 8 && u === 0) return 'quatre-vingts'

  let separator = ''
  if (u === 1 && t <= 6) separator = ' et '
  else if (u > 0) separator = '-'
  return FRENCH_TENS[t] + separator + FRENCH_UNITS[u]
}

function convertHundreds(n: number): string {
  const h = Math.floor(n / 100)
  const rest = n % 100
  const prefix = h === 1 ? 'cent' : FRENCH_UNITS[h] + ' cent' + (rest === 0 ? 's' : '')
  return prefix + (rest > 0 ? ' ' + convertNumber(rest) : '')
}

function convertThousands(n: number): string {
  const th = Math.floor(n / 1000)
  const rest = n % 1000
  const prefix = th === 1 ? 'mille' : convertNumber(th) + ' mille'
  return prefix + (rest > 0 ? ' ' + convertNumber(rest) : '')
}

function convertNumber(n: number): string {
  if (n === 0) return ''
  if (n < 20) return FRENCH_UNITS[n]
  if (n < 100) return convertTens(n)
  if (n < 1000) return convertHundreds(n)
  if (n < 1000000) return convertThousands(n)
  return n.toString()
}

function amountToWords(amount: number): string {
  if (amount === 0) return 'zero'

  const euros = Math.floor(amount)
  const cents = Math.round((amount - euros) * 100)

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

function buildHeaderSection(donation: Donation): string {
  const cerfaNumberHtml = donation.cerfa_number
    ? `<div class="cerfa-number">N&deg; ${donation.cerfa_number}</div>`
    : ''

  return `<!-- Header -->
    <div class="header">
      <div class="header-title">Re&ccedil;u au titre des dons</div>
      <div class="header-subtitle">
        Articles 200, 238 bis et 978 du Code G&eacute;n&eacute;ral des Imp&ocirc;ts (CGI)
      </div>
      <div class="header-ref">Cerfa n&deg; 11580*04</div>
      ${cerfaNumberHtml}
    </div>`
}

function buildOrganisationSection(company: CompanyInfo, logoBase64?: string): string {
  const logoHtml = logoBase64
    ? `<img src="${logoBase64}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; float: left; margin-right: 10px;" />`
    : ''

  const legalNameHtml = company.legal_name
    ? `
          <div class="field">
            <div class="field-label">D&eacute;nomination l&eacute;gale</div>
            <div class="field-value">${company.legal_name}</div>
          </div>`
    : ''

  const emailHtml = company.email
    ? `
          <div class="field">
            <div class="field-label">Email</div>
            <div class="field-value">${company.email}</div>
          </div>`
    : ''

  const phoneHtml = company.phone
    ? `
          <div class="field">
            <div class="field-label">T&eacute;l&eacute;phone</div>
            <div class="field-value">${company.phone}</div>
          </div>`
    : ''

  return `<!-- Organisation section -->
    <div class="section">
      <div class="section-title">1. Organisme b&eacute;n&eacute;ficiaire du don</div>
      <div class="section-row">
        <div class="section-col">
          ${logoHtml}
          <div class="field">
            <div class="field-label">Nom ou d&eacute;nomination</div>
            <div class="field-value name">${company.name}</div>
          </div>
          ${legalNameHtml}
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
          ${emailHtml}
          ${phoneHtml}
        </div>
      </div>
    </div>`
}

function buildDonorSection(donation: Donation): string {
  const cityLineHtml = donation.donor_postal_code || donation.donor_city
    ? `<br>${donation.donor_postal_code || ''} ${donation.donor_city || ''}`
    : ''

  const donorEmailHtml = donation.donor_email
    ? `
          <div class="field">
            <div class="field-label">Email</div>
            <div class="field-value">${donation.donor_email}</div>
          </div>`
    : ''

  const donorPhoneHtml = donation.donor_phone
    ? `
          <div class="field">
            <div class="field-label">T&eacute;l&eacute;phone</div>
            <div class="field-value">${donation.donor_phone}</div>
          </div>`
    : ''

  return `<!-- Donor section -->
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
              ${cityLineHtml}
            </div>
          </div>
        </div>
        <div class="section-col">
          ${donorEmailHtml}
          ${donorPhoneHtml}
        </div>
      </div>
    </div>`
}

function buildAmountSection(donation: Donation, amountWords: string): string {
  return `<!-- Amount box -->
    <div class="amount-box">
      <div class="amount-label">Montant du don</div>
      <div class="amount-value">${Number(donation.amount).toFixed(2)} &euro;</div>
      <div class="amount-words">${amountWords}</div>
    </div>`
}

function buildDonationDetailsSection(donation: Donation, dateFormatted: string): string {
  const numeraireChecked = donation.nature === 'numeraire'
  const natureChecked = donation.nature === 'nature'

  return `<!-- Donation details -->
    <div class="section">
      <div class="section-title">3. Caract&eacute;ristiques du don</div>
      <div class="section-row">
        <div class="section-col">
          <div class="field">
            <div class="field-label">Date du versement</div>
            <div class="field-value">${dateFormatted}</div>
          </div>
          <div class="field" style="margin-top: 4px;">
            <div class="field-label">Nature du don</div>
            <div class="checkbox-group">
              <div class="checkbox-item">
                <span class="checkbox ${numeraireChecked ? 'checked' : ''}">${numeraireChecked ? '&check;' : ''}</span>
                Num&eacute;raire
              </div>
              <div class="checkbox-item">
                <span class="checkbox ${natureChecked ? 'checked' : ''}">${natureChecked ? '&check;' : ''}</span>
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
    </div>`
}

function buildLegalSection(): string {
  return `<!-- Legal attestation -->
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
    </div>`
}

function buildSignatureSection(company: CompanyInfo, generatedDate: string): string {
  return `<!-- Signature section -->
    <div class="signature-section">
      <div class="signature-left">
        <div class="field">
          <div class="field-label">Date d'&eacute;tablissement du re&ccedil;u</div>
          <div class="field-value">${generatedDate}</div>
        </div>
        <div class="cachet-wrapper">${buildCachetSvg(company)}</div>
      </div>
      <div class="signature-right">
        <img src="${SIGNATURE_BASE64}" class="signature-img" alt="Signature" />
        <div class="signature-label">Signature du responsable</div>
      </div>
    </div>`
}

function buildFooterSection(company: CompanyInfo): string {
  const legalNameSuffix = company.legal_name ? ` &ndash; ${company.legal_name}` : ''

  return `<!-- Footer -->
    <div class="footer">
      <p>${company.name}${legalNameSuffix}</p>
      <p>${company.address || ''} | ${company.email || ''} | ${company.phone || ''}</p>
    </div>`
}

function formatFrenchDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function buildCssStyles(): string {
  return `<style>
    @page { size: A4; margin: 10mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      color: #1e293b;
      font-size: 11px;
      line-height: 1.4;
    }

    .page {
      border: 2px solid #1e40af;
      padding: 20px;
      min-height: calc(297mm - 20mm);
      max-height: calc(297mm - 20mm);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* Header */
    .header {
      text-align: center;
      border-bottom: 2px solid #1e40af;
      padding-bottom: 10px;
      margin-bottom: 12px;
    }
    .header-title {
      font-size: 16px;
      font-weight: 700;
      color: #1e40af;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 2px;
    }
    .header-subtitle {
      font-size: 10px;
      color: #64748b;
    }
    .header-ref {
      font-size: 9px;
      color: #94a3b8;
      margin-top: 2px;
    }
    .cerfa-number {
      font-size: 13px;
      font-weight: 700;
      color: #1e40af;
      margin-top: 4px;
    }

    /* Sections */
    .section {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 10px 12px;
      margin-bottom: 10px;
    }
    .section-title {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #1e40af;
      margin-bottom: 6px;
      padding-bottom: 4px;
      border-bottom: 1px solid #e2e8f0;
    }
    .section-row {
      display: flex;
      justify-content: space-between;
      gap: 16px;
    }
    .section-col {
      flex: 1;
    }

    .field {
      margin-bottom: 4px;
    }
    .field-label {
      font-size: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #94a3b8;
      font-weight: 600;
    }
    .field-value {
      font-size: 11px;
      color: #1e293b;
      font-weight: 500;
    }
    .field-value.name {
      font-size: 12px;
      font-weight: 600;
    }

    /* Amount highlight */
    .amount-box {
      background: #eff6ff;
      border: 2px solid #1e40af;
      border-radius: 8px;
      padding: 10px;
      margin-bottom: 10px;
      text-align: center;
    }
    .amount-label {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #64748b;
      margin-bottom: 2px;
    }
    .amount-value {
      font-size: 22px;
      font-weight: 700;
      color: #1e40af;
    }
    .amount-words {
      font-size: 10px;
      color: #475569;
      font-style: italic;
      margin-top: 2px;
    }

    /* Checkboxes */
    .checkbox-group {
      margin-bottom: 4px;
    }
    .checkbox-item {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 2px;
      font-size: 10px;
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
      padding: 10px;
      margin-bottom: 10px;
      font-size: 9px;
      color: #475569;
      line-height: 1.5;
    }
    .legal-title {
      font-weight: 700;
      font-size: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #1e40af;
      margin-bottom: 4px;
    }

    /* Signature */
    .signature-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: auto;
      padding-top: 10px;
    }
    .signature-left {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
    }
    .cachet-wrapper {
      width: 100px;
      height: 100px;
    }
    .cachet-wrapper svg {
      width: 100%;
      height: 100%;
    }
    .signature-right {
      text-align: center;
    }
    .signature-img {
      width: 150px;
      height: auto;
    }
    .signature-label {
      font-size: 8px;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 2px;
    }

    /* Footer */
    .footer {
      margin-top: 8px;
      padding-top: 6px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 8px;
      color: #94a3b8;
    }
  </style>`
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

  const dateFormatted = formatFrenchDate(donation.date)

  const generatedDate = donation.cerfa_generated_at
    ? formatFrenchDate(donation.cerfa_generated_at)
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
  ${buildCssStyles()}
</head>
<body>
  <div class="page">
    ${buildHeaderSection(donation)}

    ${buildOrganisationSection(company, logoBase64)}

    ${buildDonorSection(donation)}

    ${buildAmountSection(donation, amountWords)}

    ${buildDonationDetailsSection(donation, dateFormatted)}

    ${buildLegalSection()}

    ${buildSignatureSection(company, generatedDate)}

    ${buildFooterSection(company)}
  </div>
</body>
</html>`
}
