'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Stethoscope, Plus, Loader2 } from 'lucide-react'
import { getVeterinaryClinics } from '@/lib/actions/veterinarians'
import type { VeterinaryClinicWithVets } from '@/lib/types/database'

interface VeterinarianSelectProps {
  value: string | null
  onChange: (vetId: string | null, displayName: string | null) => void
  inputClass: string
  labelClass: string
  label?: string
  required?: boolean
  id?: string
}

function formatVetName(vet: { first_name: string | null; last_name: string }): string {
  return vet.first_name ? `${vet.first_name} ${vet.last_name}` : `Dr ${vet.last_name}`
}

export function VeterinarianSelect({
  value,
  onChange,
  inputClass,
  labelClass,
  label = 'Veterinaire',
  required = false,
  id = 'vet-select',
}: Readonly<VeterinarianSelectProps>) {
  const [clinics, setClinics] = useState<VeterinaryClinicWithVets[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    getVeterinaryClinics(true).then((result) => {
      setIsLoading(false)
      if (result.data) setClinics(result.data)
    })
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const vetId = e.target.value
    if (!vetId) {
      onChange(null, null)
      return
    }
    for (const clinic of clinics) {
      const vet = clinic.veterinarians.find((v) => v.id === vetId)
      if (vet) {
        onChange(vetId, `${formatVetName(vet)} (${clinic.name})`)
        return
      }
    }
  }

  const totalVets = clinics.reduce((sum, c) => sum + c.veterinarians.length, 0)

  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        <span className="inline-flex items-center gap-1">
          <Stethoscope className="w-3 h-3" />
          {label}
        </span>
      </label>

      {isLoading && (
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted">
          <Loader2 className="w-3 h-3 animate-spin" />
          Chargement des veterinaires...
        </div>
      )}

      {!isLoading && totalVets === 0 && (
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-xs">
          <p className="text-warning font-medium mb-1">Aucun veterinaire enregistre</p>
          <Link href="/etablissement/veterinaires" className="inline-flex items-center gap-1 text-primary hover:underline">
            <Plus className="w-3 h-3" />
            Ajouter une clinique et des praticiens
          </Link>
        </div>
      )}

      {!isLoading && totalVets > 0 && (
        <>
          <select
            id={id}
            value={value || ''}
            onChange={handleChange}
            required={required}
            className={inputClass}
          >
            <option value="">Selectionner un veterinaire...</option>
            {clinics.map((clinic) => (
              <optgroup key={clinic.id} label={clinic.name + (clinic.city ? ` — ${clinic.city}` : '')}>
                {clinic.veterinarians.map((vet) => (
                  <option key={vet.id} value={vet.id}>
                    {formatVetName(vet)}
                    {vet.specialty ? ` — ${vet.specialty}` : ''}
                    {vet.is_referent ? ' ★' : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <Link
            href="/etablissement/veterinaires"
            className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-primary mt-1 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Gerer les cliniques et praticiens
          </Link>
        </>
      )}
    </div>
  )
}
