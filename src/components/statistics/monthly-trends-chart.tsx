'use client'

import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface Movement {
  type: string
  date: string
}

interface Props {
  movements: Movement[]
}

const MOVEMENT_COLORS: Record<string, string> = {
  adoptions: '#22c55e',
  entrees: '#f59e0b',
  transferts: '#3b82f6',
}

const MOVEMENT_LABELS: Record<string, string> = {
  adoptions: 'Adoptions',
  entrees: 'Entrees fourriere',
  transferts: 'Transferts refuge',
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; dataKey: string; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-border rounded-lg p-3 shadow-lg">
      <p className="text-sm font-semibold mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-sm">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted">{MOVEMENT_LABELS[entry.dataKey] || entry.dataKey}</span>
          <span className="font-medium ml-auto">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

export function MonthlyTrendsChart({ movements }: Props) {
  const chartData = useMemo(() => {
    const now = new Date()
    const months: Record<string, { adoptions: number; entrees: number; transferts: number }> = {}

    // Initialize 12 months
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      months[key] = { adoptions: 0, entrees: 0, transferts: 0 }
    }

    // Count movements by month
    for (const m of movements) {
      const d = new Date(m.date)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!months[key]) continue

      if (m.type === 'adoption') months[key].adoptions++
      else if (m.type === 'pound_entry') months[key].entrees++
      else if (m.type === 'shelter_transfer') months[key].transferts++
    }

    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => {
        const [year, month] = key.split('-')
        const d = new Date(Number(year), Number(month) - 1)
        const label = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
        return { label, ...val }
      })
  }, [movements])

  if (chartData.length === 0) {
    return <div className="flex items-center justify-center h-[300px] text-muted text-sm">Aucune donnee</div>
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }} barCategoryGap="20%">
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: 'var(--color-muted)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          dy={8}
        />
        <YAxis
          tick={{ fill: 'var(--color-muted)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
          width={30}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--color-border)', opacity: 0.3 }} />
        <Legend
          formatter={(value: string) => <span className="text-xs text-muted">{MOVEMENT_LABELS[value] || value}</span>}
        />
        <Bar dataKey="adoptions" fill={MOVEMENT_COLORS.adoptions} fillOpacity={0.85} radius={[4, 4, 0, 0]} />
        <Bar dataKey="entrees" fill={MOVEMENT_COLORS.entrees} fillOpacity={0.85} radius={[4, 4, 0, 0]} />
        <Bar dataKey="transferts" fill={MOVEMENT_COLORS.transferts} fillOpacity={0.85} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
