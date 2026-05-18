'use client'

import { useState } from 'react'
import { FileText } from 'lucide-react'
import type { EstablishmentMember } from '@/lib/types/database'

const MONTHS = [
  'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre',
]

interface Props {
  readonly members: EstablishmentMember[]
}

function memberLabel(m: EstablishmentMember): string {
  return m.full_name || m.pseudo || m.email || 'Membre'
}

export function CraLauncher({ members }: Props) {
  const now = new Date()
  const [memberId, setMemberId] = useState(members[0]?.id || '')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const eligibleMembers = members.filter(
    (m) => m.contract_type === 'salarie' || m.contract_type === 'auto_entrepreneur'
  )

  function handleOpen() {
    if (!memberId) return
    window.open(`/api/pdf/cra/${memberId}/${year}/${month}`, '_blank')
  }

  const yearOptions: number[] = []
  for (let y = now.getFullYear() + 1; y >= now.getFullYear() - 3; y--) yearOptions.push(y)

  return (
    <div className="bg-surface-dark/60 rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-bold text-text">Generer un CRA mensuel</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <select
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
          className="px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary md:col-span-2"
        >
          <option value="">— Collaborateur —</option>
          {eligibleMembers.map((m) => (
            <option key={m.id} value={m.id}>
              {memberLabel(m)}
            </option>
          ))}
        </select>
        <select
          value={month}
          onChange={(e) => setMonth(parseInt(e.target.value, 10))}
          className="px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary"
        >
          {MONTHS.map((label, idx) => (
            <option key={idx} value={idx + 1}>{label}</option>
          ))}
        </select>
        <select
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value, 10))}
          className="px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary"
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
      <button
        onClick={handleOpen}
        disabled={!memberId}
        className="w-full px-3 py-2 rounded-lg font-semibold text-white text-sm bg-primary hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Ouvrir le CRA (PDF)
      </button>
      <p className="text-[11px] text-muted">
        Le CRA agrege presences et absences sur le mois (jours, demi-journees, heures) avec ventilation par type.
      </p>
    </div>
  )
}
