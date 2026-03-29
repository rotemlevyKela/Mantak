import { PRIORITY_WEIGHT } from '../domain/constants'
import type { AlertEvent } from '../domain/types'

export interface NormalizerState {
  seen: Map<string, number>
  lastFlushMs: number
}

export interface NormalizeOptions {
  now: number
  minFlushIntervalMs?: number
  dedupeWindowMs?: number
}

export function createNormalizerState(): NormalizerState {
  return {
    seen: new Map<string, number>(),
    lastFlushMs: 0,
  }
}

export function normalizeAlerts(
  alerts: AlertEvent[],
  state: NormalizerState,
  options: NormalizeOptions,
): AlertEvent[] {
  const minFlushIntervalMs = options.minFlushIntervalMs ?? 120
  const dedupeWindowMs = options.dedupeWindowMs ?? 10_000

  if (options.now - state.lastFlushMs < minFlushIntervalMs) {
    return []
  }
  state.lastFlushMs = options.now

  const unique: AlertEvent[] = []
  for (const alert of alerts) {
    const previous = state.seen.get(alert.alertId)
    if (previous && options.now - previous < dedupeWindowMs) {
      continue
    }
    state.seen.set(alert.alertId, options.now)
    unique.push(alert)
  }

  for (const [alertId, seenAt] of state.seen.entries()) {
    if (options.now - seenAt > dedupeWindowMs) {
      state.seen.delete(alertId)
    }
  }

  return unique.sort((a, b) => {
    const byPriority = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]
    if (byPriority !== 0) {
      return byPriority
    }
    if (b.detectedAt !== a.detectedAt) {
      return b.detectedAt - a.detectedAt
    }
    return a.alertId.localeCompare(b.alertId)
  })
}
