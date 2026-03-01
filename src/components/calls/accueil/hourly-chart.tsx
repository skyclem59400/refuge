'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { RingoverHourlyData } from '@/lib/types/database'

interface HourlyChartProps {
  data: RingoverHourlyData[]
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; dataKey: string; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-border rounded-lg p-3 shadow-lg text-xs">
      <p className="font-semibold mb-1">{label}h</p>
      {payload.map((e) => (
        <p key={e.dataKey} style={{ color: e.color }}>{e.dataKey === 'answered' ? 'Repondus' : 'Manques'}: {e.value}</p>
      ))}
    </div>
  )
}

export function HourlyChart({ data }: HourlyChartProps) {
  const filtered = data.filter((d) => d.total > 0 || (d.hour >= 8 && d.hour <= 19))
  const chartData = filtered.map((d) => ({ hour: `${d.hour}h`, answered: d.answered, missed: d.missed }))
  const peak = [...data].sort((a, b) => b.total - a.total)[0]
  const peakMissed = [...data].sort((a, b) => b.missed - a.missed)[0]

  return (
    <div className="bg-surface rounded-xl border border-border p-5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-4">Repartition horaire</h3>
      {chartData.length === 0 ? (
        <p className="text-sm text-muted text-center py-8">Aucune donnee</p>
      ) : (
        <>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="hour" tick={{ fill: 'var(--color-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--color-border)' }} />
                <YAxis tick={{ fill: 'var(--color-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--color-border)' }} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="answered" fill="#22c55e" radius={[2, 2, 0, 0]} stackId="calls" />
                <Bar dataKey="missed" fill="#ef4444" radius={[2, 2, 0, 0]} stackId="calls" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {peak && (
            <div className="mt-3 flex gap-4 text-xs text-muted">
              <span>Heure de pointe : <strong className="text-text">{peak.hour}h</strong> ({peak.total} appels)</span>
              {peakMissed && peakMissed.missed > 0 && (
                <span>Plus de manques : <strong className="text-error">{peakMissed.hour}h</strong> ({peakMissed.missed})</span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
