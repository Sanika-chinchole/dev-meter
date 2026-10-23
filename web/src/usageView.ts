import type { UsageDay, UsageModel } from './usage'

/**
 * $0 with calls means DevMeter has no price for the model: the backend records list price even on
 * free tiers, so a priced model never shows $0. Flag it so $0 isn't read as "free".
 */
export function isUnpriced(model: UsageModel): boolean {
  return model.costUsd === 0 && model.calls > 0
}

export function unpricedCount(models: UsageModel[]): number {
  return models.filter(isUnpriced).length
}

/** Highest cost first; ties by calls, then name, so the order is stable. */
export function sortByCost(models: UsageModel[]): UsageModel[] {
  return [...models].sort((a, b) => b.costUsd - a.costUsd || b.calls - a.calls || a.model.localeCompare(b.model))
}

/** A model's share of the total cost, 0..1 (0 when the total is 0). */
export function costShare(model: UsageModel, totalCostUsd: number): number {
  return totalCostUsd > 0 ? model.costUsd / totalCostUsd : 0
}

/** Days that had at least one call, for the "Show as table" view. */
export function daysWithCalls(days: UsageDay[]): UsageDay[] {
  return days.filter((day) => day.calls > 0)
}
