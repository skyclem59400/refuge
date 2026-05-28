import {
  SDA_NAVY, SDA_NAVY_LIGHT, SDA_TEAL, SDA_ORANGE,
  SDA_BORDER, SDA_BG, SDA_SURFACE_NEUTRAL, SDA_FOOTER_ACCENT_GRADIENT,
  SDA_FONT_FAMILY, SDA_ORG_TAGLINE,
} from '@/lib/pdf/sda-brand'
import { getSpeciesLabel } from '@/lib/species'
import { ABANDONMENT_MOTIF_LABELS, type AbandonmentMotif } from '@/lib/types/database'
import type { CompanyInfo } from '@/lib/types/database'
import { buildCachetSvg } from './cachet'

interface AbandonmentPdfContract {
  contract_number: string
  signature_date: string
  expected_handover_date: string | null
  motif: AbandonmentMotif
  motif_details: string | null
  amount: number
  note: string | null
  cedant_id_card_number: string | null
  cedant_passport_number: string | null
  signed_at_location: string | null
  signed_at: string | null
}

interface AbandonmentPdfAnimal {
  name: string
  species: string
  breed: string | null
  color: string | null
  sex: string
  sterilized: boolean
  birth_date: string | null
  chip_number: string | null
  loof_number: string | null
  tattoo_number: string | null
  medal_number: string | null
  description: string | null
}

interface AbandonmentPdfCedant {
  kind: 'person' | 'organization'
  name: string
  first_name: string | null
  email: string | null
  phone: string | null
  address: string | null
  postal_code: string | null
  city: string | null
}

function fmtDateLong(iso: string | null | undefined): string {
  if (!iso) return '__ / __ / ____'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '__ / __ / ____'
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '__/__/____ à __h__'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '__/__/____ à __h__'
  return `${d.toLocaleDateString('fr-FR')} à ${d.getHours().toString().padStart(2, '0')}h${d.getMinutes().toString().padStart(2, '0')}`
}

function fmtAmount(value: number | null | undefined): string {
  if (value == null || value === 0) return '...........€'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
}

function fmtSex(sex: string): string {
  if (sex === 'male') return 'Mâle'
  if (sex === 'female') return 'Femelle'
  return 'Inconnu'
}

function fmtCedantName(cedant: AbandonmentPdfCedant): string {
  if (cedant.kind === 'organization' || !cedant.first_name) return cedant.name
  return `${cedant.name} ${cedant.first_name}`
}

function fmtCivility(cedant: AbandonmentPdfCedant): string {
  // Heuristique simple — sera idéalement renforcée par un champ civility côté CRM
  if (cedant.kind === 'organization') return ''
  return 'Mme / M.'
}

export function buildAbandonmentContractHtml(
  contract: AbandonmentPdfContract,
  animal: AbandonmentPdfAnimal,
  cedant: AbandonmentPdfCedant,
  companyInfo?: CompanyInfo,
  logoBase64?: string,
  createdByName?: string | null,
): string {
  const orgName = companyInfo?.legal_name || companyInfo?.name || 'SDA Estourmel'
  const orgAddress = companyInfo?.address || '11 route nationale, 59400 Estourmel'
  const orgEmail = companyInfo?.email || 'accueil@sda-nord.com'
  const orgSiret = companyInfo?.siret || ''
  const refugeCachetSvg = buildCachetSvg(companyInfo || { name: orgName })

  const cedantFullName = fmtCedantName(cedant)
  const cedantAddressBlock = [
    cedant.address,
    [cedant.postal_code, cedant.city].filter(Boolean).join(' '),
  ].filter(Boolean).join('<br/>') || '—'

  const motifLabel = ABANDONMENT_MOTIF_LABELS[contract.motif] || contract.motif
  const motifFull = contract.motif === 'autre' && contract.motif_details
    ? `${motifLabel} — ${contract.motif_details}`
    : motifLabel

  const generatedAt = new Date().toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris',
  })

  const logoImg = logoBase64
    ? `<img src="${logoBase64}" alt="Logo SDA" style="width:68px;height:68px;object-fit:contain;" />`
    : ''

  const handoverLine = contract.expected_handover_date
    ? `<p style="margin:4mm 0 0;font-size:9.5pt;color:${SDA_NAVY_LIGHT};font-style:italic;">Date de remise prévue de l'animal : <strong>${fmtDateLong(contract.expected_handover_date)}</strong>.</p>`
    : ''

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>Abandon par anticipation — ${contract.contract_number}</title>
<style>
  @page { size: A4; margin: 14mm 16mm 16mm 16mm; }
  body {
    font-family: ${SDA_FONT_FAMILY};
    color: ${SDA_NAVY};
    background: ${SDA_BG};
    margin: 0;
    padding: 0;
    font-size: 10.5pt;
    line-height: 1.5;
  }
  .wrap { padding: 0; }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 4mm;
    border-bottom: 2.5px solid ${SDA_NAVY};
    margin-bottom: 8mm;
  }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand h1 { margin: 0; font-size: 18pt; font-weight: 700; color: ${SDA_NAVY}; line-height: 1; }
  .brand h1 .accent { color: ${SDA_TEAL}; }
  .brand .tagline { font-size: 8pt; color: ${SDA_TEAL}; text-transform: uppercase; letter-spacing: 2px; font-weight: 600; margin-top: 2px; }
  .org-meta { text-align: right; font-size: 8.5pt; color: ${SDA_NAVY_LIGHT}; line-height: 1.45; }
  .org-meta strong { color: ${SDA_NAVY}; }

  .ref-bar {
    background: ${SDA_SURFACE_NEUTRAL};
    border-left: 4px solid ${SDA_ORANGE};
    padding: 3mm 5mm;
    margin-bottom: 6mm;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .ref-bar .label { font-size: 8pt; text-transform: uppercase; letter-spacing: 1.4px; color: ${SDA_ORANGE}; font-weight: 700; }
  .ref-bar .number { font-size: 14pt; font-weight: 800; color: ${SDA_NAVY}; letter-spacing: 0.5px; }

  h2.doc-title {
    text-align: center;
    font-size: 18pt;
    font-weight: 800;
    color: ${SDA_NAVY};
    margin: 0 0 5mm;
    letter-spacing: 0.5px;
  }
  h2.doc-title .subtitle {
    display: block;
    font-size: 10pt;
    font-weight: 600;
    color: ${SDA_TEAL};
    text-transform: uppercase;
    letter-spacing: 2px;
    margin-top: 2mm;
  }

  .intro {
    margin: 0 0 6mm;
    padding: 4mm 5mm;
    background: ${SDA_SURFACE_NEUTRAL};
    border-radius: 3px;
    font-size: 10pt;
    line-height: 1.55;
  }

  .parties { display: flex; gap: 6mm; margin-bottom: 6mm; }
  .party {
    flex: 1;
    border: 1px solid ${SDA_BORDER};
    border-radius: 4px;
    overflow: hidden;
  }
  .party-head {
    background: ${SDA_NAVY};
    color: white;
    padding: 2.5mm 4mm;
    text-align: center;
    font-size: 9pt;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
  }
  .party-body { padding: 4mm 5mm; font-size: 9.5pt; line-height: 1.55; }
  .party-body strong { color: ${SDA_NAVY}; }
  .party-body .field { margin-bottom: 1.6mm; }

  .row {
    display: flex;
    gap: 6mm;
    margin-bottom: 6mm;
  }
  .col-box {
    flex: 1;
    border: 1px solid ${SDA_BORDER};
    padding: 4mm 5mm;
    border-radius: 4px;
    background: white;
  }
  .col-box .label {
    font-size: 8pt;
    color: ${SDA_TEAL};
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.4px;
    margin-bottom: 1.5mm;
  }
  .col-box .value { font-size: 11pt; font-weight: 600; color: ${SDA_NAVY}; }

  .note-block {
    margin-bottom: 6mm;
    border: 1px solid ${SDA_BORDER};
    border-radius: 4px;
    overflow: hidden;
  }
  .note-block .head {
    background: ${SDA_SURFACE_NEUTRAL};
    padding: 2.5mm 5mm;
    font-size: 8.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.4px;
    color: ${SDA_TEAL};
    border-bottom: 1px solid ${SDA_BORDER};
  }
  .note-block .body {
    padding: 4mm 5mm;
    min-height: 12mm;
    font-size: 9.5pt;
    color: ${SDA_NAVY_LIGHT};
  }

  .closing {
    margin: 6mm 0 8mm;
    font-size: 10pt;
    color: ${SDA_NAVY};
  }

  .signatures { display: flex; gap: 8mm; margin-top: 4mm; }
  .signature {
    flex: 1;
    border: 1px solid ${SDA_BORDER};
    border-radius: 4px;
    min-height: 30mm;
    display: flex;
    flex-direction: column;
  }
  .signature-head {
    background: ${SDA_SURFACE_NEUTRAL};
    padding: 2.5mm 4mm;
    text-align: center;
    font-size: 9pt;
    font-weight: 600;
    color: ${SDA_NAVY};
    border-bottom: 1px solid ${SDA_BORDER};
  }
  .signature-body { flex: 1; padding: 4mm; }
  .signature-body.is-refuge {
    display: flex;
    align-items: center;
    gap: 3mm;
    padding: 2mm 3mm;
    color: ${SDA_NAVY};
  }
  .signature-body.is-refuge .cachet {
    width: 26mm;
    height: 26mm;
    flex-shrink: 0;
  }
  .signature-body.is-refuge .cachet svg { display: block; width: 100%; height: 100%; }
  .signature-body.is-refuge .signer-name {
    flex: 1;
    font-size: 9pt;
    font-weight: 700;
    color: ${SDA_NAVY};
    line-height: 1.3;
  }
  .signature-body.is-refuge .signer-label {
    font-size: 7.5pt;
    font-weight: 400;
    color: ${SDA_NAVY_LIGHT};
    text-transform: uppercase;
    letter-spacing: 0.5pt;
    display: block;
    margin-bottom: 1mm;
  }

  .footer {
    margin-top: 10mm;
    padding-top: 4mm;
    border-top: 1px solid ${SDA_BORDER};
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 8pt;
    color: ${SDA_NAVY_LIGHT};
  }
  .footer .strip {
    margin-top: 3mm;
    height: 3px;
    background: ${SDA_FOOTER_ACCENT_GRADIENT};
  }
</style>
</head>
<body>
  <div class="wrap">

    <!-- HEADER -->
    <div class="header">
      <div class="brand">
        ${logoImg}
        <div>
          <h1><span class="accent">SDA</span> d'Estourmel</h1>
          <div class="tagline">${SDA_ORG_TAGLINE}</div>
        </div>
      </div>
      <div class="org-meta">
        <strong>${orgName}</strong><br/>
        ${orgAddress}<br/>
        ${orgEmail}
        ${orgSiret ? `<br/>SIRET : ${orgSiret}` : ''}
      </div>
    </div>

    <!-- TITLE -->
    <h2 class="doc-title">
      Abandon à distance par anticipation
      <span class="subtitle">Contrat de cession volontaire</span>
    </h2>

    <!-- REF + DATE -->
    <div class="ref-bar">
      <div>
        <div class="label">Contrat n°</div>
        <div class="number">${contract.contract_number}</div>
      </div>
      <div style="text-align:right;">
        <div class="label">Établi le</div>
        <div class="number">${fmtDateLong(contract.signature_date)}</div>
      </div>
    </div>

    <!-- INTRO -->
    <div class="intro">
      Je soussigné(e) <strong>${cedantFullName}</strong>, propriétaire de l'animal décrit ci-dessous,
      certifie céder volontairement et de manière irrévocable, à compter du
      <strong>${fmtDateLong(contract.signature_date)}</strong>, l'animal nommé
      <strong>${animal.name}</strong> à <strong>${orgName}</strong>, qui en accepte la prise en charge.
      ${handoverLine}
    </div>

    <!-- PARTIES -->
    <div class="parties">
      <div class="party">
        <div class="party-head">Le cédant</div>
        <div class="party-body">
          <div class="field"><strong>${fmtCivility(cedant)} ${cedantFullName}</strong></div>
          <div class="field"><strong>Adresse :</strong><br/>${cedantAddressBlock}</div>
          ${cedant.phone ? `<div class="field"><strong>Téléphone :</strong> ${cedant.phone}</div>` : ''}
          ${cedant.email ? `<div class="field"><strong>Email :</strong> ${cedant.email}</div>` : ''}
          <div class="field"><strong>N° carte d'identité :</strong> ${contract.cedant_id_card_number || '________________'}</div>
          <div class="field"><strong>N° passeport :</strong> ${contract.cedant_passport_number || '________________'}</div>
          <div class="field" style="margin-top:3mm;padding-top:3mm;border-top:1px dashed ${SDA_BORDER};">
            <strong style="text-decoration:underline;">Motif(s) de l'abandon :</strong>
            <div style="margin-top:1mm;">${motifFull}</div>
          </div>
        </div>
      </div>

      <div class="party">
        <div class="party-head">L'animal</div>
        <div class="party-body">
          <div class="field"><strong>Nom :</strong> ${animal.name}</div>
          <div class="field"><strong>Espèce :</strong> ${getSpeciesLabel(animal.species)}</div>
          <div class="field"><strong>Race :</strong> ${animal.breed || '—'}</div>
          <div class="field"><strong>Robe :</strong> ${animal.color || '—'}</div>
          <div class="field"><strong>Sexe :</strong> ${fmtSex(animal.sex)}</div>
          <div class="field"><strong>Stérilisé :</strong> ${animal.sterilized ? 'Oui' : 'Non'}</div>
          <div class="field"><strong>Date de naissance :</strong> ${fmtDateLong(animal.birth_date)}</div>
          <div class="field"><strong>N° de puce :</strong> ${animal.chip_number || '—'}</div>
          <div class="field"><strong>N° LOF :</strong> ${animal.loof_number || '—'}</div>
          <div class="field"><strong>N° de tatouage :</strong> ${animal.tattoo_number || '—'}</div>
          <div class="field"><strong>Médaille :</strong> ${animal.medal_number || '—'}</div>
          <div class="field"><strong>Signes particuliers :</strong> ${animal.description || '—'}</div>
        </div>
      </div>
    </div>

    <!-- AMOUNT -->
    <div class="row">
      <div class="col-box">
        <div class="label">Montant de l'abandon</div>
        <div class="value">${fmtAmount(contract.amount)}</div>
      </div>
    </div>

    <!-- NOTE -->
    <div class="note-block">
      <div class="head">Note</div>
      <div class="body">${contract.note || '&nbsp;'}</div>
    </div>

    <!-- CLOSING -->
    <div class="closing">
      Fait en double exemplaire à <strong>${contract.signed_at_location || 'Estourmel'}</strong>,
      le <strong>${fmtDateTime(contract.signed_at || contract.signature_date)}</strong>.
    </div>

    <!-- SIGNATURES -->
    <div class="signatures">
      <div class="signature">
        <div class="signature-head">Signature du cédant</div>
        <div class="signature-body"></div>
      </div>
      <div class="signature">
        <div class="signature-head">Signature de ${orgName}</div>
        <div class="signature-body is-refuge">
          <div class="cachet">${refugeCachetSvg}</div>
          <div class="signer-name">
            <span class="signer-label">Pour ${orgName}</span>
            ${createdByName ? createdByName : 'Le représentant'}
          </div>
        </div>
      </div>
    </div>

    <!-- FOOTER -->
    <div class="footer">
      <div>Document généré automatiquement le ${generatedAt}</div>
      <div>${contract.contract_number}</div>
    </div>
    <div class="strip"></div>

  </div>
</body>
</html>`
}
