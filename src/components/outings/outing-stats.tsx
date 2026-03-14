'use client'

import { useState } from 'react'
import { PawPrint, Users, Clock, TrendingUp, Trophy, AlertTriangle, HardHat } from 'lucide-react'
import { formatOutingDuration } from '@/lib/sda-utils'

interface PersonStat {
  userId: string
  count: number
  totalMinutes: number
  avgMinutes: number
}

interface AnimalStat {
  animalId: string
  name: string
  photo_url: string | null
  animal_photos: { id: string; url: string; is_primary: boolean }[]
  count: number
  totalMinutes: number
}

interface TrendPoint {
  label: string
  count: number
  totalMinutes: number
}

interface OutingStatsProps {
  perPerson: PersonStat[]
  perAnimal: AnimalStat[]
  dailyTrend: TrendPoint[]
  weeklyTrend: TrendPoint[]
  monthlyTrend: TrendPoint[]
  totalDuration: number
  totalOutings: number
  avgDuration: number
  tigTotal?: number
  userNames: Record<string, string>
}

type Granularity = 'day' | 'week' | 'month'

const granularityOptions: { key: Granularity; label: string }[] = [
  { key: 'day', label: 'Jour' },
  { key: 'week', label: 'Semaine' },
  { key: 'month', label: 'Mois' },
]

function getAnimalPhoto(animal: Pick<AnimalStat, 'photo_url' | 'animal_photos'>): string | null {
  const primary = animal.animal_photos?.find((p) => p.is_primary)
  if (primary) return primary.url
  if (animal.animal_photos?.length > 0) return animal.animal_photos[0].url
  return animal.photo_url
}

export function OutingStats({
  perPerson,
  perAnimal,
  dailyTrend,
  weeklyTrend,
  monthlyTrend,
  totalDuration,
  totalOutings,
  avgDuration,
  tigTotal = 0,
  userNames,
}: Readonly<OutingStatsProps>) {
  const [granularity, setGranularity] = useState<Granularity>('day')

  const trendDataMap: Record<Granularity, TrendPoint[]> = {
    day: dailyTrend || [],
    week: weeklyTrend || [],
    month: monthlyTrend || [],
  }
  const trendData = trendDataMap[granularity]
  const maxCount = trendData.length > 0 ? Math.max(...trendData.map((t) => t.count), 1) : 1

  return (
    <div className="space-y-6">
      {/* Global KPIs */}
      <div className={`grid gap-4 ${tigTotal > 0 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
        <div className="bg-surface rounded-xl border border-border p-4 text-center">
          <TrendingUp className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="text-2xl font-bold">{totalOutings}</p>
          <p className="text-xs text-muted mt-1">Sorties au total</p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4 text-center">
          <Clock className="w-5 h-5 text-info mx-auto mb-1" />
          <p className="text-2xl font-bold">{formatOutingDuration(totalDuration)}</p>
          <p className="text-xs text-muted mt-1">Temps total</p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4 text-center">
          <Clock className="w-5 h-5 text-success mx-auto mb-1" />
          <p className="text-2xl font-bold">{formatOutingDuration(avgDuration)}</p>
          <p className="text-xs text-muted mt-1">Duree moyenne</p>
        </div>
        {tigTotal > 0 && (
          <div className="bg-surface rounded-xl border border-border p-4 text-center">
            <HardHat className="w-5 h-5 text-amber-500 mx-auto mb-1" />
            <p className="text-2xl font-bold">{tigTotal}</p>
            <p className="text-xs text-muted mt-1">Sorties TIG</p>
          </div>
        )}
      </div>

      {/* Trend chart with granularity selector */}
      <div className="bg-surface rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-5 relative z-10">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Tendance
          </h3>
          <div className="flex gap-1 rounded-lg p-1 border border-border">
            {granularityOptions.map((opt) => (
              <button
                type="button"
                key={opt.key}
                onClick={() => setGranularity(opt.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  granularity === opt.key
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-muted hover:text-text hover:bg-surface-hover'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {!trendData.length || trendData.every((t) => t.count === 0) ? (
          <p className="text-muted text-sm text-center py-4">Aucune donnee</p>
        ) : (
          <div className="flex items-end gap-2 h-44">
            {trendData.map((point, i) => {
              const pct = point.count > 0 ? Math.max((point.count / maxCount) * 100, 6) : 0
              return (
                <div key={`${point.label}-${i}`} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                  {point.count > 0 && (
                    <span className="text-xs font-semibold">{point.count}</span>
                  )}
                  <div className="w-full flex-1 flex items-end">
                    <div
                      className={`w-full rounded-lg transition-all ${
                        point.count > 0 ? 'bg-primary' : 'bg-border/40'
                      }`}
                      style={{ height: point.count > 0 ? `${pct}%` : '3px' }}
                    />
                  </div>
                  <span className="text-[10px] text-muted font-medium leading-tight text-center">
                    {point.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Per person */}
      <div className="bg-surface rounded-xl border border-border p-4">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          Sorties par personne
        </h3>
        {perPerson.length === 0 ? (
          <p className="text-muted text-sm text-center py-4">Aucune donnee</p>
        ) : (
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {perPerson.map((person, index) => {
              const name = userNames[person.userId] || 'Inconnu'
              const maxPersonCount = perPerson[0].count
              return (
                <div key={person.userId} className="flex items-center gap-3">
                  <div className="w-6 text-center shrink-0">
                    {index === 0 ? (
                      <Trophy className="w-4 h-4 text-yellow-500 mx-auto" />
                    ) : (
                      <span className="text-xs text-muted font-medium">{index + 1}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium truncate">{name}</span>
                      <span className="text-xs text-muted shrink-0 ml-2">
                        {person.count} sortie{person.count > 1 ? 's' : ''} · {formatOutingDuration(person.totalMinutes)} · moy. {formatOutingDuration(person.avgMinutes)}
                      </span>
                    </div>
                    <div className="h-2 bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${(person.count / maxPersonCount) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Dogs: most walked + least walked — side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most walked */}
        <div className="bg-surface rounded-xl border border-border p-4">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-500" />
            Chiens les plus sortis
          </h3>
          {perAnimal.filter(a => a.count > 0).length === 0 ? (
            <p className="text-muted text-sm text-center py-4">Aucune donnee</p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {perAnimal.filter(a => a.count > 0).slice(0, 10).map((animal, index) => {
                const photo = getAnimalPhoto(animal)
                const maxAnimalCount = perAnimal[0].count
                return (
                  <div key={animal.animalId} className="flex items-center gap-3">
                    <div className="w-6 text-center shrink-0">
                      {index === 0 ? (
                        <Trophy className="w-4 h-4 text-yellow-500 mx-auto" />
                      ) : (
                        <span className="text-xs text-muted font-medium">{index + 1}</span>
                      )}
                    </div>
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-muted/20 flex items-center justify-center shrink-0">
                        <PawPrint className="w-3.5 h-3.5 text-muted" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium truncate">{animal.name}</span>
                        <span className="text-xs text-muted shrink-0 ml-2">
                          {animal.count} sortie{animal.count > 1 ? 's' : ''} · {formatOutingDuration(animal.totalMinutes)}
                        </span>
                      </div>
                      <div className="h-2 bg-border rounded-full overflow-hidden">
                        <div
                          className="h-full bg-success rounded-full transition-all"
                          style={{ width: `${(animal.count / maxAnimalCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Least walked / never walked */}
        <div className="bg-surface rounded-xl border border-warning/30 p-4">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            Chiens les moins sortis
            {perAnimal.filter(a => a.count === 0).length > 0 && (
              <span className="text-xs font-normal text-warning ml-auto">
                {perAnimal.filter(a => a.count === 0).length} jamais sorti{perAnimal.filter(a => a.count === 0).length > 1 ? 's' : ''}
              </span>
            )}
          </h3>
          {(() => {
            const leastWalked = [...perAnimal].sort((a, b) => a.count - b.count || a.totalMinutes - b.totalMinutes)
            const toShow = leastWalked.filter(a => a.count <= (leastWalked[Math.min(9, leastWalked.length - 1)]?.count ?? 0) || a.count === 0)
              .slice(0, 15)
            return toShow.length === 0 ? (
              <p className="text-muted text-sm text-center py-4">Tous les chiens ont ete sortis</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {toShow.map((animal) => {
                  const photo = getAnimalPhoto(animal)
                  const isNeverWalked = animal.count === 0
                  return (
                    <div key={animal.animalId} className={`flex items-center gap-3 py-1.5 px-2 rounded-lg ${isNeverWalked ? 'bg-warning/5' : ''}`}>
                      {photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photo} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-muted/20 flex items-center justify-center shrink-0">
                          <PawPrint className="w-4 h-4 text-muted" />
                        </div>
                      )}
                      <span className="text-sm font-medium truncate flex-1">{animal.name}</span>
                      <span className={`text-xs font-semibold shrink-0 ml-2 ${isNeverWalked ? 'text-red-500' : 'text-warning'}`}>
                        {isNeverWalked ? 'Jamais sorti' : `${animal.count} sortie${animal.count > 1 ? 's' : ''}`}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
