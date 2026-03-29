import type { InterestArea } from '../domain/types'

export function isPointInsidePolygon(
  x: number,
  y: number,
  vertices: Array<{ x: number; y: number }>,
): boolean {
  let inside = false
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i].x
    const yi = vertices[i].y
    const xj = vertices[j].x
    const yj = vertices[j].y
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersects) {
      inside = !inside
    }
  }
  return inside
}

export function shouldAlertForPoint(
  x: number,
  y: number,
  zones: InterestArea[],
  precedence: 'opt-out-wins' | 'opt-in-wins' = 'opt-out-wins',
): boolean {
  const matches = zones.filter((zone) => isPointInsidePolygon(x, y, zone.vertices))
  if (matches.length === 0) {
    return true
  }
  const hasOptOut = matches.some((zone) => zone.mode === 'opt-out')
  const hasOptIn = matches.some((zone) => zone.mode === 'opt-in')

  if (precedence === 'opt-out-wins') {
    if (hasOptOut) {
      return false
    }
    return hasOptIn
  }
  if (hasOptIn) {
    return true
  }
  return !hasOptOut
}
