import { describe, expect, it } from 'vitest'
import { shouldAlertForPoint } from './zonePolicy'

const zones = [
  {
    id: 'zone-allow',
    name: 'Allow',
    mode: 'opt-in' as const,
    vertices: [
      { x: -10, y: -10 },
      { x: 10, y: -10 },
      { x: 10, y: 10 },
      { x: -10, y: 10 },
    ],
  },
  {
    id: 'zone-block',
    name: 'Block',
    mode: 'opt-out' as const,
    vertices: [
      { x: -5, y: -5 },
      { x: 5, y: -5 },
      { x: 5, y: 5 },
      { x: -5, y: 5 },
    ],
  },
]

describe('shouldAlertForPoint', () => {
  it('follows opt-out precedence by default', () => {
    expect(shouldAlertForPoint(0, 0, zones)).toBe(false)
  })

  it('allows points outside any zone', () => {
    expect(shouldAlertForPoint(99, 99, zones)).toBe(true)
  })
})
