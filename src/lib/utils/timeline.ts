export interface TimelineEvent {
  id: string
  date: string
  start_time: string
  end_time: string
  type: 'schedule' | 'appointment'
  data: any // StaffSchedule | Appointment
}

export interface PositionedEvent extends TimelineEvent {
  top: number      // %
  height: number   // %
  left: number     // %
  width: number    // %
  column: number   // overlap column index
  totalColumns: number
}

/**
 * Convert time string (HH:MM) to minutes since midnight
 */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/**
 * Calculate top position as percentage of timeline
 * @param startTime Event start time (HH:MM)
 * @param timelineStart Timeline start hour (e.g., 8 for 8:00)
 * @param totalHours Total hours in timeline (e.g., 12 for 8h-20h)
 */
export function calculateTopPercent(
  startTime: string,
  timelineStart: number,
  totalHours: number
): number {
  const startMinutes = timeToMinutes(startTime)
  const offsetMinutes = startMinutes - (timelineStart * 60)
  return (offsetMinutes / (totalHours * 60)) * 100
}

/**
 * Calculate height as percentage of timeline
 */
export function calculateHeightPercent(
  startTime: string,
  endTime: string,
  totalHours: number
): number {
  const durationMinutes = timeToMinutes(endTime) - timeToMinutes(startTime)
  return Math.max((durationMinutes / (totalHours * 60)) * 100, 2) // min 2% for visibility
}

/**
 * Group events by date
 */
export function groupEventsByDate(events: TimelineEvent[]): Record<string, TimelineEvent[]> {
  return events.reduce((acc, event) => {
    if (!acc[event.date]) acc[event.date] = []
    acc[event.date].push(event)
    return acc
  }, {} as Record<string, TimelineEvent[]>)
}

/**
 * Detect overlapping events on same day
 * Two events overlap if: event1.start < event2.end AND event1.end > event2.start
 */
export function detectOverlaps(events: TimelineEvent[]): TimelineEvent[][] {
  if (events.length === 0) return []

  const sorted = [...events].sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time))
  const groups: TimelineEvent[][] = []
  let currentGroup: TimelineEvent[] = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]
    const lastInGroup = currentGroup[currentGroup.length - 1]

    // Check overlap with last event in current group
    const overlapExists = timeToMinutes(current.start_time) < timeToMinutes(lastInGroup.end_time)

    if (overlapExists) {
      currentGroup.push(current)
    } else {
      groups.push(currentGroup)
      currentGroup = [current]
    }
  }

  groups.push(currentGroup)
  return groups
}

/**
 * Assign column positions to overlapping events using greedy algorithm
 */
export function assignColumns(events: TimelineEvent[]): PositionedEvent[] {
  const overlappingGroups = detectOverlaps(events)
  const positioned: PositionedEvent[] = []

  for (const group of overlappingGroups) {
    if (group.length === 1) {
      // No overlap, full width
      positioned.push({
        ...group[0],
        top: 0,
        height: 0,
        left: 0,
        width: 100,
        column: 0,
        totalColumns: 1,
      })
    } else {
      // Multiple overlaps, assign columns
      const columns: (TimelineEvent | null)[] = []

      for (const event of group) {
        // Find first available column
        let columnIndex = 0
        while (columnIndex < columns.length) {
          const occupant = columns[columnIndex]
          if (!occupant || timeToMinutes(occupant.end_time) <= timeToMinutes(event.start_time)) {
            break
          }
          columnIndex++
        }

        columns[columnIndex] = event
        positioned.push({
          ...event,
          top: 0,
          height: 0,
          left: (columnIndex / columns.length) * 100,
          width: 100 / columns.length,
          column: columnIndex,
          totalColumns: columns.length,
        })
      }
    }
  }

  return positioned
}
