'use client'

import { ClipboardList, Check, TrendingUp, Users, Calendar } from 'lucide-react'
import { formatDateShort } from '@/lib/utils'

interface PersonAssignmentStat {
  userId: string
  assigned: number
  completed: number
  rate: number
}

interface DayAssignmentStat {
  date: string
  assigned: number
  completed: number
  delta: number
}

interface AssignmentStatsProps {
  perPerson: PersonAssignmentStat[]
  perDay: DayAssignmentStat[]
  totalAssigned: number
  totalCompleted: number
  completionRate: number
  userNames: Record<string, string>
}

function getRateColorClass(rate: number): string {
  if (rate >= 80) return 'text-success'
  if (rate >= 50) return 'text-warning'
  return 'text-error'
}

function getRateBadgeClasses(rate: number): string {
  if (rate >= 80) return 'bg-success/10 text-success'
  if (rate >= 50) return 'bg-warning/10 text-warning'
  return 'bg-error/10 text-error'
}

export function AssignmentStats({
  perPerson,
  perDay,
  totalAssigned,
  totalCompleted,
  completionRate,
  userNames,
}: Readonly<AssignmentStatsProps>) {
  const sortedPerPerson = [...perPerson].sort((a, b) => b.rate - a.rate)

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-surface rounded-xl border border-border p-4 text-center">
          <ClipboardList className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="text-2xl font-bold">{totalAssigned}</p>
          <p className="text-xs text-muted mt-1">Assignees</p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4 text-center">
          <Check className="w-5 h-5 text-success mx-auto mb-1" />
          <p className="text-2xl font-bold">{totalCompleted}</p>
          <p className="text-xs text-muted mt-1">Realisees</p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4 text-center">
          <TrendingUp className="w-5 h-5 mx-auto mb-1" />
          <p className={`text-2xl font-bold ${getRateColorClass(completionRate)}`}>
            {completionRate}%
          </p>
          <p className="text-xs text-muted mt-1">Taux de completion</p>
        </div>
      </div>

      {/* Per person table */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Par personne
          </h3>
        </div>
        {sortedPerPerson.length === 0 ? (
          <p className="text-muted text-sm text-center py-4">Aucune donnee</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left">
              <tr>
                <th className="px-4 py-3 font-semibold text-muted">Nom</th>
                <th className="px-4 py-3 font-semibold text-muted">Assignees</th>
                <th className="px-4 py-3 font-semibold text-muted">Realisees</th>
                <th className="px-4 py-3 font-semibold text-muted">Taux</th>
              </tr>
            </thead>
            <tbody>
              {sortedPerPerson.map((person) => (
                <tr key={person.userId} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-3 text-text">
                    {userNames[person.userId] || 'Inconnu'}
                  </td>
                  <td className="px-4 py-3 text-text">{person.assigned}</td>
                  <td className="px-4 py-3 text-text">{person.completed}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getRateBadgeClasses(person.rate)}`}
                    >
                      {person.rate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Per day table */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            14 derniers jours
          </h3>
        </div>
        {perDay.length === 0 ? (
          <p className="text-muted text-sm text-center py-4">Aucune donnee</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left">
              <tr>
                <th className="px-4 py-3 font-semibold text-muted">Date</th>
                <th className="px-4 py-3 font-semibold text-muted">Assignees</th>
                <th className="px-4 py-3 font-semibold text-muted">Realisees</th>
                <th className="px-4 py-3 font-semibold text-muted">Delta</th>
              </tr>
            </thead>
            <tbody>
              {perDay.map((day) => (
                <tr key={day.date} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-3 text-text">{formatDateShort(day.date)}</td>
                  <td className="px-4 py-3 text-text">{day.assigned}</td>
                  <td className="px-4 py-3 text-text">{day.completed}</td>
                  <td className={`px-4 py-3 font-medium ${day.delta >= 0 ? 'text-success' : 'text-error'}`}>
                    {day.delta >= 0 ? '+' : ''}{day.delta}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
