'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { RingoverDailyData } from '@/lib/types/database'

interface DailyTrendChartProps {
  data: RingoverDailyData[]
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; dataKey: string; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-border rounded-lg p-3 shadow-lg text-xs">
      <p className="font-semibold mb-1">{label ? new Date(label).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''}</p>
      {payload.map((e) => (
        <p key={e.dataKey} style={{ color: e.color }}>{e.dataKey === 'answered' ? 'Repondus' : 'Manques'}: {e.value}</p>
      ))}
    </div>
  )
}

export function DailyTrendChart({ data }: DailyTrendChartProps) {
  const chartData = data.map((d) => ({
    date: d.date,
    label: new Date(d.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
    answered: d.answered,
    missed: d.missed,
  }))

  const recent = data.slice(-7)
  const older = data.slice(-14, -7)
  const recentMissedRate = recent.length > 0
    ? recent.reduce((s, d) => s + d.missed, 0) / Math.max(recent.reduce((s, d) => s + d.total, 0), 1)
    : 0
  const olderMissedRate = older.length > 0
    ? older.reduce((s, d) => s + d.missed, 0) / Math.max(older.reduce((s, d) => s + d.total, 0), 1)
    : 0
  const improving = recentMissedRate < olderMissedRate

  return (
    <div className="bg-surface rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Tendance quotidienne</h3>
        {data.length >= 14 && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${improving ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
            {improving ? 'En amelioration' : 'En degradation'}
          </span>
        )}
      </div>
      {chartData.length === 0 ? (
        <p className="text-sm text-muted text-center py-8">Aucune donnee</p>
      ) : (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="label" tick={{ fill: 'var(--color-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--color-border)' }} />
              <YAxis tick={{ fill: 'var(--color-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--color-border)' }} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="answered" fill="#22c55e20" stroke="#22c55e" strokeWidth={2} />
              <Area type="monotone" dataKey="missed" fill="#ef444420" stroke="#ef4444" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
