'use client'

import { Receipt, FileText, AlertCircle } from 'lucide-react'
import type { AnimalHealthRecord, HealthRecordType } from '@/lib/types/database'

const TYPE_LABEL: Record<HealthRecordType, string> = {
  vaccination: 'Vaccination',
  sterilization: 'Stérilisation',
  antiparasitic: 'Antiparasitaire',
  consultation: 'Consultation',
  surgery: 'Chirurgie',
  medication: 'Médication',
  behavioral_assessment: 'Bilan comportemental',
  identification: 'Identification',
  radio: 'Radiographie',
  blood_test: 'Analyses sanguines',
  cession: 'Certificat cession',
}

interface ExtendedHealthRecord extends AnimalHealthRecord {
  invoice_storage_path?: string | null
  invoice_file_name?: string | null
  invoice_uploaded_at?: string | null
}

interface Props {
  readonly animalId: string
  readonly healthRecords: AnimalHealthRecord[]
}

function eur(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' EUR'
}

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function MedicalCostRecapSection({ animalId, healthRecords }: Props) {
  const judicial = (healthRecords as ExtendedHealthRecord[])
    .filter((r) => r.judicial_procedure && (r.cost ?? 0) > 0)
    .sort((a, b) => (a.date < b.date ? -1 : 1))

  const total = judicial.reduce((sum, r) => sum + (r.cost ?? 0), 0)
  const withInvoice = judicial.filter((r) => r.invoice_storage_path).length
  const withoutInvoice = judicial.length - withInvoice

  return (
    <div className="bg-surface rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Receipt className="w-4 h-4 text-emerald-500" />
          <h3 className="text-sm font-bold text-text">Frais médicaux engagés</h3>
        </div>
        <div className="text-xs text-muted">
          {judicial.length} acte{judicial.length > 1 ? 's' : ''} - Total :{' '}
          <span className="text-emerald-500 font-bold text-sm">{eur(total)}</span>
        </div>
      </div>

      {judicial.length === 0 ? (
        <p className="text-xs text-muted italic">
          Aucun acte de santé n&apos;est marqué comme procédure judiciaire avec un coût renseigné.
          Coche &laquo; Cet acte fait partie de la procédure &raquo; et renseigne le coût sur les
          fiches santé pour qu&apos;ils apparaissent ici.
        </p>
      ) : (
        <>
          {withoutInvoice > 0 && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-500">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <strong>{withoutInvoice} acte{withoutInvoice > 1 ? 's' : ''} sans facture jointe.</strong>{' '}
                Pour le recouvrement, joignez le PDF de la facture clinique en éditant l&apos;acte
                concerné (onglet Santé).
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="text-left py-1.5 pr-2 font-semibold uppercase tracking-wider text-[10px]">Date</th>
                  <th className="text-left py-1.5 pr-2 font-semibold uppercase tracking-wider text-[10px]">Acte</th>
                  <th className="text-left py-1.5 pr-2 font-semibold uppercase tracking-wider text-[10px]">Description</th>
                  <th className="text-left py-1.5 pr-2 font-semibold uppercase tracking-wider text-[10px]">Réf. facture</th>
                  <th className="text-right py-1.5 pr-2 font-semibold uppercase tracking-wider text-[10px]">Coût</th>
                  <th className="text-center py-1.5 font-semibold uppercase tracking-wider text-[10px]">PDF</th>
                </tr>
              </thead>
              <tbody>
                {judicial.map((r) => (
                  <tr key={r.id} className="border-b border-border/30">
                    <td className="py-2 pr-2 text-text whitespace-nowrap">{formatDate(r.date)}</td>
                    <td className="py-2 pr-2 text-text">{TYPE_LABEL[r.type] || r.type}</td>
                    <td className="py-2 pr-2 text-muted truncate max-w-xs" title={r.description}>
                      {r.description}
                    </td>
                    <td className="py-2 pr-2 text-muted">{r.invoice_reference || '—'}</td>
                    <td className="py-2 pr-2 text-right font-semibold text-text whitespace-nowrap">
                      {eur(r.cost)}
                    </td>
                    <td className="py-2 text-center">
                      {r.invoice_storage_path ? (
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" title="Facture jointe" />
                      ) : (
                        <span className="inline-block w-2 h-2 rounded-full bg-amber-500/50" title="Pas de facture" />
                      )}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-emerald-500/40">
                  <td className="py-2 pr-2 font-bold text-text" colSpan={4}>
                    Total des frais engagés
                  </td>
                  <td className="py-2 pr-2 text-right font-bold text-emerald-500 text-sm">
                    {eur(total)}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <a
              href={`/api/pdf/medical-cost-recap/${animalId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border border-emerald-500/40 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors font-semibold"
            >
              <FileText className="w-3.5 h-3.5" />
              Générer le récap PDF (template refuge)
            </a>
          </div>
        </>
      )}
    </div>
  )
}
