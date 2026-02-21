import Link from 'next/link'
import { HeartPulse, AlertTriangle, Stethoscope, Calendar } from 'lucide-react'
import { getHealthRecords, getUpcomingReminders } from '@/lib/actions/health'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { getHealthTypeLabel } from '@/lib/sda-utils'
import { formatDateShort, formatCurrency } from '@/lib/utils'
import type { HealthRecordType } from '@/lib/types/database'

// ---------------------------------------------------------------------------
// Types for the joined data returned by the server actions
// ---------------------------------------------------------------------------

interface HealthRecordWithAnimal {
  id: string
  animal_id: string
  type: HealthRecordType
  date: string
  description: string
  veterinarian: string | null
  next_due_date: string | null
  cost: number | null
  notes: string | null
  created_by: string | null
  created_at: string
  animals: {
    id: string
    name: string
    species: string
    establishment_id: string
  }
}

// ---------------------------------------------------------------------------
// Health type options for filter
// ---------------------------------------------------------------------------

const healthTypes: { value: string; label: string }[] = [
  { value: '', label: 'Tous les types' },
  { value: 'vaccination', label: 'Vaccination' },
  { value: 'sterilization', label: 'Sterilisation' },
  { value: 'antiparasitic', label: 'Antiparasitaire' },
  { value: 'consultation', label: 'Consultation' },
  { value: 'surgery', label: 'Chirurgie' },
  { value: 'medication', label: 'Medicament' },
  { value: 'behavioral_assessment', label: 'Bilan comportemental' },
]

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function HealthPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; search?: string }>
}) {
  const params = await searchParams
  const ctx = await getEstablishmentContext()

  // Build filters
  const filters: { type?: HealthRecordType } = {}
  if (params.type && params.type !== '') {
    filters.type = params.type as HealthRecordType
  }

  const [recordsResult, remindersResult] = await Promise.all([
    getHealthRecords(filters),
    getUpcomingReminders(),
  ])

  const records = (recordsResult.data as HealthRecordWithAnimal[] | undefined) || []
  const reminders = (remindersResult.data as HealthRecordWithAnimal[] | undefined) || []

  // Optional search by animal name (client-side-like filtering on server)
  const searchTerm = params.search?.toLowerCase() || ''
  const filteredRecords = searchTerm
    ? records.filter((r) => r.animals?.name?.toLowerCase().includes(searchTerm))
    : records

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <HeartPulse className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Sante</h1>
            <p className="text-sm text-muted mt-1">
              Suivi sanitaire global des animaux
            </p>
          </div>
        </div>
      </div>

      {/* Upcoming reminders section */}
      {reminders.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            Rappels a venir (7 prochains jours)
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {reminders.map((reminder) => (
              <div
                key={reminder.id}
                className="rounded-xl border border-warning/30 bg-warning/10 p-4"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <Link
                    href={`/animals/${reminder.animal_id}`}
                    className="font-semibold text-sm hover:text-primary transition-colors"
                  >
                    {reminder.animals?.species === 'cat' ? '\uD83D\uDC31' : '\uD83D\uDC36'}{' '}
                    {reminder.animals?.name}
                  </Link>
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-warning/20 text-warning shrink-0">
                    {getHealthTypeLabel(reminder.type)}
                  </span>
                </div>
                <p className="text-sm text-muted mb-2">{reminder.description}</p>
                <div className="flex items-center gap-1 text-xs text-warning font-medium">
                  <Calendar className="w-3 h-3" />
                  <span>Echeance : {formatDateShort(reminder.next_due_date!)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <form className="mb-6 flex flex-wrap gap-3">
        <select
          name="type"
          defaultValue={params.type || ''}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          {healthTypes.map((ht) => (
            <option key={ht.value} value={ht.value}>
              {ht.label}
            </option>
          ))}
        </select>
        <input
          name="search"
          type="text"
          placeholder="Rechercher par nom d'animal..."
          defaultValue={params.search || ''}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 flex-1 min-w-[200px]"
        />
        <button
          type="submit"
          className="px-4 py-2 rounded-lg font-semibold text-white text-sm gradient-primary hover:opacity-90 transition-opacity"
        >
          Filtrer
        </button>
      </form>

      {/* Records table */}
      {filteredRecords.length === 0 ? (
        <div className="bg-surface rounded-xl border border-border p-8 text-center">
          <HeartPulse className="w-10 h-10 text-muted mx-auto mb-3" />
          <p className="text-muted text-sm">Aucun acte sanitaire enregistre</p>
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 font-semibold text-muted">Type</th>
                  <th className="px-4 py-3 font-semibold text-muted">Animal</th>
                  <th className="px-4 py-3 font-semibold text-muted">Description</th>
                  <th className="px-4 py-3 font-semibold text-muted">Veterinaire</th>
                  <th className="px-4 py-3 font-semibold text-muted text-right">Cout</th>
                  <th className="px-4 py-3 font-semibold text-muted">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-surface-hover transition-colors">
                    {/* Type badge */}
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-info/15 text-info">
                        {getHealthTypeLabel(record.type)}
                      </span>
                    </td>

                    {/* Animal name */}
                    <td className="px-4 py-3">
                      <Link
                        href={`/animals/${record.animal_id}`}
                        className="font-medium hover:text-primary transition-colors"
                      >
                        {record.animals?.species === 'cat' ? '\uD83D\uDC31' : '\uD83D\uDC36'}{' '}
                        {record.animals?.name}
                      </Link>
                    </td>

                    {/* Description */}
                    <td className="px-4 py-3 text-muted max-w-xs truncate">
                      {record.description}
                    </td>

                    {/* Veterinarian */}
                    <td className="px-4 py-3 text-muted">
                      {record.veterinarian ? (
                        <span className="flex items-center gap-1">
                          <Stethoscope className="w-3 h-3" />
                          {record.veterinarian}
                        </span>
                      ) : (
                        <span className="text-muted/50">&mdash;</span>
                      )}
                    </td>

                    {/* Cost */}
                    <td className="px-4 py-3 text-right font-medium">
                      {record.cost != null && record.cost > 0
                        ? formatCurrency(record.cost)
                        : <span className="text-muted/50">&mdash;</span>}
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3 text-muted">
                      {formatDateShort(record.date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
