'use client'

import { useRouter } from 'next/navigation'

interface YearFilterProps {
  selectedYear: number
  yearOptions: number[]
}

export function YearFilter({ selectedYear, yearOptions }: YearFilterProps) {
  const router = useRouter()

  return (
    <select
      name="year"
      defaultValue={selectedYear}
      onChange={(e) => {
        router.push(`/donations?year=${e.target.value}`)
      }}
      className="rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
    >
      {yearOptions.map((y) => (
        <option key={y} value={y}>{y}</option>
      ))}
    </select>
  )
}
