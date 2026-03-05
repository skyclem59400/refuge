// ---------------------------------------------------------------------------
// Helper: Track changes between old and new data
// ---------------------------------------------------------------------------

export function trackChanges<T extends Record<string, unknown>>(
  oldData: T | null,
  newData: Partial<T>
): Record<string, { old: unknown; new: unknown }> {
  const changes: Record<string, { old: unknown; new: unknown }> = {}

  if (!oldData) return changes

  for (const [key, newValue] of Object.entries(newData)) {
    const oldValue = oldData[key as keyof T]
    if (oldValue !== newValue) {
      changes[key] = { old: oldValue, new: newValue }
    }
  }

  return changes
}
