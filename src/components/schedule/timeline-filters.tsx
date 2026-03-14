'use client'

import { useState, useMemo } from 'react'
import { Filter, ChevronDown, ChevronUp } from 'lucide-react'

export interface TimelineFilters {
  showSchedules: boolean
  appointmentTypes: Set<string>
  userIds: Set<string>
}

interface TimelineFiltersProps {
  allAppointmentTypes: string[]
  allUsers: Array<{ id: string; name: string }>
  filters: TimelineFilters
  onFiltersChange: (filters: TimelineFilters) => void
}

export function TimelineFiltersComponent({
  allAppointmentTypes,
  allUsers,
  filters,
  onFiltersChange,
}: Readonly<TimelineFiltersProps>) {
  const [isExpanded, setIsExpanded] = useState(false)

  const toggleSchedules = () => {
    onFiltersChange({
      ...filters,
      showSchedules: !filters.showSchedules,
    })
  }

  const toggleAppointmentType = (type: string) => {
    const newTypes = new Set(filters.appointmentTypes)
    if (newTypes.has(type)) {
      newTypes.delete(type)
    } else {
      newTypes.add(type)
    }
    onFiltersChange({
      ...filters,
      appointmentTypes: newTypes,
    })
  }

  const toggleUser = (userId: string) => {
    const newUsers = new Set(filters.userIds)
    if (newUsers.has(userId)) {
      newUsers.delete(userId)
    } else {
      newUsers.add(userId)
    }
    onFiltersChange({
      ...filters,
      userIds: newUsers,
    })
  }

  const clearAllFilters = () => {
    onFiltersChange({
      showSchedules: true,
      appointmentTypes: new Set(allAppointmentTypes),
      userIds: new Set(allUsers.map((u) => u.id)),
    })
  }

  const selectAllFilters = () => {
    clearAllFilters()
  }

  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (!filters.showSchedules) count++
    if (filters.appointmentTypes.size < allAppointmentTypes.length) {
      count += allAppointmentTypes.length - filters.appointmentTypes.size
    }
    if (filters.userIds.size < allUsers.length) {
      count += allUsers.length - filters.userIds.size
    }
    return count
  }, [filters, allAppointmentTypes.length, allUsers.length])

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'adoption':
        return 'text-green-700 bg-green-500/10 border-green-500/30'
      case 'veterinary':
        return 'text-orange-700 bg-orange-500/10 border-orange-500/30'
      default:
        return 'text-primary bg-primary/10 border-primary/30'
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'adoption':
        return 'Adoption'
      case 'veterinary':
        return 'Vétérinaire'
      default:
        return type.charAt(0).toUpperCase() + type.slice(1)
    }
  }

  return (
    <div className="bg-surface rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-surface-hover transition-colors"
      >
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-primary" />
          <span className="font-medium text-sm">Filtres</span>
          {activeFiltersCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-medium">
              {activeFiltersCount} masqué{activeFiltersCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-muted" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted" />
        )}
      </button>

      {/* Filter content */}
      {isExpanded && (
        <div className="border-t border-border p-4 space-y-4">
          {/* Quick actions */}
          <div className="flex gap-2">
            <button
              onClick={selectAllFilters}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              Tout afficher
            </button>
            <button
              onClick={clearAllFilters}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-hover text-muted hover:bg-border transition-colors"
            >
              Réinitialiser
            </button>
          </div>

          {/* Planning du personnel */}
          <div>
            <p className="text-xs font-semibold text-muted mb-2">Planning du personnel</p>
            <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-hover transition-colors cursor-pointer">
              <input
                type="checkbox"
                checked={filters.showSchedules}
                onChange={toggleSchedules}
                className="w-4 h-4 rounded border-border text-primary focus:ring-2 focus:ring-primary/20"
              />
              <span className="text-sm">Afficher les plannings</span>
            </label>
          </div>

          {/* Types de rendez-vous */}
          {allAppointmentTypes.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted mb-2">Types de rendez-vous</p>
              <div className="space-y-1">
                {allAppointmentTypes.map((type) => (
                  <label
                    key={type}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-hover transition-colors cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={filters.appointmentTypes.has(type)}
                      onChange={() => toggleAppointmentType(type)}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-2 focus:ring-primary/20"
                    />
                    <span
                      className={`text-xs px-2 py-0.5 rounded border ${getTypeColor(type)}`}
                    >
                      {getTypeLabel(type)}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Collaborateurs */}
          {allUsers.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted mb-2">Collaborateurs</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {allUsers.map((user) => (
                  <label
                    key={user.id}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-hover transition-colors cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={filters.userIds.has(user.id)}
                      onChange={() => toggleUser(user.id)}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-2 focus:ring-primary/20"
                    />
                    <span className="text-sm truncate">{user.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
