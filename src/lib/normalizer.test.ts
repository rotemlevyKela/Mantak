import { describe, expect, it } from 'vitest'
import { createNormalizerState, normalizeAlerts } from './normalizer'
import type { AlertEvent } from '../domain/types'

function makeAlert(alertId: string, detectedAt: number, priority: AlertEvent['priority']): AlertEvent {
  return {
    alertId,
    trackId: `track-${alertId}`,
    streamId: 'front',
    objectType: 'man',
    priority,
    motionState: 'dynamic',
    velocityMps: 4,
    firstDetectedAt: detectedAt - 4000,
    detectedAt,
    distance: { distanceM: 24, azimuthDeg: 180 },
    dimensions: { heightM: 1.8, lengthM: 0.7 },
  }
}

describe('normalizeAlerts', () => {
  it('deduplicates alerts by alertId', () => {
    const state = createNormalizerState()
    const now = 100_000
    const result = normalizeAlerts(
      [makeAlert('a1', 100, 'high'), makeAlert('a1', 100, 'high')],
      state,
      { now },
    )
    expect(result).toHaveLength(1)
  })

  it('sorts by priority then timestamp', () => {
    const state = createNormalizerState()
    const result = normalizeAlerts(
      [makeAlert('low', 120, 'low'), makeAlert('critical', 80, 'critical')],
      state,
      { now: 200_000 },
    )
    expect(result[0].alertId).toBe('critical')
  })
})
