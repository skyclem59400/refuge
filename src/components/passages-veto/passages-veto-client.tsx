'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Stethoscope, Filter, FileDown, Printer } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { getHealthTypeLabel } from '@/lib/sda-utils'
import type { PassageVeto } from '@/lib/actions/passages-veto'
import type { VeterinaryClinicWithVets } from '@/lib/types/database'

interface Props {
  passages: PassageVeto[]
  stats: { count: number; totalCost: number; byVet: Record<string, { name: string; count: number; cost: number }>; byType: Record<string, number> }
  clinics: VeterinaryClinicWithVets[]
  initialFilters: { startDate: string; endDate: string; vetId: string; clinicId: string; type: string; judicialOnly: boolean }
}

const TYPE_OPTIONS = [
  'vaccination', 'sterilization', 'antiparasitic', 'consultation',
  'surgery', 'medication', 'behavioral_assessment',
  'identification', 'radio', 'blood_test', 'cession',
]

export function PassagesVetoClient({ passages, stats, clinics, initialFilters }: Readonly<Props>) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [startDate, setStartDate] = useState(initialFilters.startDate)
  const [endDate, setEndDate] = useState(initialFilters.endDate)
  const [vetId, setVetId] = useState(initialFilters.vetId)
  const [clinicId, setClinicId] = useState(initialFilters.clinicId)
  const [type, setType] = useState(initialFilters.type)
  const [judicialOnly, setJudicialOnly] = useState(initialFilters.judicialOnly)

  const allVets = clinics.flatMap((c) => c.veterinarians.map((v) => ({ ...v, clinic_name: c.name })))
  const filteredVets = clinicId ? allVets.filter((v) => v.clinic_id === clinicId) : allVets

  function applyFilters() {
    const params = new URLSearchParams()
    if (startDate) params.set('start', startDate)
    if (endDate) params.set('end', endDate)
    if (vetId) params.set('vet', vetId)
    if (clinicId) params.set('clinic', clinicId)
    if (type) params.set('type', type)
    if (judicialOnly) params.set('judicial', '1')
    startTransition(() => router.push(`/passages-veto?${params.toString()}`))
  }

  function exportCsv() {
    const header = ['Date', 'Animal', 'Médaille', 'Type', 'Description', 'Vétérinaire', 'Cabinet', 'Coût (EUR)', 'Procédure', 'Facturé à', 'Réf. facture']
    const rows = passages.map((p) => [
      p.date,
      p.animal_name,
      p.animal_medal || '',
      getHealthTypeLabel(p.type),
      (p.description || '').replace(/\n/g, ' '),
      vetDisplayName(p),
      p.clinic_name || '',
      p.cost?.toString() || '',
      p.judicial_procedure ? 'Oui' : '',
      p.billed_to || '',
      p.invoice_reference || '',
    ])
    const csv = [header, ...rows].map((r) =>
      r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')
    ).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `passages-veto-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function pdfHref() {
    const params = new URLSearchParams()
    if (startDate) params.set('start', startDate)
    if (endDate) params.set('end', endDate)
    if (vetId) params.set('vet', vetId)
    if (clinicId) params.set('clinic', clinicId)
    if (type) params.set('type', type)
    if (judicialOnly) params.set('judicial', '1')
    return `/api/pdf/passages-veto?${params.toString()}`
  }

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="bg-surface rounded-xl border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">Filtres</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
          <div>
            <label htmlFor="pv-start" className="block text-xs text-muted mb-1">Du</label>
            <input id="pv-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-2 py-1.5 bg-surface-dark border border-border rounded-lg text-xs" />
          </div>
          <div>
            <label htmlFor="pv-end" className="block text-xs text-muted mb-1">Au</label>
            <input id="pv-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-2 py-1.5 bg-surface-dark border border-border rounded-lg text-xs" />
          </div>
          <div>
            <label htmlFor="pv-clinic" className="block text-xs text-muted mb-1">Cabinet</label>
            <select id="pv-clinic" value={clinicId} onChange={(e) => { setClinicId(e.target.value); setVetId('') }} className="w-full px-2 py-1.5 bg-surface-dark border border-border rounded-lg text-xs">
              <option value="">Tous</option>
              {clinics.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="pv-vet" className="block text-xs text-muted mb-1">Vétérinaire</label>
            <select id="pv-vet" value={vetId} onChange={(e) => setVetId(e.target.value)} className="w-full px-2 py-1.5 bg-surface-dark border border-border rounded-lg text-xs">
              <option value="">Tous</option>
              {filteredVets.map((v) => (
                <option key={v.id} value={v.id}>
                  Dr {v.first_name ? `${v.first_name} ` : ''}{v.last_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pv-type" className="block text-xs text-muted mb-1">Type d&apos;acte</label>
            <select id="pv-type" value={type} onChange={(e) => setType(e.target.value)} className="w-full px-2 py-1.5 bg-surface-dark border border-border rounded-lg text-xs">
              <option value="">Tous</option>
              {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{getHealthTypeLabel(t)}</option>)}
            </select>
          </div>
          <div>
            <label className="flex items-center gap-2 text-xs cursor-pointer mt-5">
              <input type="checkbox" checked={judicialOnly} onChange={(e) => setJudicialOnly(e.target.checked)} />
              <span>⚖️ Procédure uniquement</span>
            </label>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <button type="button" onClick={applyFilters} className="px-3 py-1.5 rounded-lg gradient-primary text-white text-xs font-semibold hover:opacity-90">
            Appliquer
          </button>
          <button type="button" onClick={exportCsv} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-surface-hover transition-colors">
            <FileDown className="w-3 h-3" />
            Export CSV
          </button>
          <a href={pdfHref()} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-surface-hover transition-colors">
            <Printer className="w-3 h-3" />
            Imprimer / PDF
          </a>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface rounded-xl border border-border p-5">
          <div className="text-xs uppercase text-muted">Total passages</div>
          <div className="text-2xl font-bold mt-1">{stats.count}</div>
        </div>
        <div className="bg-surface rounded-xl border border-border p-5">
          <div className="text-xs uppercase text-muted">Coût total</div>
          <div className="text-2xl font-bold mt-1">{formatCurrency(stats.totalCost)}</div>
        </div>
        <div className="bg-surface rounded-xl border border-border p-5">
          <div className="text-xs uppercase text-muted mb-2">Par vétérinaire</div>
          {Object.keys(stats.byVet).length === 0 ? (
            <div className="text-xs text-muted">—</div>
          ) : (
            <ul className="space-y-1 text-xs">
              {Object.entries(stats.byVet).slice(0, 4).map(([k, v]) => (
                <li key={k} className="flex justify-between">
                  <span className="truncate mr-2">{v.name}</span>
                  <span className="font-medium whitespace-nowrap">{v.count} • {formatCurrency(v.cost)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        {passages.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">Aucun passage vétérinaire avec ces filtres</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-dark">
                <tr className="text-left text-xs uppercase text-muted">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Animal</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2">Vétérinaire</th>
                  <th className="px-3 py-2">Coût</th>
                  <th className="px-3 py-2">Procédure</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {passages.map((p) => (
                  <tr key={p.id} className={p.judicial_procedure ? 'bg-error/5' : 'hover:bg-surface-hover'}>
                    <td className="px-3 py-2 whitespace-nowrap text-xs">
                      {new Date(p.date).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-3 py-2">
                      <Link href={`/animals/${p.animal_id}`} className="hover:text-primary hover:underline">
                        <div className="font-medium">{p.animal_name}</div>
                        {p.animal_medal && <div className="text-xs text-muted">M. {p.animal_medal}</div>}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <span className="inline-block px-2 py-0.5 rounded bg-primary/10 text-primary">
                        {getHealthTypeLabel(p.type)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs max-w-md">
                      <div className="line-clamp-2">{p.description}</div>
                      {p.judicial_procedure && p.invoice_reference && (
                        <div className="text-xs text-muted mt-0.5">Réf : {p.invoice_reference}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <div>{vetDisplayName(p)}</div>
                      {p.clinic_name && <div className="text-muted">{p.clinic_name}</div>}
                    </td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap font-medium">
                      {p.cost !== null ? formatCurrency(Number(p.cost)) : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {p.judicial_procedure && (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-error/15 text-error">
                          ⚖️ {p.billed_to ? 'Facturé : ' + p.billed_to : 'Procédure'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function vetDisplayName(p: PassageVeto): string {
  if (!p.vet_last_name) return '—'
  return `Dr ${p.vet_first_name ? `${p.vet_first_name} ` : ''}${p.vet_last_name}`
}
