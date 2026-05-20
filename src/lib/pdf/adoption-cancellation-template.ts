interface CancellationData {
  contract_number: string
  establishment: { name: string; legal_name: string | null; address: string | null; siret: string | null }
  adopter: { name: string; address: string | null }
  animal: { name: string; species: string; breed: string | null; identification: string | null }
  adoption_date: string
  return_date: string
  adoption_fee: number
  non_refundable_amount: number
  refunded_amount: number
  refund_payment_method: string
  return_reason: string | null
  trial_period_ends_at: string
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}
function fmtEur(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' EUR'
}
const METHOD_LABEL: Record<string, string> = {
  cheque: 'Cheque',
  virement: 'Virement bancaire',
  especes: 'Especes',
  cb: 'Carte bancaire',
  autre: 'Autre',
}

export function buildAdoptionCancellationHtml(d: CancellationData, logoBase64?: string): string {
  const logoHtml = logoBase64
    ? `<img src="${logoBase64}" class="logo" alt="logo" />`
    : ''

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<title>Avenant d'annulation - ${d.contract_number}</title>
<style>
  @page { size: A4; margin: 20mm 18mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; font-size: 12px; line-height: 1.55; }

  .header { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid #dc2626; padding-bottom: 14px; margin-bottom: 22px; }
  .logo { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; }
  .establishment-name { font-size: 18px; font-weight: 700; color: #0f172a; }
  .establishment-meta { font-size: 10px; color: #64748b; margin-top: 2px; }

  .doc-title { font-size: 22px; font-weight: 700; color: #dc2626; letter-spacing: 1px; text-transform: uppercase; text-align: center; margin-bottom: 4px; }
  .doc-sub { text-align: center; font-size: 11px; color: #64748b; margin-bottom: 18px; }

  .ref-row { display: flex; justify-content: space-between; padding: 10px 14px; background: #fef2f2; border-left: 3px solid #dc2626; border-radius: 4px; margin-bottom: 18px; }
  .ref-row .label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #991b1b; font-weight: 700; }
  .ref-row .value { font-size: 13px; font-weight: 600; color: #0f172a; margin-top: 2px; }

  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 22px; }
  .party { padding: 12px 14px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0; }
  .party h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #475569; margin-bottom: 6px; font-weight: 700; }
  .party p { font-size: 11px; color: #1e293b; }
  .party p.name { font-weight: 600; font-size: 12px; margin-bottom: 2px; }

  .section { margin-bottom: 18px; }
  .section h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #475569; margin-bottom: 8px; font-weight: 700; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0; }
  .section p { margin-bottom: 6px; }

  table.numbers { width: 100%; border-collapse: collapse; margin: 6px 0; }
  table.numbers td { padding: 6px 10px; border-bottom: 1px solid #f1f5f9; font-size: 12px; }
  table.numbers td:first-child { color: #475569; }
  table.numbers td.r { text-align: right; font-weight: 600; }
  table.numbers tr.total td { font-size: 13px; font-weight: 700; color: #dc2626; border-bottom: none; border-top: 2px solid #dc2626; padding-top: 8px; }

  .reason-box { padding: 10px 12px; background: #fffbeb; border-left: 3px solid #f59e0b; border-radius: 4px; font-size: 11px; color: #92400e; }

  .signature-section { margin-top: 28px; display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
  .signature-block .label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; font-weight: 700; }
  .signature-block .place-date { font-size: 10px; color: #94a3b8; margin: 4px 0; }
  .signature-block .line { border-bottom: 1px solid #94a3b8; height: 50px; margin-top: 8px; }
  .signature-block .name { font-size: 10px; color: #64748b; margin-top: 4px; font-style: italic; }

  .footer { margin-top: 26px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 9px; color: #94a3b8; text-align: center; }
</style>
</head>
<body>
  <div class="header">
    ${logoHtml}
    <div>
      <div class="establishment-name">${d.establishment.name}</div>
      ${d.establishment.legal_name ? `<div class="establishment-meta">${d.establishment.legal_name}</div>` : ''}
      ${d.establishment.address ? `<div class="establishment-meta">${d.establishment.address}</div>` : ''}
      ${d.establishment.siret ? `<div class="establishment-meta">SIRET : ${d.establishment.siret}</div>` : ''}
    </div>
  </div>

  <div class="doc-title">Avenant d'annulation d'adoption</div>
  <div class="doc-sub">Retour de l'animal pendant la periode d'accueil</div>

  <div class="ref-row">
    <div>
      <div class="label">Contrat d'origine</div>
      <div class="value">${d.contract_number}</div>
    </div>
    <div style="text-align:right;">
      <div class="label">Date de retour</div>
      <div class="value">${fmtDate(d.return_date)}</div>
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <h3>Refuge</h3>
      <p class="name">${d.establishment.name}</p>
      ${d.establishment.address ? `<p>${d.establishment.address}</p>` : ''}
      ${d.establishment.siret ? `<p>SIRET : ${d.establishment.siret}</p>` : ''}
    </div>
    <div class="party">
      <h3>Adoptant</h3>
      <p class="name">${d.adopter.name}</p>
      ${d.adopter.address ? `<p>${d.adopter.address}</p>` : ''}
    </div>
  </div>

  <div class="section">
    <h2>Animal concerne</h2>
    <p><strong>${d.animal.name}</strong> - ${d.animal.species}${d.animal.breed ? ` (${d.animal.breed})` : ''}</p>
    ${d.animal.identification ? `<p>Identification : ${d.animal.identification}</p>` : ''}
  </div>

  <div class="section">
    <h2>Contexte</h2>
    <p>
      Le present avenant fait suite au contrat d'adoption ${d.contract_number} signe le
      ${fmtDate(d.adoption_date)}. L'adoptant restitue l'animal au refuge ce jour
      (${fmtDate(d.return_date)}), avant la fin de la periode d'accueil prevue
      le ${fmtDate(d.trial_period_ends_at)}.
    </p>
    <p>
      Le contrat d'adoption initial est resilie a effet immediat. L'animal redevient
      la propriete du refuge.
    </p>
  </div>

  <div class="section">
    <h2>Reglement financier</h2>
    <table class="numbers">
      <tr>
        <td>Montant initial de l'adoption</td>
        <td class="r">${fmtEur(d.adoption_fee)}</td>
      </tr>
      <tr>
        <td>Frais de dossier conserves par le refuge</td>
        <td class="r">- ${fmtEur(d.non_refundable_amount)}</td>
      </tr>
      <tr class="total">
        <td>Montant rembourse a l'adoptant (${METHOD_LABEL[d.refund_payment_method] ?? d.refund_payment_method})</td>
        <td class="r">${fmtEur(d.refunded_amount)}</td>
      </tr>
    </table>
  </div>

  ${
    d.return_reason
      ? `<div class="section">
          <h2>Motif du retour</h2>
          <div class="reason-box">${d.return_reason.replace(/\n/g, '<br>')}</div>
        </div>`
      : ''
  }

  <div class="signature-section">
    <div class="signature-block">
      <div class="label">Pour le refuge</div>
      <div class="place-date">Fait le ${fmtDate(d.return_date)}</div>
      <div class="line"></div>
      <div class="name">Nom et signature du representant</div>
    </div>
    <div class="signature-block">
      <div class="label">L'adoptant</div>
      <div class="place-date">Fait le ${fmtDate(d.return_date)}</div>
      <div class="line"></div>
      <div class="name">${d.adopter.name}</div>
    </div>
  </div>

  <div class="footer">
    ${d.establishment.name} - Avenant genere automatiquement
  </div>
</body>
</html>`
}
