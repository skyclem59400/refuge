'use client'

import type { CallLogWithCategory, CallCategory } from '@/lib/types/database'

interface CategoryChartProps {
  calls: CallLogWithCategory[]
  categories: CallCategory[]
}

export function CategoryChart({ calls, categories }: CategoryChartProps) {
  // Count calls per category
  const countByCategory = new Map<string, number>()
  for (const call of calls) {
    const catId = call.category_id || 'uncategorized'
    countByCategory.set(catId, (countByCategory.get(catId) || 0) + 1)
  }

  // Build category data with counts
  const categoryData: Array<{ name: string; color: string; count: number }> = []

  for (const cat of categories) {
    const count = countByCategory.get(cat.id) || 0
    if (count > 0) {
      categoryData.push({ name: cat.name, color: cat.color, count })
    }
  }

  // Add uncategorized if any
  const uncategorized = countByCategory.get('uncategorized') || 0
  if (uncategorized > 0) {
    categoryData.push({ name: 'Non categorise', color: '#94a3b8', count: uncategorized })
  }

  // Sort by count descending
  categoryData.sort((a, b) => b.count - a.count)

  const maxCount = Math.max(...categoryData.map((d) => d.count), 1)

  return (
    <div className="bg-surface rounded-xl border border-border p-5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-4">
        Repartition par categorie
      </h3>

      {categoryData.length === 0 ? (
        <p className="text-sm text-muted text-center py-4">Aucune donnee</p>
      ) : (
        <div className="space-y-3">
          {categoryData.map((item) => {
            const percentage = Math.round((item.count / calls.length) * 100)
            const barWidth = Math.round((item.count / maxCount) * 100)

            return (
              <div key={item.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{item.name}</span>
                  <span className="text-xs text-muted">
                    {item.count} ({percentage}%)
                  </span>
                </div>
                <div className="h-2 bg-surface-hover rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${barWidth}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
