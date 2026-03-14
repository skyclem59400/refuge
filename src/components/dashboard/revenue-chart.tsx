'use client'

import { useState, useMemo } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'

interface Invoice {
  date: string   // ISO date e.g. '2026-01-15'
  total: number
  status: 'paid' | 'sent'
}

type TimeScale = 'day' | 'week' | 'month'
type ChartType = 'area' | 'bar'

interface RevenueChartProps {
  invoices: Invoice[]
}

interface ChartCommonProps {
  hiddenSeries: Set<string>
  toggleSeries: (key: string) => void
}

const COLORS = {
  paye: '#22c55e',
  attente: '#f59e0b',
}

const scales = [
  { value: 'day' as const, label: 'Jours' },
  { value: 'week' as const, label: 'Semaines' },
  { value: 'month' as const, label: 'Mois' },
]

const chartTypes = [
  { value: 'area' as const, label: 'Courbe' },
  { value: 'bar' as const, label: 'Histogramme' },
]

function CustomTooltip({
  active,
  payload,
  label,
}: Readonly<{
  active?: boolean
  payload?: { value: number; dataKey: string; color: string }[]
  label?: string
}>) {
  if (!active || !payload?.length) return null

  return (
    <div className="bg-surface border border-border rounded-lg p-3 shadow-lg">
      <p className="text-sm font-semibold mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-sm">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted">
            {entry.dataKey === 'caPaye' ? 'Paye' : 'En attente'}
          </span>
          <span className="font-medium ml-auto">{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

const SERIES_LABELS: Record<string, string> = {
  caPaye: 'CA paye',
  caEnAttente: 'CA en attente',
}

function CustomLegend({
  payload,
  hiddenSeries,
  onToggle,
}: Readonly<{
  payload?: { value: string; color: string }[]
  hiddenSeries: Set<string>
  onToggle: (key: string) => void
}>) {
  if (!payload?.length) return null

  return (
    <div className="flex justify-center gap-6 mt-2">
      {payload.map((entry) => {
        const hidden = hiddenSeries.has(entry.value)
        return (
          <button
            key={entry.value}
            type="button"
            onClick={() => onToggle(entry.value)}
            className={`flex items-center gap-2 text-sm transition-opacity ${
              hidden ? 'opacity-35' : 'opacity-100'
            }`}
          >
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted">{SERIES_LABELS[entry.value] ?? entry.value}</span>
          </button>
        )
      })}
    </div>
  )
}

function getGroupKey(date: Date, rawDate: string, scale: TimeScale): string {
  if (scale === 'day') return rawDate
  if (scale === 'week') {
    const day = date.getDay()
    const diff = date.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(date.getFullYear(), date.getMonth(), diff)
    return monday.toISOString().split('T')[0]
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function fillTimeGaps(
  grouped: Record<string, { caPaye: number; caEnAttente: number }>,
  scale: TimeScale
): void {
  if (scale !== 'day' && scale !== 'week') return

  const keys = Object.keys(grouped).sort((a, b) => a.localeCompare(b))
  if (keys.length < 2) return

  const start = new Date(keys[0])
  const end = new Date(keys[keys.length - 1])
  const stepDays = scale === 'day' ? 1 : 7
  const cursor = new Date(start)
  while (cursor <= end) {
    const key = cursor.toISOString().split('T')[0]
    if (!grouped[key]) grouped[key] = { caPaye: 0, caEnAttente: 0 }
    cursor.setDate(cursor.getDate() + stepDays)
  }
}

function formatGroupLabel(key: string, scale: TimeScale): string {
  if (scale === 'day') {
    const d = new Date(key)
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }
  if (scale === 'week') {
    const d = new Date(key)
    return `Sem. ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
  }
  const [year, month] = key.split('-')
  const d = new Date(Number(year), Number(month) - 1)
  return d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
}

function formatYAxisValue(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    notation: 'compact',
    compactDisplay: 'short',
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

function getXAxisProps(scale: TimeScale) {
  return {
    dataKey: 'label' as const,
    tick: { fill: 'var(--color-muted)', fontSize: 11 },
    axisLine: false,
    tickLine: false,
    interval: scale === 'day' ? ('preserveStartEnd' as const) : (0 as const),
    angle: scale === 'day' ? -40 : 0,
    textAnchor: (scale === 'day' ? 'end' : 'middle') as 'end' | 'middle',
    height: scale === 'day' ? 70 : 35,
    dy: 8,
  }
}

const yAxisProps = {
  tick: { fill: 'var(--color-muted)', fontSize: 11 },
  axisLine: false,
  tickLine: false,
  tickFormatter: formatYAxisValue,
  width: 70,
}

function RevenueAreaChart({ chartData, scale, hiddenSeries, toggleSeries }: { chartData: { label: string; caPaye: number; caEnAttente: number }[]; scale: TimeScale } & ChartCommonProps) {
  return (
    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
      <defs>
        <linearGradient id="gradientPaye" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={COLORS.paye} stopOpacity={0.3} />
          <stop offset="95%" stopColor={COLORS.paye} stopOpacity={0.05} />
        </linearGradient>
        <linearGradient id="gradientAttente" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={COLORS.attente} stopOpacity={0.3} />
          <stop offset="95%" stopColor={COLORS.attente} stopOpacity={0.05} />
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
      <XAxis {...getXAxisProps(scale)} />
      <YAxis {...yAxisProps} />
      <Tooltip content={<CustomTooltip />} />
      <Legend content={<CustomLegend hiddenSeries={hiddenSeries} onToggle={toggleSeries} />} />
      <Area type="monotone" dataKey="caPaye" stroke={COLORS.paye} strokeWidth={2} fill="url(#gradientPaye)" name="caPaye" hide={hiddenSeries.has('caPaye')} />
      <Area type="monotone" dataKey="caEnAttente" stroke={COLORS.attente} strokeWidth={2} fill="url(#gradientAttente)" name="caEnAttente" hide={hiddenSeries.has('caEnAttente')} />
    </AreaChart>
  )
}

function RevenueBarChart({ chartData, scale, hiddenSeries, toggleSeries }: { chartData: { label: string; caPaye: number; caEnAttente: number }[]; scale: TimeScale } & ChartCommonProps) {
  return (
    <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }} barCategoryGap="30%" barGap={0}>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
      <XAxis {...getXAxisProps(scale)} />
      <YAxis {...yAxisProps} />
      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--color-border)', opacity: 0.3 }} />
      <Legend content={<CustomLegend hiddenSeries={hiddenSeries} onToggle={toggleSeries} />} />
      <Bar dataKey="caPaye" fill={COLORS.paye} fillOpacity={0.85} name="caPaye" radius={[4, 4, 0, 0]} hide={hiddenSeries.has('caPaye')} />
      <Bar dataKey="caEnAttente" fill={COLORS.attente} fillOpacity={0.85} name="caEnAttente" radius={[4, 4, 0, 0]} hide={hiddenSeries.has('caEnAttente')} />
    </BarChart>
  )
}

function buildChartData(invoices: Invoice[], scale: TimeScale) {
  if (invoices.length === 0) return []

  const grouped: Record<string, { caPaye: number; caEnAttente: number }> = {}

  for (const inv of invoices) {
    const d = new Date(inv.date)
    const key = getGroupKey(d, inv.date, scale)
    if (!grouped[key]) grouped[key] = { caPaye: 0, caEnAttente: 0 }
    if (inv.status === 'paid') grouped[key].caPaye += inv.total
    else grouped[key].caEnAttente += inv.total
  }

  fillTimeGaps(grouped, scale)

  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => ({
      label: formatGroupLabel(key, scale),
      caPaye: val.caPaye,
      caEnAttente: val.caEnAttente,
    }))
}

export function RevenueChart({ invoices }: Readonly<RevenueChartProps>) {
  const [scale, setScale] = useState<TimeScale>('month')
  const [chartType, setChartType] = useState<ChartType>('area')
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set())

  const toggleSeries = (key: string) => {
    setHiddenSeries(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const chartData = useMemo(() => buildChartData(invoices, scale), [invoices, scale])

  return (
    <div className="bg-surface rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="font-semibold">Evolution du chiffre d&apos;affaires</h3>
        <div className="flex gap-3">
          <div className="flex gap-1 bg-surface-hover rounded-lg p-1">
            {chartTypes.map(t => (
              <button
                key={t.value}
                onClick={() => setChartType(t.value)}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  chartType === t.value
                    ? 'bg-primary text-white'
                    : 'text-muted hover:text-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1 bg-surface-hover rounded-lg p-1">
            {scales.map(s => (
              <button
                key={s.value}
                onClick={() => setScale(s.value)}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  scale === s.value
                    ? 'bg-primary text-white'
                    : 'text-muted hover:text-foreground'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="flex items-center justify-center h-[300px] text-muted text-sm">
          Aucune donnee disponible pour afficher le graphique.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={350}>
          {chartType === 'area' ? (
            <RevenueAreaChart chartData={chartData} scale={scale} hiddenSeries={hiddenSeries} toggleSeries={toggleSeries} />
          ) : (
            <RevenueBarChart chartData={chartData} scale={scale} hiddenSeries={hiddenSeries} toggleSeries={toggleSeries} />
          )}
        </ResponsiveContainer>
      )}
    </div>
  )
}
