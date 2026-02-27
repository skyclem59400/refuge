'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Facebook, Instagram } from 'lucide-react'
import { getSocialPostStatusColor } from '@/lib/sda-utils'
import type { SocialPost } from '@/lib/types/database'

type PostWithAnimal = SocialPost & {
  animals?: { id: string; name: string; species: string; photo_url: string | null } | null
}

interface PublicationsCalendarProps {
  posts: PostWithAnimal[]
}

const FRENCH_MONTHS = [
  'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre',
]

const FRENCH_DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

function getSpeciesEmoji(species: string): string {
  return species === 'cat' ? '🐱' : species === 'dog' ? '🐶' : '🐾'
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay()
  // Convert Sunday=0 to Monday-based (Mon=0, Sun=6)
  return day === 0 ? 6 : day - 1
}

export function PublicationsCalendar({ posts }: PublicationsCalendarProps) {
  const today = new Date()
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())

  function goToPrevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear(currentYear - 1)
    } else {
      setCurrentMonth(currentMonth - 1)
    }
  }

  function goToNextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear(currentYear + 1)
    } else {
      setCurrentMonth(currentMonth + 1)
    }
  }

  // Group posts by date
  const postsByDate = useMemo(() => {
    const map = new Map<string, PostWithAnimal[]>()
    for (const post of posts) {
      const dateStr = post.scheduled_at || post.published_at || post.created_at
      if (!dateStr) continue
      const d = new Date(dateStr)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(post)
    }
    return map
  }, [posts])

  const daysInMonth = getDaysInMonth(currentYear, currentMonth)
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth)

  // Previous month days
  const prevMonthDays = getDaysInMonth(
    currentMonth === 0 ? currentYear - 1 : currentYear,
    currentMonth === 0 ? 11 : currentMonth - 1
  )

  // Build 6 rows x 7 cols
  const cells: { day: number; month: number; year: number; isCurrentMonth: boolean }[] = []

  // Fill days from previous month
  for (let i = firstDay - 1; i >= 0; i--) {
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear
    cells.push({ day: prevMonthDays - i, month: prevMonth, year: prevYear, isCurrentMonth: false })
  }

  // Fill current month days
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, month: currentMonth, year: currentYear, isCurrentMonth: true })
  }

  // Fill next month days to complete the grid (6 rows = 42 cells)
  const remaining = 42 - cells.length
  const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1
  const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear
  for (let d = 1; d <= remaining; d++) {
    cells.push({ day: d, month: nextMonth, year: nextYear, isCurrentMonth: false })
  }

  const isToday = (cell: typeof cells[0]) =>
    cell.day === today.getDate() && cell.month === today.getMonth() && cell.year === today.getFullYear()

  return (
    <div className="bg-surface rounded-xl border border-border p-5">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goToPrevMonth}
          className="p-2 rounded-lg hover:bg-surface-hover transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h3 className="text-lg font-semibold">
          {FRENCH_MONTHS[currentMonth]} {currentYear}
        </h3>
        <button
          onClick={goToNextMonth}
          className="p-2 rounded-lg hover:bg-surface-hover transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-px mb-1">
        {FRENCH_DAYS.map((day) => (
          <div key={day} className="text-center text-xs font-semibold uppercase tracking-wider text-muted py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-px">
        {cells.map((cell, idx) => {
          const dateKey = `${cell.year}-${String(cell.month + 1).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`
          const dayPosts = postsByDate.get(dateKey) || []
          const todayClass = isToday(cell)

          return (
            <div
              key={idx}
              className={`min-h-[80px] p-1 border border-border/50 rounded-lg ${
                cell.isCurrentMonth ? 'bg-surface' : 'bg-surface-hover/50 opacity-50'
              } ${todayClass ? 'ring-2 ring-primary/50' : ''}`}
            >
              <div className={`text-xs font-medium mb-1 ${
                todayClass ? 'text-primary font-bold' : cell.isCurrentMonth ? 'text-text' : 'text-muted'
              }`}>
                {cell.day}
              </div>
              <div className="space-y-0.5">
                {dayPosts.slice(0, 3).map((post) => {
                  const statusColor = getSocialPostStatusColor(post.status)
                  const label = post.animals?.name
                    ? `${getSpeciesEmoji(post.animals.species)} ${post.animals.name}`
                    : post.type
                  return (
                    <div
                      key={post.id}
                      className={`flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] truncate ${statusColor}`}
                      title={post.content.slice(0, 60)}
                    >
                      {(post.platform === 'facebook' || post.platform === 'both') && (
                        <Facebook className="w-2.5 h-2.5 shrink-0" />
                      )}
                      {(post.platform === 'instagram' || post.platform === 'both') && (
                        <Instagram className="w-2.5 h-2.5 shrink-0" />
                      )}
                      <span className="truncate">{label}</span>
                    </div>
                  )
                })}
                {dayPosts.length > 3 && (
                  <div className="text-[10px] text-muted px-1">
                    +{dayPosts.length - 3} autres
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
