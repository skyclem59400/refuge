'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

interface Props {
  data: { name: string; value: number; color: string }[]
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number; payload: { color: string } }[] }) {
  if (!active || !payload?.length) return null
  const entry = payload[0]
  return (
    <div className="bg-surface border border-border rounded-lg p-3 shadow-lg">
      <div className="flex items-center gap-2 text-sm">
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.payload.color }} />
        <span className="text-muted">{entry.name}</span>
        <span className="font-semibold ml-auto">{entry.value}</span>
      </div>
    </div>
  )
}

export function AnimalsBySpeciesChart({ data }: Props) {
  if (data.length === 0) {
    return <div className="flex items-center justify-center h-[300px] text-muted text-sm">Aucune donnee</div>
  }

  const total = data.reduce((sum, d) => sum + d.value, 0)

  return (
    <div>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={5}
            dataKey="value"
            nameKey="name"
          >
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      {/* Legend */}
      <div className="flex justify-center gap-6 mt-2">
        {data.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2 text-sm">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-muted">{entry.name}</span>
            <span className="font-semibold">{entry.value}</span>
            <span className="text-muted text-xs">({Math.round(entry.value / total * 100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  )
}
